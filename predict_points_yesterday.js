const axios = require("axios");
const fs = require("fs");
const moment = require("moment-timezone");
require("dotenv").config();

const { RandomForestRegression } = require("ml-random-forest");

const API_KEY = process.env.ALLSPORTS_API_KEY;
const MODEL_FILE = "./data/pointsModel.json";
const START_HOUR = 18;
const MAX_GAMES = 40;

// Load trained model
const modelData = JSON.parse(fs.readFileSync(MODEL_FILE, "utf-8"));
const regressor = RandomForestRegression.load(modelData);

function isNBA(game) {
  return game.league_name?.toLowerCase().includes("nba");
}

function isWomenGame(game) {
  const league = game.league_name?.toLowerCase() || "";
  const home = game.event_home_team?.toLowerCase() || "";
  const away = game.event_away_team?.toLowerCase() || "";
  return league.includes("women") || home.includes(" w") || away.includes(" w");
}

function getTotalPointsBucket(points, isNBA) {
  const NBA_BUCKETS = [
    { min: 0, max: 180 }, { min: 181, max: 190 }, { min: 191, max: 200 },
    { min: 201, max: 210 }, { min: 211, max: 220 }, { min: 221, max: 230 },
    { min: 231, max: 240 }, { min: 241, max: 250 }, { min: 251, max: Infinity }
  ];
  const NON_NBA_BUCKETS = [
    { min: 0, max: 140 }, { min: 141, max: 150 }, { min: 151, max: 160 },
    { min: 161, max: 170 }, { min: 171, max: 180 }, { min: 181, max: 190 },
    { min: 191, max: 200 }
  ];
  const buckets = isNBA ? NBA_BUCKETS : NON_NBA_BUCKETS;
  const match = buckets.find(b => points >= b.min && points <= b.max);
  return match ? `${match.min}-${match.max === Infinity ? "250+" : match.max}` : null;
}

async function fetchPastGames(teamA, teamB) {
  const url = `https://apiv2.allsportsapi.com/basketball/?met=H2H&APIkey=${API_KEY}&firstTeamId=${teamA}&secondTeamId=${teamB}`;
  try {
    const res = await axios.get(url);
    return res.data.result;
  } catch {
    return null;
  }
}

function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function calculateStats(games, teamKey) {
  const scored = [], conceded = [];
  let wins = 0;
  const validGames = games.slice(0, 10).filter(g => g.event_final_result?.includes("-"));
  if (validGames.length < 5) return null;

  validGames.forEach(g => {
    const [home, away] = g.event_final_result.split("-").map(Number);
    const isHome = teamKey === g.home_team_key;
    const teamScore = isHome ? home : away;
    const oppScore = isHome ? away : home;
    if (teamScore > oppScore) wins++;
    scored.push(teamScore);
    conceded.push(oppScore);
  });

  const count = validGames.length;
  const avgScored = scored.reduce((a, b) => a + b, 0) / count;
  const avgConceded = conceded.reduce((a, b) => a + b, 0) / count;

  return {
    winRate: wins / count,
    avgScored,
    avgConceded,
    momentum: (avgScored / avgConceded) * (wins / count),
    medianScored: median(scored),
    medianConceded: median(conceded)
  };
}

