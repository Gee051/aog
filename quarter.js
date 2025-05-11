const axios = require("axios");
const moment = require("moment-timezone");
require("dotenv").config();

const API_KEY = process.env.ALLSPORTS_API_KEY;
const MAX_GAMES = 40;
const START_HOUR = 1;

function isWomenGame(game) {
  const league = game.league_name?.toLowerCase() || "";
  const home = game.event_home_team?.toLowerCase() || "";
  const away = game.event_away_team?.toLowerCase() || "";
  return league.includes("women") || home.includes(" w") || away.includes(" w");
}

const leagueQuarterEvenStats = {
  "NBA": [0.45, 0.5, 0.6, 0.55],
  "Turkey Super League": [0.3, 0.35, 0.4, 0.7],
  "Spain Liga ACB": [0.4, 0.45, 0.5, 0.6],
  "Germany BBL": [0.35, 0.4, 0.5, 0.6],
  "France Pro A": [0.38, 0.42, 0.5, 0.63]
};

async function fetchFixturesByDate(dateStr) {
  const url = `https://apiv2.allsportsapi.com/basketball/?met=Fixtures&APIkey=${API_KEY}&from=${dateStr}&to=${dateStr}`;
  try {
    const res = await axios.get(url);
    return res.data.result || [];
  } catch (err) {
    console.error("❌ Failed to fetch fixtures:", err.message);
    return [];
  }
}

async function fetchPastFixtures(teamKey) {
  const today = moment().format("YYYY-MM-DD");
  const seasonStart = "2024-10-01";
  const url = `https://apiv2.allsportsapi.com/basketball/?met=Fixtures&teamId=${teamKey}&APIkey=${API_KEY}&from=${seasonStart}&to=${today}`;
  try {
    const res = await axios.get(url);
    return res.data.result || [];
  } catch {
    return [];
  }
}

function calculateAvgQuarterPoints(games, teamKey) {
  const qScores = [[], [], [], []]; // Q1–Q4

  for (const game of games.slice(0, 5)) {
    const scores = game.scores;
    if (!scores) continue;

    const isHome = game.home_team_key === teamKey;
    const q1 = scores["1stQuarter"]?.[0];
    const q2 = scores["2ndQuarter"]?.[0];
    const q3 = scores["3rdQuarter"]?.[0];
    const q4 = scores["4thQuarter"]?.[0];
    if (!q1 || !q2 || !q3 || !q4) continue;

    qScores[0].push(isHome ? +q1.score_home : +q1.score_away);
    qScores[1].push(isHome ? +q2.score_home : +q2.score_away);
    qScores[2].push(isHome ? +q3.score_home : +q3.score_away);
    qScores[3].push(isHome ? +q4.score_home : +q4.score_away);
  }

  function median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  const finalStats = qScores.map(scores => {
    if (scores.length === 0) return 0;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return avg + median(scores); // combine average + median
  });

  return finalStats;
}

function distanceFromEven(n) {
  return Math.abs(n - Math.round(n / 2) * 2); // 0 = even, 1 = odd
}

function getActualEvenQuarters(scores) {
  const actual = [];

  for (let i = 1; i <= 4; i++) {
    const label = `${i}stQuarter`;
    const key = scores[label] || scores[`${i}ndQuarter`] || scores[`${i}rdQuarter`] || scores[`${i}thQuarter`];
    if (!key || !key[0]) continue;
    const total = +key[0].score_home + +key[0].score_away;
    if (total % 2 === 0) actual.push(i);
  }

  return actual;
}

