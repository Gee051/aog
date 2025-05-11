
// OTHER LEAUGES
// const axios = require("axios");
// const moment = require("moment-timezone");
// require("dotenv").config();

// const API_KEY = process.env.ALLSPORTS_API_KEY;
// const MAX_GAMES = 40;
// const START_HOUR = 18;

// // Point ranges for non-NBA games
// const NON_NBA_RANGES = [
//   { min: 120, max: 130 },
//   { min: 131, max: 140 },
//   { min: 141, max: 150 },
//   { min: 151, max: 160 },
//   { min: 161, max: 170 },
//   { min: 171, max: 180 },
//   { min: 181, max: Infinity }
// ];

// // Point ranges for NBA games
// const NBA_RANGES = [
//   { min: 0, max: 150 },
//   { min: 151, max: 160 },
//   { min: 161, max: 170 },
//   { min: 171, max: 180 },
//   { min: 181, max: 190 },
//   { min: 191, max: 200 },
//   { min: 201, max: 210 },
//   { min: 211, max: 220 },
//   { min: 221, max: 230 },
//   { min: 231, max: 240 },
//   { min: 241, max: 250 },
//   { min: 251, max: Infinity }
// ];

// function getRange(total, isNBA) {
//   const ranges = isNBA ? NBA_RANGES : NON_NBA_RANGES;
//   for (const range of ranges) {
//     if (total >= range.min && total <= range.max) {
//       return `${range.min}-${range.max === Infinity ? `${range.min}+` : range.max}`;
//     }
//   }
//   return "Unknown";
// }

// function isWomenGame(game) {
//   const league = game.league_name?.toLowerCase() || "";
//   const home = game.event_home_team?.toLowerCase() || "";
//   const away = game.event_away_team?.toLowerCase() || "";
//   return league.includes("women") || home.includes(" w") || away.includes(" w");
// }

// async function fetchFixturesByDate(date) {
//   const url = `https://apiv2.allsportsapi.com/basketball/?met=Fixtures&APIkey=${API_KEY}&from=${date}&to=${date}`;
//   try {
//     const res = await axios.get(url);
//     return res.data.result || [];
//   } catch (err) {
//     console.error("❌ Failed to fetch fixtures:", err.message);
//     return [];
//   }
// }

// async function fetchPastGames(teamA, teamB) {
//   const url = `https://apiv2.allsportsapi.com/basketball/?met=H2H&APIkey=${API_KEY}&firstTeamId=${teamA}&secondTeamId=${teamB}`;
//   try {
//     const res = await axios.get(url);
//     return res.data.result;
//   } catch (err) {
//     return null;
//   }
// }

// function analyzeMedianTotal(games) {
//   const totals = games
//     .slice(0, 5)
//     .map((game) => {
//       if (!game.event_final_result || !game.event_final_result.includes("-")) return null;
//       const [home, away] = game.event_final_result.split("-").map(Number);
//       if (isNaN(home) || isNaN(away)) return null;
//       return home + away;
//     })
//     .filter((v) => v !== null)
//     .sort((a, b) => a - b);

//   if (totals.length === 0) return null;
//   const mid = Math.floor(totals.length / 2);
//   return totals.length % 2 !== 0 ? totals[mid] : Math.round((totals[mid - 1] + totals[mid]) / 2);
// }

// function isGameAtExactHour(game, hour) {
//   const gameTime = moment
//     .tz(`${game.event_date} ${game.event_time}`, "YYYY-MM-DD HH:mm", "UTC")
//     .tz("Africa/Lagos");
//   return gameTime.hour() === hour;
// }

// async function run() {
//   console.log(`\n📊 Predicting point ranges from ${START_HOUR}:00 WAT (all leagues included):\n`);

//   let predictedCount = 0;
//   let dayOffset = 0;
//   let currentHour = START_HOUR;

//   while (predictedCount < MAX_GAMES && dayOffset < 3) {
//     const date = moment().tz("Africa/Lagos").add(dayOffset, "days").format("YYYY-MM-DD");
//     const fixtures = await fetchFixturesByDate(date);

//     while (currentHour <= 23 && predictedCount < MAX_GAMES) {
//       const hourlyGames = fixtures.filter(
//         (g) => !isWomenGame(g) && isGameAtExactHour(g, currentHour)
//       );

//       for (const game of hourlyGames) {
//         if (predictedCount >= MAX_GAMES) break;

//         const home = game.event_home_team || "?";
//         const away = game.event_away_team || "?";
//         const leagueId = game.league_key;
//         const isNBA = leagueId === 766;

//         const timeNGA = moment
//           .tz(`${game.event_date} ${game.event_time}`, "YYYY-MM-DD HH:mm", "UTC")
//           .tz("Africa/Lagos")
//           .format("YYYY-MM-DD HH:mm");

//         const data = await fetchPastGames(game.home_team_key, game.away_team_key);
//         if (!data || !data.firstTeamResults || !data.secondTeamResults) {
//           console.log(`⚠️ Skipping ${home} vs ${away} -- Not enough past data`);
//           continue;
//         }