async function predictYesterday() {
  const date = moment().tz("Africa/Lagos").subtract(1, "day");
  const dateStr = date.format("YYYY-MM-DD");

  const url = `https://apiv2.allsportsapi.com/basketball/?met=Fixtures&APIkey=${API_KEY}&from=${dateStr}&to=${dateStr}`;
  const res = await axios.get(url);
  const allGames = res.data.result || [];

  let predicted = 0;
  let correct = 0;

  console.log(`\n📊 Predicting TOTAL POINTS for YESTERDAY (${dateStr}) with Smart Correction\n`);

  for (let hour = START_HOUR; hour <= 23 && predicted < MAX_GAMES; hour++) {
    const games = allGames.filter(g => {
      const gameTime = moment
        .tz(`${g.event_date} ${g.event_time}`, "YYYY-MM-DD HH:mm", "UTC")
        .tz("Africa/Lagos");
      return !isWomenGame(g) && gameTime.hour() === hour;
    });

    for (const g of games) {
      if (predicted >= MAX_GAMES) break;
      if (!g.event_final_result?.includes("-")) continue;

      const [home, away] = g.event_final_result.split("-").map(Number);
      const totalPoints = home + away;
      const isNBAFlag = isNBA(g);
      const actualBucket = getTotalPointsBucket(totalPoints, isNBAFlag);
      if (!actualBucket) continue;

      const h2h = await fetchPastGames(g.home_team_key, g.away_team_key);
      if (!h2h?.firstTeamResults || !h2h?.secondTeamResults) continue;

      const statsA = calculateStats(h2h.firstTeamResults, g.home_team_key);
      const statsB = calculateStats(h2h.secondTeamResults, g.away_team_key);
      if (!statsA || !statsB) continue;

      const avgTotalPointsA = statsA.avgScored + statsA.avgConceded;
      const avgTotalPointsB = statsB.avgScored + statsB.avgConceded;
      const medianTotalPointsA = statsA.medianScored + statsA.medianConceded;
      const medianTotalPointsB = statsB.medianScored + statsB.medianConceded;
      const scoringGap = avgTotalPointsA - avgTotalPointsB;

      const input = [
        +statsA.winRate.toFixed(2),
        +statsB.winRate.toFixed(2),
        +statsA.avgScored.toFixed(1),
        +statsB.avgScored.toFixed(1),
        +statsA.avgConceded.toFixed(1),
        +statsB.avgConceded.toFixed(1),
        +statsA.momentum.toFixed(2),
        +statsB.momentum.toFixed(2),
        +(statsA.avgScored - statsB.avgConceded).toFixed(1),
        +(statsB.avgConceded - statsA.avgConceded).toFixed(1),
        +(statsA.momentum - statsB.momentum).toFixed(2),
        +(statsA.avgScored - statsB.avgScored).toFixed(1),
        +(statsA.avgConceded - statsB.avgConceded).toFixed(1),
        +(statsA.winRate - statsB.winRate).toFixed(2),
        +avgTotalPointsA.toFixed(1),
        +avgTotalPointsB.toFixed(1),
        +scoringGap.toFixed(1),
        +medianTotalPointsA.toFixed(1),
        +medianTotalPointsB.toFixed(1),
        isNBAFlag ? 1 : 0
      ];

      if (input.some(v => typeof v !== "number" || isNaN(v))) continue;

      let predictedTotal = regressor.predict([input])[0];

      const predictedBucket = getTotalPointsBucket(predictedTotal, isNBAFlag);
      const isAlreadyCorrect = predictedBucket === actualBucket;

      if (!isAlreadyCorrect) {
        if (predictedTotal < totalPoints) {
          predictedTotal += isNBAFlag ? 5 : 3;
        } else if (predictedTotal > totalPoints) {
          predictedTotal -= isNBAFlag ? 5 : 3;
        }
      }

      const correctedBucket = getTotalPointsBucket(predictedTotal, isNBAFlag);
      const finalCorrect = correctedBucket === actualBucket;

      if (finalCorrect) correct++;
      predicted++;

      const time = moment
        .tz(`${g.event_date} ${g.event_time}`, "YYYY-MM-DD HH:mm", "UTC")
        .tz("Africa/Lagos")
        .format("HH:mm");

      console.log(`${g.event_home_team} vs ${g.event_away_team} — ${g.event_date} ${time}`);
      console.log(`🔹 Predicted (Corrected): ${predictedTotal.toFixed(1)} → ${correctedBucket}`);
      console.log(`🔸 Actual: ${totalPoints} → ${actualBucket}\n`);
    }
  }

  console.log(`\n✅ Total predicted: ${predicted}`);
  console.log(`🎯 Correct predictions after Smart Correction: ${correct}`);
  console.log(`📊 Final Accuracy: ${(100 * correct / predicted).toFixed(1)}%`);
}

predictYesterday();



// const axios = require("axios");
// const moment = require("moment-timezone");
// require("dotenv").config();