async function run() {
  const date = moment().tz("Africa/Lagos").subtract(1, "day").format("YYYY-MM-DD");
  const rawFixtures = await fetchFixturesByDate(date);
  let correct = 0, total = 0;

  const fixtures = rawFixtures
    .map(g => {
      const localTime = moment.tz(`${g.event_date} ${g.event_time}`, "YYYY-MM-DD HH:mm", "UTC").tz("Africa/Lagos");
      return { ...g, localTime };
    })
    .filter(g => g.localTime.hour() >= START_HOUR)
    .sort((a, b) => a.localTime - b.localTime);

  console.log(`\n📊 Predicting EVEN QUARTER with MEDIAN+AVG + LEAGUE TRENDS for ${date} (from ${START_HOUR}:00)\n`);

  for (const g of fixtures) {
    if (total >= MAX_GAMES) break;
    if (isWomenGame(g) || !g.home_team_key || !g.away_team_key || !g.scores) continue;

    const pastHome = await fetchPastFixtures(g.home_team_key);
    const pastAway = await fetchPastFixtures(g.away_team_key);
    if (!pastHome.length || !pastAway.length) continue;

    const hStats = calculateAvgQuarterPoints(pastHome, g.home_team_key);
    const aStats = calculateAvgQuarterPoints(pastAway, g.away_team_key);
    if (!hStats || !aStats) continue;

    const combined = hStats.map((val, idx) => val + aStats[idx]);
    const leagueName = g.league_name || "";
    const leagueTrend = leagueQuarterEvenStats[leagueName] || [0, 0, 0, 0];

    const quarterScores = combined.map((val, i) => {
      const teamConfidence = 1 - distanceFromEven(val);
      return teamConfidence + leagueTrend[i];
    });

    const sortedScores = quarterScores
      .map((score, i) => ({ index: i, score }))
      .sort((a, b) => b.score - a.score);

    const predictedIndex = sortedScores.length > 1 ? sortedScores[1].index : sortedScores[0].index;
    const predictedQuarter = predictedIndex + 1;

    const actualEvens = getActualEvenQuarters(g.scores);

    const time = g.localTime.format("HH:mm");
    const qScores = [];
    for (let i = 1; i <= 4; i++) {
      const key = g.scores[`${i}stQuarter`] || g.scores[`${i}ndQuarter`] || g.scores[`${i}rdQuarter`] || g.scores[`${i}thQuarter`];
      if (key && key[0]) {
        qScores.push(+key[0].score_home + +key[0].score_away);
      } else {
        qScores.push("N/A");
      }
    }

    console.log(`${g.event_home_team} vs ${g.event_away_team} — ${time}`);
    console.log(`🟦 Quarter Scores: Q1: ${qScores[0]}, Q2: ${qScores[1]}, Q3: ${qScores[2]}, Q4: ${qScores[3]}`);
    console.log(`🔹 Predicted Even Quarter: Q${predictedQuarter}`);
    console.log(`🔸 Actual Even Quarters: ${actualEvens.map(q => `Q${q}`).join(", ") || "None"}\n`);

    if (actualEvens.includes(predictedQuarter)) correct++;
    total++;
  }

  console.log(`\n✅ Total predicted: ${total}`);
  console.log(`🎯 Correct predictions: ${correct}`);
  console.log(`📊 Accuracy: ${(100 * correct / total).toFixed(1)}%`);
}

run();




// const axios = require("axios");
// const moment = require("moment-timezone");
// require("dotenv").config();

// const API_KEY = process.env.ALLSPORTS_API_KEY;
// const MAX_GAMES = 40;
// const START_HOUR_TODAY = 9;

// function isWomenGame(game) {
//   const league = game.league_name?.toLowerCase() || "";
//   const home = game.event_home_team?.toLowerCase() || "";
//   const away = game.event_away_team?.toLowerCase() || "";
//   return league.includes("women") || home.includes(" w") || away.includes(" w");
// }

// const leagueQuarterEvenStats = {
//   "NBA": [0.45, 0.5, 0.6, 0.55],
//   "Turkey Super League": [0.3, 0.35, 0.4, 0.7],
//   "Spain Liga ACB": [0.4, 0.45, 0.5, 0.6],
//   "Germany BBL": [0.35, 0.4, 0.5, 0.6],
//   "France Pro A": [0.38, 0.42, 0.5, 0.63]
// };

// async function fetchFixturesByDate(dateStr) {
//   const url = `https://apiv2.allsportsapi.com/basketball/?met=Fixtures&APIkey=${API_KEY}&from=${dateStr}&to=${dateStr}`;
//   try {
//     const res = await axios.get(url);
//     return res.data.result || [];
//   } catch (err) {
//     console.error("❌ Failed to fetch fixtures:", err.message);
//     return [];
//   }
// }

// async function fetchPastFixtures(teamKey) {
//   const today = moment().format("YYYY-MM-DD");
//   const seasonStart = "2024-10-01";
//   const url = `https://apiv2.allsportsapi.com/basketball/?met=Fixtures&teamId=${teamKey}&APIkey=${API_KEY}&from=${seasonStart}&to=${today}`;
//   try {
//     const res = await axios.get(url);
//     return res.data.result || [];
//   } catch {
//     return [];
//   }
// }