//         const medianA = analyzeMedianTotal(data.firstTeamResults);
//         const medianB = analyzeMedianTotal(data.secondTeamResults);
//         if (medianA === null || medianB === null) {
//           console.log(`⚠️ Skipping ${home} vs ${away} -- Invalid median`);
//           continue;
//         }

//         const finalMedian = Math.round((medianA + medianB) / 2);
//         const predictedRange = getRange(finalMedian, isNBA);

//         console.log(`${home} vs ${away} -- ${timeNGA} -- Predicted Range: ${predictedRange}`);
//         predictedCount++;
//       }

//       currentHour++;
//     }

//     dayOffset++;
//     currentHour = 0; // Start from 00:00 on the next day
//   }

//   if (predictedCount === 0) {
//     console.log("\n⚠️ No valid games found for prediction.");
//   } else {
//     console.log(`\n✅ Total predicted games: ${predictedCount}`);
//   }
// }

// run();

const axios = require("axios");
const moment = require("moment-timezone");
require("dotenv").config();

const API_KEY = process.env.ALLSPORTS_API_KEY;
const MAX_GAMES = 40;

const NBA_KEYWORDS = ["nba"];
const NBA_RANGES = [
  { min: 200, max: 210 },
  { min: 211, max: 220 },
  { min: 221, max: 230 },
  { min: 231, max: 240 },
  { min: 241, max: 250 },
  { min: 251, max: 260 },
  { min: 261, max: Infinity }
];

const NON_NBA_RANGES = [
  { min: 120, max: 130 },
  { min: 131, max: 140 },
  { min: 141, max: 150 },
  { min: 151, max: 160 },
  { min: 161, max: 170 },
  { min: 171, max: 180 },
  { min: 181, max: Infinity }
];

function getRange(total, isNBA) {
  const ranges = isNBA ? NBA_RANGES : NON_NBA_RANGES;
  for (const range of ranges) {
    if (total >= range.min && total <= range.max) {
      return {
        label: `${range.min}-${range.max === Infinity ? (isNBA ? "260+" : "180+") : range.max}`,
        min: range.min,
        max: range.max === Infinity ? 9999 : range.max
      };
    }
  }
  return { label: "Unknown", min: 0, max: 0 };
}

function isNBA(game) {
  const name = (game.league_name || "").toLowerCase();
  return NBA_KEYWORDS.some(keyword => name.includes(keyword));
}

function isWomenGame(game) {
  const league = game.league_name?.toLowerCase() || "";
  const home = game.event_home_team?.toLowerCase() || "";
  const away = game.event_away_team?.toLowerCase() || "";
  return league.includes("women") || home.includes(" w") || away.includes(" w");
}