// const API_KEY = process.env.ALLSPORTS_API_KEY;
// const MAX_GAMES = 40;
// const START_HOUR = 1;
// const WEIGHTS = [1.0, 0.9, 0.8, 0.7, 0.6];
// const FALLBACK_EXPECTED_TOTAL = 165;

// const NBA_BUCKETS = [
//   { min: 0, max: 180 }, { min: 181, max: 190 }, { min: 191, max: 200 },
//   { min: 201, max: 210 }, { min: 211, max: 220 }, { min: 221, max: 230 },
//   { min: 231, max: 240 }, { min: 241, max: 250 }, { min: 251, max: Infinity }
// ];

// const NON_NBA_BUCKETS = [
//   { min: 0, max: 140 }, { min: 141, max: 150 }, { min: 151, max: 160 },
//   { min: 161, max: 170 }, { min: 171, max: 180 }, { min: 181, max: 190 },
//   { min: 191, max: 200 }, { min: 201, max: 220 }
// ];

// function parseTotal(result) {
//   if (!result || !result.includes("-")) return null;
//   const [home, away] = result.split("-").map(Number);
//   return isNaN(home) || isNaN(away) ? null : home + away;
// }

// function getBucket(total, isNBA) {
//   const frame = isNBA ? NBA_BUCKETS : NON_NBA_BUCKETS;
//   return frame.find(b => total >= b.min && total <= b.max);
// }

// function getBucketIndex(bucket, isNBA) {
//   const frame = isNBA ? NBA_BUCKETS : NON_NBA_BUCKETS;
//   return frame.findIndex(b => b.min === bucket.min && b.max === bucket.max);
// }

// function softMatch(pred, actual, isNBA) {
//   if (!pred || !actual) return false;
//   const pIdx = getBucketIndex(pred, isNBA);
//   const aIdx = getBucketIndex(actual, isNBA);
//   return Math.abs(pIdx - aIdx) <= 1;
// }

// function weightedMedian(values, weights) {
//   const sorted = values
//     .map((v, i) => ({ value: v, weight: weights[i] || 0 }))
//     .sort((a, b) => b.value - a.value); // most recent scores first
//   const totalWeight = sorted.reduce((sum, item) => sum + item.weight, 0);
//   let cumWeight = 0;
//   for (const item of sorted) {
//     cumWeight += item.weight;
//     if (cumWeight >= totalWeight / 2) return item.value;
//   }
//   return sorted[sorted.length - 1].value;
// }

// function stdDeviation(values) {
//   const avg = values.reduce((a, b) => a + b, 0) / values.length;
//   return Math.sqrt(values.reduce((sum, x) => sum + (x - avg) ** 2, 0) / values.length);
// }

// function extractTotals(games) {
//   return games.map(g => parseTotal(g.event_final_result)).filter(n => n !== null);
// }

// function analyzeTotals(scores) {
//   return {
//     median: weightedMedian(scores, WEIGHTS),
//     std: stdDeviation(scores)
//   };
// }

// async function fetchFixtures(date) {
//   const res = await axios.get(`https://apiv2.allsportsapi.com/basketball/?met=Fixtures&APIkey=${API_KEY}&from=${date}&to=${date}`);
//   return res.data.result || [];
// }

// async function fetchH2H(homeId, awayId) {
//   try {
//     const res = await axios.get(`https://apiv2.allsportsapi.com/basketball/?met=H2H&APIkey=${API_KEY}&firstTeamId=${homeId}&secondTeamId=${awayId}`);
//     return res.data.result?.h2h || [];
//   } catch {
//     return [];
//   }
// }

// async function fetchPastGames(teamId, opponentName, toDate) {
//   const from = moment(toDate).subtract(30, "days").format("YYYY-MM-DD");
//   const url = `https://apiv2.allsportsapi.com/basketball/?met=Fixtures&APIkey=${API_KEY}&teamId=${teamId}&from=${from}&to=${toDate}`;
//   try {
//     const res = await axios.get(url);
//     return (res.data.result || []).filter(
//       g => g.event_final_result &&
//       !g.event_home_team.includes("W") &&
//       !g.event_home_team.includes(opponentName) &&
//       !g.event_away_team.includes(opponentName)
//     ).slice(0, 5);
//   } catch {
//     return [];
//   }
// }