// function calculateAvgQuarterPoints(games, teamKey) {
//   const qScores = [[], [], [], []];

//   for (const game of games.slice(0, 5)) {
//     const scores = game.scores;
//     if (!scores) continue;

//     const isHome = game.home_team_key === teamKey;
//     const q1 = scores["1stQuarter"]?.[0];
//     const q2 = scores["2ndQuarter"]?.[0];
//     const q3 = scores["3rdQuarter"]?.[0];
//     const q4 = scores["4thQuarter"]?.[0];
//     if (!q1 || !q2 || !q3 || !q4) continue;

//     qScores[0].push(isHome ? +q1.score_home : +q1.score_away);
//     qScores[1].push(isHome ? +q2.score_home : +q2.score_away);
//     qScores[2].push(isHome ? +q3.score_home : +q3.score_away);
//     qScores[3].push(isHome ? +q4.score_home : +q4.score_away);
//   }

//   function median(arr) {
//     const sorted = [...arr].sort((a, b) => a - b);
//     const mid = Math.floor(sorted.length / 2);
//     return sorted.length % 2 === 0
//       ? (sorted[mid - 1] + sorted[mid]) / 2
//       : sorted[mid];
//   }

//   const stats = qScores.map(scores => {
//     if (scores.length === 0) return 0;
//     const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
//     return avg + median(scores);
//   });

//   return stats;
// }

// function distanceFromEven(n) {
//   return Math.abs(n - Math.round(n / 2) * 2);
// }

// async function run() {
//   const todayDate = moment().tz("Africa/Lagos").format("YYYY-MM-DD");
//   const tomorrowDate = moment().tz("Africa/Lagos").add(1, "day").format("YYYY-MM-DD");

//   const todayFixtures = await fetchFixturesByDate(todayDate);
//   const tomorrowFixtures = await fetchFixturesByDate(tomorrowDate);

//   const allFixtures = [...todayFixtures, ...tomorrowFixtures].map(g => {
//     const localTime = moment.tz(`${g.event_date} ${g.event_time}`, "YYYY-MM-DD HH:mm", "UTC").tz("Africa/Lagos");
//     return { ...g, localTime };
//   });

//   const filteredFixtures = allFixtures
//     .filter(g => g.localTime.hour() >= (g.event_date === todayDate ? START_HOUR_TODAY : 0))
//     .sort((a, b) => a.localTime - b.localTime);

//   console.log(`\n📊 Predicting EVEN QUARTER starting from ${todayDate} through ${tomorrowDate}\n`);

//   let total = 0;

//   for (const g of filteredFixtures) {
//     if (total >= MAX_GAMES) break;
//     if (isWomenGame(g) || !g.home_team_key || !g.away_team_key) continue;

//     const pastHome = await fetchPastFixtures(g.home_team_key);
//     const pastAway = await fetchPastFixtures(g.away_team_key);
//     if (!pastHome.length || !pastAway.length) continue;

//     const hStats = calculateAvgQuarterPoints(pastHome, g.home_team_key);
//     const aStats = calculateAvgQuarterPoints(pastAway, g.away_team_key);
//     if (!hStats || !aStats) continue;

//     const combined = hStats.map((val, idx) => val + aStats[idx]);
//     const leagueName = g.league_name || "";
//     const leagueTrend = leagueQuarterEvenStats[leagueName] || [0, 0, 0, 0];

//     const quarterScores = combined.map((val, i) => {
//       const teamConfidence = 1 - distanceFromEven(val);
//       return teamConfidence + leagueTrend[i];
//     });

//     const sortedScores = quarterScores
//       .map((score, i) => ({ index: i, score }))
//       .sort((a, b) => b.score - a.score);

//     const predictedIndex = sortedScores.length > 1 ? sortedScores[1].index : sortedScores[0].index;
//     const predictedQuarter = predictedIndex + 1;

//     const time = g.localTime.format("YYYY-MM-DD HH:mm");
//     console.log(`${g.event_home_team} vs ${g.event_away_team} — ${time}`);
//     console.log(`🔹 Predicted EVEN Quarter: Q${predictedQuarter}`);
//     console.log(`📎 League: ${leagueName}`);
//     console.log("———————————————————————————————\n");

//     total++;
//   }

//   console.log(`\n✅ Total games predicted: ${total}/${MAX_GAMES}`);
// }

// run();