function weightedMedian(scores) {
  const weighted = [];
  const weights = [1, 2, 3, 4, 5];
  scores.slice(0, 5).forEach((score, index) => {
    for (let i = 0; i < weights[index]; i++) {
      weighted.push(score);
    }
  });
  const sorted = weighted.sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function extractTotals(games) {
  const totals = [];
  games.slice(0, 5).forEach(game => {
    if (!game.event_final_result || !game.event_final_result.includes("-")) return;
    const [home, away] = game.event_final_result.split("-").map(Number);
    if (!isNaN(home) && !isNaN(away)) totals.push(home + away);
  });
  return totals;
}

async function fetchFixturesByDate(date) {
  const url = `https://apiv2.allsportsapi.com/basketball/?met=Fixtures&APIkey=${API_KEY}&from=${date}&to=${date}`;
  try {
    const res = await axios.get(url);
    return res.data.result || [];
  } catch (err) {
    console.error("❌ Failed to fetch fixtures:", err.message);
    return [];
  }
}

async function fetchPastGames(teamA, teamB) {
  const url = `https://apiv2.allsportsapi.com/basketball/?met=H2H&APIkey=${API_KEY}&firstTeamId=${teamA}&secondTeamId=${teamB}`;
  try {
    const res = await axios.get(url);
    return res.data.result;
  } catch (err) {
    return null;
  }
}

function getActualTotal(game) {
  if (!game.event_final_result || !game.event_final_result.includes("-")) return null;
  const [home, away] = game.event_final_result.split("-").map(Number);
  return isNaN(home) || isNaN(away) ? null : home + away;
}

async function run() {
  console.log(`\n📊 Checking TOTAL POINT RANGE prediction accuracy for YESTERDAY:\n`);

  const date = moment().tz("Africa/Lagos").subtract(1, "day").format("YYYY-MM-DD");
  const fixtures = await fetchFixturesByDate(date);

  let correct = 0;
  let total = 0;

  for (const game of fixtures) {
    if (total >= MAX_GAMES) break;
    if (isWomenGame(game)) continue;
    const actualTotal = getActualTotal(game);
    if (actualTotal === null) continue;

    const data = await fetchPastGames(game.home_team_key, game.away_team_key);
    if (!data || !data.firstTeamResults || !data.secondTeamResults) continue;

    const totalsA = extractTotals(data.firstTeamResults);
    const totalsB = extractTotals(data.secondTeamResults);
    if (totalsA.length === 0 || totalsB.length === 0) continue;

    const medianA = weightedMedian(totalsA);
    const medianB = weightedMedian(totalsB);
    const predictedTotal = Math.round((medianA + medianB) / 2);
    const leagueIsNBA = isNBA(game);
    const predictedRange = getRange(predictedTotal, leagueIsNBA);

    const time = moment
      .tz(`${game.event_date} ${game.event_time}`, "YYYY-MM-DD HH:mm", "UTC")
      .tz("Africa/Lagos")
      .format("HH:mm");

    const isCorrect = actualTotal >= predictedRange.min && actualTotal <= predictedRange.max;

    console.log(`${game.event_home_team} vs ${game.event_away_team} — ${date} ${time}`);
    console.log(`🔹 Predicted Range: ${predictedRange.label}`);
    console.log(`🔸 Actual Total: ${actualTotal} ${isCorrect ? "✅" : "❌"}\n`);

    if (isCorrect) correct++;
    total++;
  }

  console.log(`\n✅ Total games checked: ${total}`);
  console.log(`🎯 Correct predictions: ${correct}`);
  console.log(`📊 Accuracy: ${(100 * correct / total).toFixed(1)}%`);
}

run();






// OTHER LEAGUES 
// livePredictModel.js Wweighted+avg
// const axios = require("axios");
// const moment = require("moment-timezone");
// require("dotenv").config();

// const API_KEY = process.env.ALLSPORTS_API_KEY;
// const MAX_GAMES = 40;
// const START_HOUR = 18;

// const NBA_KEYWORDS = ["nba"];
// const NBA_RANGES = [
//   { min: 200, max: 210 },
//   { min: 211, max: 220 },
//   { min: 221, max: 230 },
//   { min: 231, max: 240 },
//   { min: 241, max: 250 },
//   { min: 251, max: 260 },
//   { min: 261, max: Infinity }
// ];

// const NON_NBA_RANGES = [
//   { min: 120, max: 130 },
//   { min: 131, max: 140 },
//   { min: 141, max: 150 },
//   { min: 151, max: 160 },
//   { min: 161, max: 170 },
//   { min: 171, max: 180 },
//   { min: 181, max: Infinity }
// ];

// function getRange(total, isNBA) {
//   const ranges = isNBA ? NBA_RANGES : NON_NBA_RANGES;
//   for (const range of ranges) {
//     if (total >= range.min && total <= range.max) {
//       return `${range.min}-${range.max === Infinity ? (isNBA ? "260+" : "180+") : range.max}`;
//     }
//   }
//   return "Unknown";
// }

// function isNBA(game) {
//   const name = (game.league_name || "").toLowerCase();
//   return NBA_KEYWORDS.some(keyword => name.includes(keyword));
// }

// function isWomenGame(game) {
//   const league = game.league_name?.toLowerCase() || "";
//   const home = game.event_home_team?.toLowerCase() || "";
//   const away = game.event_away_team?.toLowerCase() || "";
//   return league.includes("women") || home.includes(" w") || away.includes(" w");
// }

// function isGameAtExactHour(game, hour) {
//   const gameTime = moment
//     .tz(`${game.event_date} ${game.event_time}`, "YYYY-MM-DD HH:mm", "UTC")
//     .tz("Africa/Lagos");
//   return gameTime.hour() === hour;
// }

// function weightedMedian(scores) {
//   const weighted = [];
//   const weights = [1, 2, 3, 4, 5];
//   scores.slice(0, 5).forEach((score, index) => {
//     for (let i = 0; i < weights[index]; i++) {
//       weighted.push(score);
//     }
//   });
//   const sorted = weighted.sort((a, b) => a - b);
//   const mid = Math.floor(sorted.length / 2);
//   return sorted.length % 2 !== 0
//     ? sorted[mid]
//     : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
// }

// function extractTotals(games) {
//   const totals = [];
//   games.slice(0, 5).forEach(game => {
//     if (!game.event_final_result || !game.event_final_result.includes("-")) return;
//     const [home, away] = game.event_final_result.split("-").map(Number);
//     if (!isNaN(home) && !isNaN(away)) totals.push(home + away);
//   });
//   return totals;
// }

// async function fetchFixturesByDate(date) {
//   const url = `https://apiv2.allsportsapi.com/basketball/?met=Fixtures&APIkey=${API_KEY}&from=${date}&to=${date}`;
//   try {
//     const res = await axios.get(url);
//     return res.data.result || [];
//   } catch (err) {
//     console.error("❌ Failed to fetch fixtures:", err.message);
//     return [];
//   }
// }

// async function fetchPastGames(teamA, teamB) {
//   const url = `https://apiv2.allsportsapi.com/basketball/?met=H2H&APIkey=${API_KEY}&firstTeamId=${teamA}&secondTeamId=${teamB}`;
//   try {
//     const res = await axios.get(url);
//     return res.data.result;
//   } catch (err) {
//     return null;
//   }
// }

// async function run() {
//   console.log(`\n📊 Predicting TOTAL POINT RANGE using Median + Weighted scores from ${START_HOUR}:00 WAT:\n`);

//   let predictedCount = 0;
//   let dayOffset = 0;
//   let hour = START_HOUR;

//   while (predictedCount < MAX_GAMES && dayOffset < 4) {
//     const date = moment().tz("Africa/Lagos").add(dayOffset, "days").format("YYYY-MM-DD");
//     const fixtures = await fetchFixturesByDate(date);

//     while (hour <= 23 && predictedCount < MAX_GAMES) {
//       const games = fixtures.filter(g => !isWomenGame(g) && isGameAtExactHour(g, hour));

//       for (const game of games) {
//         if (predictedCount >= MAX_GAMES) break;

//         const home = game.event_home_team;
//         const away = game.event_away_team;
//         const time = moment
//           .tz(`${game.event_date} ${game.event_time}`, "YYYY-MM-DD HH:mm", "UTC")
//           .tz("Africa/Lagos")
//           .format("HH:mm");

//         const data = await fetchPastGames(game.home_team_key, game.away_team_key);
//         if (!data || !data.firstTeamResults || !data.secondTeamResults) {
//           console.log(`⚠️ Skipping ${home} vs ${away} -- No past data`);
//           continue;
//         }

//         const totalsA = extractTotals(data.firstTeamResults);
//         const totalsB = extractTotals(data.secondTeamResults);
//         if (totalsA.length === 0 || totalsB.length === 0) {
//           console.log(`⚠️ Skipping ${home} vs ${away} -- Not enough valid scores`);
//           continue;
//         }

//         const medianA = weightedMedian(totalsA);
//         const medianB = weightedMedian(totalsB);
//         const predictedTotal = Math.round((medianA + medianB) / 2);
//         const leagueIsNBA = isNBA(game);
//         const range = getRange(predictedTotal, leagueIsNBA);

//         console.log(`${home} vs ${away} -- ${game.event_date} ${time} -- Predicted Range: ${range}`);
//         predictedCount++;
//       }

//       hour++;
//     }

//     dayOffset++;
//     hour = 0;
//   }

//   if (predictedCount === 0) {
//     console.log("\n⚠️ No valid games found for prediction.");
//   } else {
//     console.log(`\n✅ Total predicted games: ${predictedCount}`);
//   }
// }

// run();


// WINNING MARGIN
// livePredictWinningMargin.js
// const axios = require("axios");
// const moment = require("moment-timezone");
// require("dotenv").config();

// const API_KEY = process.env.ALLSPORTS_API_KEY;
// const MAX_GAMES = 40;
// const START_HOUR = 8;

// const MARGIN_BUCKETS = [
//   { min: 1, max: 5 },
//   { min: 6, max: 10 },
//   { min: 11, max: 15 },
//   { min: 16, max: 20 },
//   { min: 21, max: 25 },
//   { min: 26, max: 30 },
//   { min: 31, max: Infinity }
// ];

// function isWomenGame(game) {
//   const league = game.league_name?.toLowerCase() || "";
//   const home = game.event_home_team?.toLowerCase() || "";
//   const away = game.event_away_team?.toLowerCase() || "";
//   return league.includes("women") || home.includes(" w") || away.includes(" w");
// }

// function isGameAtExactHour(game, hour) {
//   const gameTime = moment
//     .tz(`${game.event_date} ${game.event_time}`, "YYYY-MM-DD HH:mm", "UTC")
//     .tz("Africa/Lagos");
//   return gameTime.hour() === hour;
// }

// function getMarginBucket(diff) {
//   for (const bucket of MARGIN_BUCKETS) {
//     if (diff >= bucket.min && diff <= bucket.max) {
//       return `${bucket.min}-${bucket.max === Infinity ? "30+" : bucket.max}`;
//     }
//   }
//   return "Unknown";
// }

// function extractMargins(games, teamKey) {
//   const margins = [];
//   games.slice(0, 20).forEach((game) => {
//     if (!game.event_final_result || !game.event_final_result.includes("-")) return;
//     const [home, away] = game.event_final_result.split("-").map(Number);
//     if (isNaN(home) || isNaN(away)) return;
//     const isHome = teamKey === game.home_team_key;
//     const teamScore = isHome ? home : away;
//     const opponentScore = isHome ? away : home;
//     const margin = Math.abs(teamScore - opponentScore);
//     const won = teamScore > opponentScore;
//     if (won) margins.push(margin);
//   });
//   return margins;
// }

// function weightedMedian(scores) {
//   if (scores.length === 0) return 0;
//   const weighted = [];
//   const weights = [20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1];
//   scores.slice(0, 20).forEach((score, index) => {
//     for (let i = 0; i < weights[index]; i++) {
//       weighted.push(score);
//     }
//   });
//   const sorted = weighted.sort((a, b) => a - b);
//   const mid = Math.floor(sorted.length / 2);
//   return sorted.length % 2 !== 0
//     ? sorted[mid]
//     : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
// }

// async function fetchFixturesByDate(date) {
//   const url = `https://apiv2.allsportsapi.com/basketball/?met=Fixtures&APIkey=${API_KEY}&from=${date}&to=${date}`;
//   try {
//     const res = await axios.get(url);
//     return res.data.result || [];
//   } catch (err) {
//     console.error("❌ Failed to fetch fixtures:", err.message);
//     return [];
//   }
// }

// async function fetchPastGames(teamA, teamB) {
//   const url = `https://apiv2.allsportsapi.com/basketball/?met=H2H&APIkey=${API_KEY}&firstTeamId=${teamA}&secondTeamId=${teamB}`;
//   try {
//     const res = await axios.get(url);
//     return res.data.result;
//   } catch (err) {
//     return null;
//   }
// }

// function calculateStats(games, teamKey) {
//   let wins = 0, totalScored = 0, totalConceded = 0;

//   games.forEach((g) => {
//     if (!g.event_final_result || !g.event_final_result.includes("-")) return;
//     const [home, away] = g.event_final_result.split("-").map(Number);
//     const isHome = teamKey === g.home_team_key;
//     const teamScore = isHome ? home : away;
//     const opponentScore = isHome ? away : home;
//     if (isNaN(teamScore) || isNaN(opponentScore)) return;
//     totalScored += teamScore;
//     totalConceded += opponentScore;
//     if (teamScore > opponentScore) wins++;
//   });

//   const count = games.length || 1;
//   return {
//     count,
//     winRate: (wins / count).toFixed(2),
//     avgScored: (totalScored / count).toFixed(1),
//     avgConceded: (totalConceded / count).toFixed(1)
//   };
// }

// async function run() {
//   console.log(`\n📊 Predicting WINNER + MARGIN from ${START_HOUR}:00 WAT (hour-by-hour)`);

//   let predictedCount = 0;
//   let currentDate = moment().tz("Africa/Lagos")
//   let currentHour = START_HOUR;

//   while (predictedCount < MAX_GAMES) {
//     const dateStr = currentDate.format("YYYY-MM-DD");
//     const fixtures = await fetchFixturesByDate(dateStr);

//     while (currentHour <= 23 && predictedCount < MAX_GAMES) {
//       const games = fixtures.filter(g => !isWomenGame(g) && isGameAtExactHour(g, currentHour));

//       for (const game of games) {
//         if (predictedCount >= MAX_GAMES) break;

//         const home = game.event_home_team;
//         const away = game.event_away_team;
//         const time = moment
//           .tz(`${game.event_date} ${game.event_time}`, "YYYY-MM-DD HH:mm", "UTC")
//           .tz("Africa/Lagos")
//           .format("HH:mm");

//         const data = await fetchPastGames(game.home_team_key, game.away_team_key);
//         if (!data || !data.firstTeamResults || !data.secondTeamResults) {
//           console.log(`⚠️ Skipping ${home} vs ${away} -- No past data`);
//           continue;
//         }

//         const statsA = calculateStats(data.firstTeamResults, game.home_team_key);
//         const statsB = calculateStats(data.secondTeamResults, game.away_team_key);

//         const scoreA =
//           parseFloat(statsA.winRate) * 2 +
//           parseFloat(statsA.avgScored) * 0.5 -
//           parseFloat(statsA.avgConceded) * 0.3;

//         const scoreB =
//           parseFloat(statsB.winRate) * 2 +
//           parseFloat(statsB.avgScored) * 0.5 -
//           parseFloat(statsB.avgConceded) * 0.3;

//         const predictedWinner = scoreA >= scoreB ? home : away;

//         const marginsA = extractMargins(data.firstTeamResults, game.home_team_key);
//         const marginsB = extractMargins(data.secondTeamResults, game.away_team_key);
//         const medA = weightedMedian(marginsA);
//         const medB = weightedMedian(marginsB);

//         let marginScore = (
//           (medA * parseFloat(statsA.winRate) + medB * parseFloat(statsB.winRate)) /
//           (parseFloat(statsA.winRate) + parseFloat(statsB.winRate) || 1)
//         );

//         const scoringGap =
//           (parseFloat(statsA.avgScored) - parseFloat(statsB.avgConceded)) -
//           (parseFloat(statsB.avgScored) - parseFloat(statsA.avgConceded));

//         marginScore += scoringGap * 0.3;

//         let predictedMargin = Math.max(1, Math.round(marginScore));
//         const confidence = (Math.min(statsA.count, statsB.count) >= 7) ? "HIGH" : "LOW";

//         if (confidence === "LOW" && predictedMargin > 20) {
//           predictedMargin = 15 + Math.floor(Math.random() * 5);
//         }

//         if (
//           predictedMargin > 30 &&
//           (scoreA >= scoreB ? statsA.winRate : statsB.winRate) > 0.75 &&
//           (scoreA >= scoreB ? statsB.avgConceded : statsA.avgConceded) > 85
//         ) {
//           predictedMargin = 31;
//         }

//         const marginBucket = getMarginBucket(predictedMargin);

//         console.log(`${home} vs ${away} — ${game.event_date} ${time}`);
//         console.log(`🔹 Predicted Winner: ${predictedWinner} | Margin: ${marginBucket} | Confidence: ${confidence}`);
//         console.log(`🔸 ${home} [WR: ${statsA.winRate}, AVG: ${statsA.avgScored}, CONC: ${statsA.avgConceded}, MedMG: ${medA}]`);
//         console.log(`🔸 ${away} [WR: ${statsB.winRate}, AVG: ${statsB.avgScored}, CONC: ${statsB.avgConceded}, MedMG: ${medB}]\n`);

//         predictedCount++;
//       }

//       currentHour++;
//     }

//     currentDate.add(1, "day");
//     currentHour = 0; // reset to 0 after the first day
//   }

//   console.log(`\n✅ Total predicted games: ${predictedCount}`);
// }

// run();



// ODD OR EVEN
// predictOddEvenModel.js
// const axios = require("axios");
// const moment = require("moment-timezone");
// require("dotenv").config();

// const API_KEY = process.env.ALLSPORTS_API_KEY;
// const MAX_GAMES = 40;
// const START_HOUR = 18;

// function isWomenGame(game) {
//   const league = game.league_name?.toLowerCase() || "";
//   const home = game.event_home_team?.toLowerCase() || "";
//   const away = game.event_away_team?.toLowerCase() || "";
//   return league.includes("women") || home.includes(" w") || away.includes(" w");
// }

// function isGameAtExactHour(game, hour) {
//   const gameTime = moment
//     .tz(`${game.event_date} ${game.event_time}`, "YYYY-MM-DD HH:mm", "UTC")
//     .tz("Africa/Lagos");
//   return gameTime.hour() === hour;
// }

// function weightedMedian(scores) {
//   const weighted = [];
//   const weights = [1, 2, 3, 4, 5];
//   scores.slice(0, 5).forEach((score, index) => {
//     for (let i = 0; i < weights[index]; i++) {
//       weighted.push(score);
//     }
//   });
//   const sorted = weighted.sort((a, b) => a - b);
//   const mid = Math.floor(sorted.length / 2);
//   return sorted.length % 2 !== 0
//     ? sorted[mid]
//     : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
// }

// function extractTotals(games) {
//   const totals = [];
//   games.slice(0, 5).forEach(game => {
//     if (!game.event_final_result || !game.event_final_result.includes("-")) return;
//     const [home, away] = game.event_final_result.split("-").map(Number);
//     if (!isNaN(home) && !isNaN(away)) totals.push(home + away);
//   });
//   return totals;
// }

// async function fetchFixturesByDate(date) {
//   const url = `https://apiv2.allsportsapi.com/basketball/?met=Fixtures&APIkey=${API_KEY}&from=${date}&to=${date}`;
//   try {
//     const res = await axios.get(url);
//     return res.data.result || [];
//   } catch (err) {
//     console.error("❌ Failed to fetch fixtures:", err.message);
//     return [];
//   }
// }

// async function fetchPastGames(teamA, teamB) {
//   const url = `https://apiv2.allsportsapi.com/basketball/?met=H2H&APIkey=${API_KEY}&firstTeamId=${teamA}&secondTeamId=${teamB}`;
//   try {
//     const res = await axios.get(url);
//     return res.data.result;
//   } catch (err) {
//     return null;
//   }
// }

// async function run() {
//   console.log(`\n📊 Predicting ODD or EVEN TOTAL from ${START_HOUR}:00 WAT:`);

//   let predictedCount = 0;
//   let dayOffset = 0;
//   let hour = START_HOUR;

//   while (predictedCount < MAX_GAMES && dayOffset < 3) {
//     const date = moment().tz("Africa/Lagos").add(dayOffset, "days").format("YYYY-MM-DD");
//     const fixtures = await fetchFixturesByDate(date);

//     while (hour <= 23 && predictedCount < MAX_GAMES) {
//       const games = fixtures.filter(g => !isWomenGame(g) && isGameAtExactHour(g, hour));

//       for (const game of games) {
//         if (predictedCount >= MAX_GAMES) break;

//         const home = game.event_home_team;
//         const away = game.event_away_team;
//         const time = moment
//           .tz(`${game.event_date} ${game.event_time}`, "YYYY-MM-DD HH:mm", "UTC")
//           .tz("Africa/Lagos")
//           .format("HH:mm");

//         const data = await fetchPastGames(game.home_team_key, game.away_team_key);
//         if (!data || !data.firstTeamResults || !data.secondTeamResults) {
//           console.log(`⚠️ Skipping ${home} vs ${away} -- No past data`);
//           continue;
//         }

//         const totalsA = extractTotals(data.firstTeamResults);
//         const totalsB = extractTotals(data.secondTeamResults);

//         if (totalsA.length === 0 || totalsB.length === 0) {
//           console.log(`⚠️ Skipping ${home} vs ${away} -- Not enough valid scores`);
//           continue;
//         }

//         const medianA = weightedMedian(totalsA);
//         const medianB = weightedMedian(totalsB);
//         const combinedTotal = Math.round((medianA + medianB) / 2);
//         const prediction = combinedTotal % 2 === 0 ? "EVEN" : "ODD";

//         console.log(`${home} vs ${away} -- ${game.event_date} ${time} -- Predicted: ${prediction}`);
//         predictedCount++;
//       }

//       hour++;
//     }

//     dayOffset++;
//     hour = 0;
//   }

//   if (predictedCount === 0) {
//     console.log("\n⚠️ No valid games found for prediction.");
//   } else {
//     console.log(`\n✅ Total predicted games: ${predictedCount}`);
//   }
// }

// run();


// HIGHEST QUARTER 
// 📁 predict_highest_quarter.js

// const axios = require("axios");
// const moment = require("moment-timezone");
// require("dotenv").config();

// const API_KEY = process.env.ALLSPORTS_API_KEY;
// const MAX_GAMES = 40;
// const START_HOUR = 8;

// const TOP_LEAGUE_IDS = [766, 759, 757, 756, 1128, 764];

// function isTopLeague(game) {
//   return TOP_LEAGUE_IDS.includes(game.league_key);
// }

// function isWomenGame(game) {
//   const league = game.league_name?.toLowerCase() || "";
//   const home = game.event_home_team?.toLowerCase() || "";
//   const away = game.event_away_team?.toLowerCase() || "";
//   return league.includes("women") || home.includes(" w") || away.includes(" w");
// }

// function isGameAtExactHour(game, hour) {
//   const gameTime = moment
//     .tz(`${game.event_date} ${game.event_time}`, "YYYY-MM-DD HH:mm", "UTC")
//     .tz("Africa/Lagos");
//   return gameTime.hour() === hour;
// }

// function weightedMedian(arr, weights) {
//   if (arr.length === 0) return 0;
//   const sorted = arr.map((v, i) => ({ value: v, weight: weights[i] }))
//                     .sort((a, b) => a.value - b.value);
//   const totalWeight = sorted.reduce((acc, el) => acc + el.weight, 0);
//   let cumulative = 0;
//   for (let i = 0; i < sorted.length; i++) {
//     cumulative += sorted[i].weight;
//     if (cumulative >= totalWeight / 2) {
//       return sorted[i].value;
//     }
//   }
//   return sorted[sorted.length - 1].value;
// }

// function extractQuarterPointsSmart(games, teamKey) {
//   const quarters = { q1: [], q2: [], q3: [], q4: [] };
//   const weights = [];
//   const totalFinalScores = [];

//   games.slice(0, 7).forEach((game, idx) => {
//     const scores = game.scores;
//     if (!scores || !scores["1stQuarter"] || !scores["2ndQuarter"] || !scores["3rdQuarter"] || !scores["4thQuarter"]) return;

//     const isHome = teamKey === game.home_team_key;

//     const q1 = scores["1stQuarter"]?.[0];
//     const q2 = scores["2ndQuarter"]?.[0];
//     const q3 = scores["3rdQuarter"]?.[0];
//     const q4 = scores["4thQuarter"]?.[0];

//     if (!q1 || !q2 || !q3 || !q4) return;

//     const ptsQ1 = isHome ? parseInt(q1.score_home) : parseInt(q1.score_away);
//     const ptsQ2 = isHome ? parseInt(q2.score_home) : parseInt(q2.score_away);
//     const ptsQ3 = isHome ? parseInt(q3.score_home) : parseInt(q3.score_away);
//     const ptsQ4 = isHome ? parseInt(q4.score_home) : parseInt(q4.score_away);

//     if ([ptsQ1, ptsQ2, ptsQ3, ptsQ4].some(pts => isNaN(pts) || pts === 0)) return;

//     const finalScore = (isHome ? parseInt(game.event_final_result?.split(" - ")[0]) : parseInt(game.event_final_result?.split(" - ")[1])) || 0;
//     if (finalScore) totalFinalScores.push(finalScore);

//     let weight = 1;
//     if (idx < 2) weight = 2.0;
//     else if (idx < 5) weight = 1.5;

//     quarters.q1.push(ptsQ1);
//     quarters.q2.push(ptsQ2);
//     quarters.q3.push(ptsQ3);
//     quarters.q4.push(ptsQ4);

//     weights.push(weight);
//   });

//   return { quarters, weights, totalFinalScores };
// }

// async function fetchLastFixtures(teamKey) {
//   const today = moment().format("YYYY-MM-DD");
//   const seasonStart = "2024-10-01"; 
//   const url = `https://apiv2.allsportsapi.com/basketball/?met=Fixtures&teamId=${teamKey}&APIkey=${API_KEY}&from=${seasonStart}&to=${today}`;
//   try {
//     const res = await axios.get(url);
//     return res.data.result || [];
//   } catch {
//     return null;
//   }
// }

// async function fetchFixturesByDate(date) {
//   const url = `https://apiv2.allsportsapi.com/basketball/?met=Fixtures&APIkey=${API_KEY}&from=${date}&to=${date}`;
//   const res = await axios.get(url);
//   return res.data.result || [];
// }

// function determineActualHighestQuarter(scores) {
//   if (!scores) return null;
//   const quarters = ["1stQuarter", "2ndQuarter", "3rdQuarter", "4thQuarter"];
//   let maxPts = -1;
//   let highestQ = null;

//   quarters.forEach((q, idx) => {
//     const quarter = scores[q]?.[0];
//     if (quarter) {
//       const total = parseInt(quarter.score_home) + parseInt(quarter.score_away);
//       if (total > maxPts) {
//         maxPts = total;
//         highestQ = idx + 1;
//       }
//     }
//   });

//   return highestQ;
// }

// async function run() {
//   console.log(`\n📊 Predicting HIGHEST SCORING QUARTER (Dynamic Final Pro Version) 🔥\n`);

//   let predictedCount = 0;
//   let correct = 0;

//   let dayOffset = 1;
//   let currentHour = START_HOUR;

//   while (predictedCount < MAX_GAMES && dayOffset <= 7) {
//     const date = moment().tz("Africa/Lagos").subtract(dayOffset, "day").format("YYYY-MM-DD");
//     console.log(`📅 Scanning games for ${date}...`);

//     const fixtures = await fetchFixturesByDate(date);

//     while (currentHour <= 23 && predictedCount < MAX_GAMES) {
//       const games = fixtures.filter(g => isTopLeague(g) && !isWomenGame(g) && isGameAtExactHour(g, currentHour));

//       for (const game of games) {
//         if (predictedCount >= MAX_GAMES) break;
//         if (!game.scores) continue;

//         const homeGames = await fetchLastFixtures(game.home_team_key);
//         const awayGames = await fetchLastFixtures(game.away_team_key);

//         if (!homeGames || !awayGames || homeGames.length === 0 || awayGames.length === 0) continue;

//         const homeData = extractQuarterPointsSmart(homeGames, game.home_team_key);
//         const awayData = extractQuarterPointsSmart(awayGames, game.away_team_key);

//         const combinedFinalScores = homeData.totalFinalScores.concat(awayData.totalFinalScores);
//         const avgFinalScore = combinedFinalScores.length ? combinedFinalScores.reduce((a, b) => a + b, 0) / combinedFinalScores.length : 0;

//         const isFastTeam = avgFinalScore > 100;

//         const finalMedians = {
//           q1: weightedMedian(homeData.quarters.q1.concat(awayData.quarters.q1), [...homeData.weights, ...awayData.weights]),
//           q2: weightedMedian(homeData.quarters.q2.concat(awayData.quarters.q2), [...homeData.weights, ...awayData.weights]),
//           q3: weightedMedian(homeData.quarters.q3.concat(awayData.quarters.q3), [...homeData.weights, ...awayData.weights]),
//           q4: weightedMedian(homeData.quarters.q4.concat(awayData.quarters.q4), [...homeData.weights, ...awayData.weights]),
//         };

//         console.log(`${game.event_home_team} vs ${game.event_away_team} — ${game.event_date}`);
//         console.log(`   🧮 Weighted Medians:`, finalMedians);
//         console.log(`   ⚡ Avg Final Score: ${avgFinalScore} (Fast Team? ${isFastTeam})`);

//         if (isFastTeam) {
//           finalMedians.q1 += 0.5;
//         }

//         finalMedians.q2 += 0.5;
//         finalMedians.q4 += 0.5;

//         finalMedians.q2 += 0.5;
//         finalMedians.q4 += 0.5;

//         let sorted = Object.entries(finalMedians).sort((a, b) => b[1] - a[1]);
//         let predictedQ = sorted[0][0];
//         let secondQ = sorted[1][0];
//         let gap = sorted[0][1] - sorted[1][1];

//         if (gap < 3) {
//           if (predictedQ === 'q4' || predictedQ === 'q3') {
//             if (secondQ === 'q2' || secondQ === 'q1') {
//               predictedQ = secondQ;
//             }
//           }
//         }

//         const predictedQuarter = parseInt(predictedQ.replace("q", ""));
//         const actualQuarter = determineActualHighestQuarter(game.scores);

//         const time = moment
//           .tz(`${game.event_date} ${game.event_time}`, "YYYY-MM-DD HH:mm", "UTC")
//           .tz("Africa/Lagos")
//           .format("HH:mm");

//         console.log(`🔹 Predicted: ${predictedQuarter}Q | 🔸 Actual: ${actualQuarter}Q\n`);

//         if (predictedQuarter === actualQuarter) correct++;
//         predictedCount++;
//       }

//       currentHour++;
//     }

//     dayOffset++;
//     currentHour = 0;
//   }

//   console.log(`\n✅ Total predicted: ${predictedCount}`);
//   console.log(`🎯 Correct predictions: ${correct}`);
//   console.log(`📊 Accuracy: ${(100 * correct / predictedCount).toFixed(1)}%`);
// }

// run();
