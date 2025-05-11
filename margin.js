const axios = require("axios");
const moment = require("moment-timezone");
require("dotenv").config();

const API_KEY = process.env.ALLSPORTS_API_KEY;
const MAX_GAMES = 40;
const MARGIN_THRESHOLD = 6;
const GAME_LIMIT = 10;

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

function calculateTeamStats(games, teamKey) {
  let wins = 0, scored = 0, conceded = 0, marginSum = 0;

  for (const g of games.slice(0, GAME_LIMIT)) {
    if (!g.event_final_result) continue;

    const parts = g.event_final_result.split("-");
    if (parts.length !== 2) continue;

    const homePts = parseInt(parts[0]);
    const awayPts = parseInt(parts[1]);
    if (isNaN(homePts) || isNaN(awayPts)) continue;

    const isHome = g.home_team_key === teamKey;
    const teamScore = isHome ? homePts : awayPts;
    const oppScore = isHome ? awayPts : homePts;
    const margin = teamScore - oppScore;

    scored += teamScore;
    conceded += oppScore;
    if (margin > 0) wins++;
    if (margin > 0 && Math.abs(margin) >= MARGIN_THRESHOLD) {
      marginSum += margin;
    }
  }

  return {
    avgScored: scored / GAME_LIMIT,
    avgConceded: conceded / GAME_LIMIT,
    netScore: (scored - conceded) / GAME_LIMIT,
    winRate: wins / GAME_LIMIT,
    avgMargin: marginSum / GAME_LIMIT
  };
}

function getActualOutcome(game) {
  if (!game.event_final_result) return null;

  const [home, away] = game.event_final_result.split("-").map(x => parseInt(x));
  if (isNaN(home) || isNaN(away)) return null;

  const diff = Math.abs(home - away);
  if (home > away && diff >= MARGIN_THRESHOLD) return "HOME 6+";
  if (away > home && diff >= MARGIN_THRESHOLD) return "AWAY 6+";
  return "NEITHER";
}