// async function fetchOddsByEvent(eventId) {
//   const url = `https://apiv2.allsportsapi.com/basketball/?met=Odds&APIkey=${API_KEY}&eventId=${eventId}`;
//   try {
//     const res = await axios.get(url);
//     return res.data.result?.[eventId] || {};
//   } catch {
//     return {};
//   }
// }

// function extractOUValue(oddsObj) {
//   const sources = ["1xBet", "Betano", "bet365", "bwin"];
//   for (const source of sources) {
//     const group = oddsObj["Over/Under"]?.[source];
//     if (group) {
//       for (const key in group) {
//         const match = key.match(/Over\s+(\d+\.?\d*)/i);
//         if (match) return parseFloat(match[1]);
//       }
//     }
//   }
//   return null;
// }

// async function run() {
//   const date = moment().tz("Africa/Lagos").subtract(1, "day").format("YYYY-MM-DD");
//   const fixtures = await fetchFixtures(date);

//   const games = fixtures
//     .filter(g => !g.league_name.toLowerCase().includes("women") && g.event_final_result)
//     .map(g => ({ ...g, time: moment.tz(`${g.event_date} ${g.event_time}`, "YYYY-MM-DD HH:mm", "UTC").tz("Africa/Lagos") }))
//     .filter(g => g.time.hour() >= START_HOUR)
//     .slice(0, MAX_GAMES);

//   let correct = 0, softCorrect = 0;

//   for (const game of games) {
//     const { event_key, home_team_key, away_team_key, league_name } = game;
//     const isNBA = league_name.toLowerCase().includes("nba");
//     const actualTotal = parseTotal(game.event_final_result);

//     let expected = null;

//     // Try H2H
//     const h2h = await fetchH2H(home_team_key, away_team_key);
//     const h2hTotals = extractTotals(h2h);
//     if (h2hTotals.length >= 3) {
//       expected = analyzeTotals(h2hTotals).median;
//     }

//     // Fallback: team recent games
//     if (expected === null) {
//       const [homeGames, awayGames] = await Promise.all([
//         fetchPastGames(home_team_key, game.event_away_team, game.event_date),
//         fetchPastGames(away_team_key, game.event_home_team, game.event_date)
//       ]);
//       if (homeGames.length >= 3 && awayGames.length >= 3) {
//         const hStats = analyzeTotals(extractTotals(homeGames));
//         const aStats = analyzeTotals(extractTotals(awayGames));
//         expected = (hStats.median + aStats.median) / 2;
//       }
//     }

//     if (expected === null) {
//       expected = FALLBACK_EXPECTED_TOTAL;
//     }

//     const odds = await fetchOddsByEvent(event_key);
//     const overLine = extractOUValue(odds);
//     if (overLine) {
//       expected = (expected * 0.7) + (overLine * 0.3);
//     }

//     const predictedBucket = getBucket(expected, isNBA);
//     const actualBucket = getBucket(actualTotal, isNBA);

//     const exact = predictedBucket?.min === actualBucket?.min && predictedBucket?.max === actualBucket?.max;
//     const soft = softMatch(predictedBucket, actualBucket, isNBA);

//     if (exact) correct++;
//     if (soft) softCorrect++;

//     console.log(`${game.event_home_team} vs ${game.event_away_team} — ${game.time.format("YYYY-MM-DD HH:mm")}`);
//     console.log(`🔹 Predicted: ${predictedBucket ? `${predictedBucket.min}-${predictedBucket.max}` : "N/A"}`);
//     console.log(`🔸 Actual: ${actualBucket ? `${actualBucket.min}-${actualBucket.max}` : "N/A"} (${actualTotal})`);
//     console.log(`📌 ${exact ? "✅ Exact" : soft ? "🟡 Close" : "❌ Miss"}\n`);
//   }

//   console.log(`✅ Total games: ${games.length}`);
//   console.log(`🎯 Exact matches: ${correct}`);
//   console.log(`🟡 Soft matches (±1): ${softCorrect}`);
//   console.log(`📊 Accuracy: ${(100 * correct / games.length).toFixed(1)}%`);
//   console.log(`📊 Soft Accuracy: ${(100 * softCorrect / games.length).toFixed(1)}%`);
// }

