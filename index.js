const axios = require("axios");
const moment = require("moment-timezone");
require("dotenv").config();

const API_KEY = process.env.ALLSPORTS_API_KEY;
const MAX_GAMES = 40;
const START_HOUR_TODAY = 9;
const MAX_DAYS_TO_CHECK = 5; 

function isWomenGame(game) {
  const league = game.league_name?.toLowerCase() || "";
  const home = game.event_home_team?.toLowerCase() || "";
  const away = game.event_away_team?.toLowerCase() || "";
  return league.includes("women") || home.includes(" w") || away.includes(" w");
}

async function fetchFixturesByDate(dateStr) {
  const url = `https://apiv2.allsportsapi.com/basketball/?met=Fixtures&APIkey=${API_KEY}&from=${dateStr}&to=${dateStr}`;
  try {
    const res = await axios.get(url);
    return res.data.result || [];
  } catch (err) {
    console.error(`❌ Failed to fetch fixtures for ${dateStr}:`, err.message);
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

function calculateAvgHalfPoints(games, teamKey) {
  let totalFH = 0, totalSH = 0, count = 0;

  for (const game of games.slice(0, 10)) {
    const scores = game.scores;
    if (!scores || !scores["1stQuarter"] || !scores["2ndQuarter"] || !scores["3rdQuarter"] || !scores["4thQuarter"]) continue;

    const isHome = game.home_team_key === teamKey;
    const q1 = scores["1stQuarter"]?.[0];
    const q2 = scores["2ndQuarter"]?.[0];
    const q3 = scores["3rdQuarter"]?.[0];
    const q4 = scores["4thQuarter"]?.[0];

    if (!q1 || !q2 || !q3 || !q4) continue;

    const fh = (isHome ? +q1.score_home : +q1.score_away) + (isHome ? +q2.score_home : +q2.score_away);
    const sh = (isHome ? +q3.score_home : +q3.score_away) + (isHome ? +q4.score_home : +q4.score_away);

    if (!isNaN(fh) && !isNaN(sh)) {
      totalFH += fh;
      totalSH += sh;
      count++;
    }
  }

  return { avgFH: totalFH / count, avgSH: totalSH / count };
}

async function run() {
  let total = 0;
  const allFixtures = [];

  for (let dayOffset = 0; dayOffset < MAX_DAYS_TO_CHECK; dayOffset++) {
    const date = moment().tz("Africa/Lagos").add(dayOffset, 'days').format("YYYY-MM-DD");
    const rawFixtures = await fetchFixturesByDate(date);

    const dailyFixtures = rawFixtures
      .map(g => {
        const localTime = moment.tz(`${g.event_date} ${g.event_time}`, "YYYY-MM-DD HH:mm", "UTC").tz("Africa/Lagos");
        return { ...g, localTime };
      })
      .filter(g => {
        if (dayOffset === 0) return g.localTime.hour() >= START_HOUR_TODAY;
        return true;
      });

    allFixtures.push(...dailyFixtures);
  }

  // Sort all across days chronologically
  const sortedFixtures = allFixtures
    .filter(g => !isWomenGame(g) && g.home_team_key && g.away_team_key)
    .sort((a, b) => a.localTime - b.localTime);

  console.log(`\n📊 Predicting HIGHEST SCORING HALF (starting from today ${START_HOUR_TODAY}:00 WAT) 🔥\n`);

  for (const g of sortedFixtures) {
    if (total >= MAX_GAMES) break;

    const pastHome = await fetchPastFixtures(g.home_team_key);
    const pastAway = await fetchPastFixtures(g.away_team_key);
    if (!pastHome.length || !pastAway.length) continue;

    const hStats = calculateAvgHalfPoints(pastHome, g.home_team_key);
    const aStats = calculateAvgHalfPoints(pastAway, g.away_team_key);
    if (!hStats.avgFH || !aStats.avgFH || !hStats.avgSH || !aStats.avgSH) continue;

    const predFH = hStats.avgFH + aStats.avgFH;
    const predSH = hStats.avgSH + aStats.avgSH;
    const predicted = predFH > predSH ? "1st Half" : "2nd Half";

    const timeFormatted = g.localTime.format("YYYY-MM-DD HH:mm");

    console.log(`${g.event_home_team} vs ${g.event_away_team} — ${timeFormatted}`);
    console.log(`🔹 Predicted: ${predicted}\n`);

    total++;
  }

  console.log(`\n📊 Predictions made: ${total}`);
  console.log(`⏳ Accuracy will be evaluated after matches are completed.`);
}

run();





// const axios = require("axios");
// const moment = require("moment-timezone");
// require("dotenv").config();

// const API_KEY = process.env.ALLSPORTS_API_KEY;
// const MAX_GAMES = 40;
// const START_HOUR = 19; 

// function isWomenGame(game) {
//   const league = game.league_name?.toLowerCase() || "";
//   const home = game.event_home_team?.toLowerCase() || "";
//   const away = game.event_away_team?.toLowerCase() || "";
//   return league.includes("women") || home.includes(" w") || away.includes(" w");
// }

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

// function calculateAvgHalfPoints(games, teamKey) {
//   let totalFH = 0, totalSH = 0, count = 0;

//   for (const game of games.slice(0, 10)) {
//     const scores = game.scores;
//     if (!scores || !scores["1stQuarter"] || !scores["2ndQuarter"] || !scores["3rdQuarter"] || !scores["4thQuarter"]) continue;

//     const isHome = game.home_team_key === teamKey;
//     const q1 = scores["1stQuarter"]?.[0];
//     const q2 = scores["2ndQuarter"]?.[0];
//     const q3 = scores["3rdQuarter"]?.[0];
//     const q4 = scores["4thQuarter"]?.[0];

//     if (!q1 || !q2 || !q3 || !q4) continue;

//     const fh = (isHome ? +q1.score_home : +q1.score_away) + (isHome ? +q2.score_home : +q2.score_away);
//     const sh = (isHome ? +q3.score_home : +q3.score_away) + (isHome ? +q4.score_home : +q4.score_away);

//     if (!isNaN(fh) && !isNaN(sh)) {
//       totalFH += fh;
//       totalSH += sh;
//       count++;
//     }
//   }

//   return { avgFH: totalFH / count, avgSH: totalSH / count };
// }

// function actualHalfWinner(game) {
//   const s = game.scores;
//   if (!s || !s["1stQuarter"] || !s["2ndQuarter"] || !s["3rdQuarter"] || !s["4thQuarter"]) return null;

//   const q1 = s["1stQuarter"][0], q2 = s["2ndQuarter"][0], q3 = s["3rdQuarter"][0], q4 = s["4thQuarter"][0];

//   if (!q1 || !q2 || !q3 || !q4) return null;

//   const FH = +q1.score_home + +q1.score_away + +q2.score_home + +q2.score_away;
//   const SH = +q3.score_home + +q3.score_away + +q4.score_home + +q4.score_away;

//   return {
//     winner: FH > SH ? "1st Half" : SH > FH ? "2nd Half" : "Tie",
//     FH,
//     SH
//   };
// }

// async function run() {
//   const date = moment().tz("Africa/Lagos").subtract(1, "day").format("YYYY-MM-DD");
//   const rawFixtures = await fetchFixturesByDate(date);
//   let correct = 0, total = 0;

//   // Convert and sort by local Lagos time
//   const fixtures = rawFixtures
//     .map(g => {
//       const localTime = moment.tz(`${g.event_date} ${g.event_time}`, "YYYY-MM-DD HH:mm", "UTC").tz("Africa/Lagos");
//       return { ...g, localTime };
//     })
//     .filter(g => g.localTime.hour() >= START_HOUR)
//     .sort((a, b) => a.localTime - b.localTime);

//   console.log(`\n📊 Predicting HIGHEST SCORING HALF for ${date} (from ${START_HOUR}:00) 🔥\n`);

//   for (const g of fixtures) {
//     if (total >= MAX_GAMES) break;
//     if (isWomenGame(g) || !g.home_team_key || !g.away_team_key || !g.scores) continue;

//     const pastHome = await fetchPastFixtures(g.home_team_key);
//     const pastAway = await fetchPastFixtures(g.away_team_key);
//     if (!pastHome.length || !pastAway.length) continue;

//     const hStats = calculateAvgHalfPoints(pastHome, g.home_team_key);
//     const aStats = calculateAvgHalfPoints(pastAway, g.away_team_key);
//     if (!hStats.avgFH || !aStats.avgFH || !hStats.avgSH || !aStats.avgSH) continue;

//     const predFH = hStats.avgFH + aStats.avgFH;
//     const predSH = hStats.avgSH + aStats.avgSH;
//     const predicted = predFH > predSH ? "1st Half" : "2nd Half";

//     const time = g.localTime.format("HH:mm");
//     const actual = actualHalfWinner(g);
//     if (!actual) continue;

//     console.log(`${g.event_home_team} vs ${g.event_away_team} — ${time}`);
//     console.log(`🔹 Predicted: ${predicted}`);
//     console.log(`🔸 Actual: ${actual.winner} (FH: ${actual.FH}, SH: ${actual.SH})\n`);

//     if (predicted === actual.winner) correct++;
//     total++;
//   }

//   console.log(`\n✅ Total predicted: ${total}`);
//   console.log(`🎯 Correct predictions: ${correct}`);
//   console.log(`📊 Accuracy: ${(100 * correct / total).toFixed(1)}%`);
// }

// run();