async function run() {
  const date = moment().tz("Africa/Lagos").subtract(1, "day").format("YYYY-MM-DD");
  const fixtures = await fetchFixturesByDate(date);
  let correct = 0, total = 0;

  console.log(`\n📊 Predicting WINNING MARGIN 6+ for ${date} 🔥\n`);

  for (const g of fixtures) {
    if (total >= MAX_GAMES) break;
    if (isWomenGame(g) || !g.home_team_key || !g.away_team_key || !g.event_final_result) continue;

    const pastHome = await fetchPastFixtures(g.home_team_key);
    const pastAway = await fetchPastFixtures(g.away_team_key);
    if (!pastHome.length || !pastAway.length) continue;

    const homeStats = calculateTeamStats(pastHome, g.home_team_key);
    const awayStats = calculateTeamStats(pastAway, g.away_team_key);

    const homeStrength = homeStats.netScore + homeStats.avgMargin + homeStats.winRate;
    const awayStrength = awayStats.netScore + awayStats.avgMargin + awayStats.winRate;

    let predicted;
    const diff = Math.abs(homeStrength - awayStrength);

    if (diff >= 1.5) {
      predicted = homeStrength > awayStrength ? "HOME 6+" : "AWAY 6+";
    } else {
      predicted = "NEITHER";
    }

    const actual = getActualOutcome(g);
    if (!actual) continue;

    const time = moment
      .tz(`${g.event_date} ${g.event_time}`, "YYYY-MM-DD HH:mm", "UTC")
      .tz("Africa/Lagos")
      .format("HH:mm");

    console.log(`${g.event_home_team} vs ${g.event_away_team} — ${time}`);
    console.log(`🔹 Predicted: ${predicted}`);
    console.log(`🔸 Actual: ${actual}\n`);

    if (predicted === actual) correct++;
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
// const MARGIN_THRESHOLD = 6;
// const GAME_LIMIT = 10;
// const START_HOUR = 10;

// function isWomenGame(game) {
//   const league = game.league_name?.toLowerCase() || "";
//   const home = game.event_home_team?.toLowerCase() || "";
//   const away = game.event_away_team?.toLowerCase() || "";
//   return league.includes("women") || home.includes(" w") || away.includes(" w");
// }

// async function fetchFixturesByRange(fromDate, toDate) {
//   const url = `https://apiv2.allsportsapi.com/basketball/?met=Fixtures&APIkey=${API_KEY}&from=${fromDate}&to=${toDate}`;
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

// function calculateTeamStats(games, teamKey) {
//   let wins = 0, scored = 0, conceded = 0, marginSum = 0;

//   for (const g of games.slice(0, GAME_LIMIT)) {
//     if (!g.event_final_result) continue;

//     const parts = g.event_final_result.split("-");
//     if (parts.length !== 2) continue;

//     const homePts = parseInt(parts[0]);
//     const awayPts = parseInt(parts[1]);
//     if (isNaN(homePts) || isNaN(awayPts)) continue;

//     const isHome = g.home_team_key === teamKey;
//     const teamScore = isHome ? homePts : awayPts;
//     const oppScore = isHome ? awayPts : homePts;
//     const margin = teamScore - oppScore;

//     scored += teamScore;
//     conceded += oppScore;
//     if (margin > 0) wins++;
//     if (margin > 0 && Math.abs(margin) >= MARGIN_THRESHOLD) {
//       marginSum += margin;
//     }
//   }

//   return {
//     avgScored: scored / GAME_LIMIT,
//     avgConceded: conceded / GAME_LIMIT,
//     netScore: (scored - conceded) / GAME_LIMIT,
//     winRate: wins / GAME_LIMIT,
//     avgMargin: marginSum / GAME_LIMIT
//   };
// }

// async function run() {
//   let predictedCount = 0;
//   const predictedKeys = new Set();
//   const baseDate = moment().tz("Africa/Lagos").startOf("day").add(START_HOUR, "hours");
//   const endDate = baseDate.clone().add(2, "days").format("YYYY-MM-DD");

//   const fixtures = await fetchFixturesByRange(baseDate.format("YYYY-MM-DD"), endDate);

//   const sortedFixtures = fixtures
//     .filter(g => !isWomenGame(g) && g.home_team_key && g.away_team_key)
//     .map(g => ({
//       ...g,
//       time: moment.tz(`${g.event_date} ${g.event_time}`, "YYYY-MM-DD HH:mm", "UTC").tz("Africa/Lagos")
//     }))
//     .filter(g => g.time.isSameOrAfter(baseDate))
//     .sort((a, b) => a.time - b.time);

//   console.log(`\n📊 Predicting WINNING MARGIN 6+ starting from ${baseDate.format("YYYY-MM-DD HH:mm")} 🔥\n`);

//   for (const g of sortedFixtures) {
//     if (predictedCount >= MAX_GAMES) break;

//     const pastHome = await fetchPastFixtures(g.home_team_key);
//     const pastAway = await fetchPastFixtures(g.away_team_key);
//     if (!pastHome.length || !pastAway.length) continue;

//     const homeStats = calculateTeamStats(pastHome, g.home_team_key);
//     const awayStats = calculateTeamStats(pastAway, g.away_team_key);

//     const homeStrength = homeStats.netScore + homeStats.avgMargin + homeStats.winRate;
//     const awayStrength = awayStats.netScore + awayStats.avgMargin + awayStats.winRate;

//     let predicted;
//     const diff = Math.abs(homeStrength - awayStrength);

//     if (diff >= 1.5) {
//       predicted = homeStrength > awayStrength ? "HOME 6+" : "AWAY 6+";
//     } else {
//       predicted = "NEITHER";
//     }

//     console.log(`${g.event_home_team} vs ${g.event_away_team} — ${g.time.format("YYYY-MM-DD HH:mm")}`);
//     console.log(`🔹 Predicted: ${predicted}\n`);

//     predictedCount++;
//   }

//   console.log(`\n✅ Total predicted: ${predictedCount}`);
// }

// run();