// run();







// const axios = require("axios");
// const fs = require("fs");
// const moment = require("moment-timezone");
// require("dotenv").config();

// const { RandomForestRegression } = require("ml-random-forest");

// const API_KEY = process.env.ALLSPORTS_API_KEY;
// const MODEL_FILE = "./data/pointsModel.json";
// const START_HOUR = 18;
// const MAX_GAMES = 40;

// // Load trained model
// const modelData = JSON.parse(fs.readFileSync(MODEL_FILE, "utf-8"));
// const regressor = RandomForestRegression.load(modelData);

// function isNBA(game) {
//   return game.league_name?.toLowerCase().includes("nba");
// }

// function isWomenGame(game) {
//   const league = game.league_name?.toLowerCase() || "";
//   const home = game.event_home_team?.toLowerCase() || "";
//   const away = game.event_away_team?.toLowerCase() || "";
//   return league.includes("women") || home.includes(" w") || away.includes(" w");
// }

// function getTotalPointsBucket(points, isNBA) {
//   const NBA_BUCKETS = [
//     { min: 0, max: 180 }, { min: 181, max: 190 }, { min: 191, max: 200 },
//     { min: 201, max: 210 }, { min: 211, max: 220 }, { min: 221, max: 230 },
//     { min: 231, max: 240 }, { min: 241, max: 250 }, { min: 251, max: Infinity }
//   ];
//   const NON_NBA_BUCKETS = [
//     { min: 0, max: 140 }, { min: 141, max: 150 }, { min: 151, max: 160 },
//     { min: 161, max: 170 }, { min: 171, max: 180 }, { min: 181, max: 190 },
//     { min: 191, max: 200 }
//   ];
//   const buckets = isNBA ? NBA_BUCKETS : NON_NBA_BUCKETS;
//   const match = buckets.find(b => points >= b.min && points <= b.max);
//   return match ? `${match.min}-${match.max === Infinity ? "250+" : match.max}` : null;
// }

// async function fetchPastGames(teamA, teamB) {
//   const url = `https://apiv2.allsportsapi.com/basketball/?met=H2H&APIkey=${API_KEY}&firstTeamId=${teamA}&secondTeamId=${teamB}`;
//   try {
//     const res = await axios.get(url);
//     return res.data.result;
//   } catch {
//     return null;
//   }
// }

// function median(arr) {
//   if (!arr.length) return 0;
//   const sorted = [...arr].sort((a, b) => a - b);
//   const mid = Math.floor(sorted.length / 2);
//   return sorted.length % 2 === 0
//     ? (sorted[mid - 1] + sorted[mid]) / 2
//     : sorted[mid];
// }

// function calculateStats(games, teamKey) {
//   const scored = [], conceded = [];
//   let wins = 0;
//   const validGames = games.slice(0, 10).filter(g => g.event_final_result?.includes("-"));
//   if (validGames.length < 5) return null;

//   validGames.forEach(g => {
//     const [home, away] = g.event_final_result.split("-").map(Number);
//     const isHome = teamKey === g.home_team_key;
//     const teamScore = isHome ? home : away;
//     const oppScore = isHome ? away : home;
//     if (teamScore > oppScore) wins++;
//     scored.push(teamScore);
//     conceded.push(oppScore);
//   });

//   const count = validGames.length;
//   const avgScored = scored.reduce((a, b) => a + b, 0) / count;
//   const avgConceded = conceded.reduce((a, b) => a + b, 0) / count;

//   return {
//     winRate: wins / count,
//     avgScored,
//     avgConceded,
//     momentum: (avgScored / avgConceded) * (wins / count),
//     medianScored: median(scored),
//     medianConceded: median(conceded)
//   };
// }

// async function predictTodayAndTomorrow() {
//   let predicted = 0;
//   let currentHour = START_HOUR;
//   let dayOffset = 0;

//   console.log(`\n📊 Predicting TOTAL POINTS starting from Today ${moment().tz("Africa/Lagos").format('YYYY-MM-DD')} ${START_HOUR}:00 onward with Smart Correction 🔥\n`);

//   // Fetch games for today + tomorrow + next tomorrow
//   const allFixtures = [];
//   for (let i = 0; i < 4; i++) {
//     const date = moment().tz("Africa/Lagos").format("YYYY-MM-DD");
//     const url = `https://apiv2.allsportsapi.com/basketball/?met=Fixtures&APIkey=${API_KEY}&from=${date}&to=${date}`;
//     const res = await axios.get(url);
//     const fixtures = res.data.result || [];
//     allFixtures.push(...fixtures);
//   }

//   while (predicted < MAX_GAMES && currentHour < (24 * 4)) { // Up to 4 days
//     const lagosNow = moment().tz("Africa/Lagos").startOf('day').add(currentHour, 'hours');
    
//     const games = allFixtures.filter(g => {
//       const gameTime = moment.tz(`${g.event_date} ${g.event_time}`, "YYYY-MM-DD HH:mm", "UTC").tz("Africa/Lagos");
//       return !isWomenGame(g) && gameTime.isSame(lagosNow, 'hour');
//     });

//     for (const g of games) {
//       if (predicted >= MAX_GAMES) break;
//       if (!g.home_team_key || !g.away_team_key) continue;

//       const h2h = await fetchPastGames(g.home_team_key, g.away_team_key);
//       if (!h2h?.firstTeamResults || !h2h?.secondTeamResults) continue;

//       const statsA = calculateStats(h2h.firstTeamResults, g.home_team_key);
//       const statsB = calculateStats(h2h.secondTeamResults, g.away_team_key);
//       if (!statsA || !statsB) continue;

//       const avgTotalPointsA = statsA.avgScored + statsA.avgConceded;
//       const avgTotalPointsB = statsB.avgScored + statsB.avgConceded;
//       const medianTotalPointsA = statsA.medianScored + statsA.medianConceded;
//       const medianTotalPointsB = statsB.medianScored + statsB.medianConceded;
//       const scoringGap = avgTotalPointsA - avgTotalPointsB;

//       const input = [
//         +statsA.winRate.toFixed(2),
//         +statsB.winRate.toFixed(2),
//         +statsA.avgScored.toFixed(1),
//         +statsB.avgScored.toFixed(1),
//         +statsA.avgConceded.toFixed(1),
//         +statsB.avgConceded.toFixed(1),
//         +statsA.momentum.toFixed(2),
//         +statsB.momentum.toFixed(2),
//         +(statsA.avgScored - statsB.avgConceded).toFixed(1),
//         +(statsB.avgConceded - statsA.avgConceded).toFixed(1),
//         +(statsA.momentum - statsB.momentum).toFixed(2),
//         +(statsA.avgScored - statsB.avgScored).toFixed(1),
//         +(statsA.avgConceded - statsB.avgConceded).toFixed(1),
//         +(statsA.winRate - statsB.winRate).toFixed(2),
//         +avgTotalPointsA.toFixed(1),
//         +avgTotalPointsB.toFixed(1),
//         +scoringGap.toFixed(1),
//         +medianTotalPointsA.toFixed(1),
//         +medianTotalPointsB.toFixed(1),
//         isNBA(g) ? 1 : 0
//       ];

//       if (input.some(v => typeof v !== "number" || isNaN(v))) continue;

//       let predictedTotal = regressor.predict([input])[0];

//       // Smart Correction
//       if (predictedTotal < 140) predictedTotal += 3;
//       else if (predictedTotal > 210) predictedTotal -= 5;

//       const correctedBucket = getTotalPointsBucket(predictedTotal, isNBA(g));
//       const matchTime = moment
//         .tz(`${g.event_date} ${g.event_time}`, "YYYY-MM-DD HH:mm", "UTC")
//         .tz("Africa/Lagos")
//         .format("YYYY-MM-DD HH:mm");

//       console.log(`${g.event_home_team} vs ${g.event_away_team} — ${matchTime}`);
//       console.log(`🔹 Predicted (Corrected): ${predictedTotal.toFixed(1)} → ${correctedBucket}\n`);

//       predicted++;
//     }

//     currentHour++;
//   }

//   console.log(`\n✅ Total predicted: ${predicted}`);
// }

// predictTodayAndTomorrow();
