const axios = require("axios");
const fs = require("fs");
const moment = require("moment-timezone");
require("dotenv").config();

const API_KEY = process.env.ALLSPORTS_API_KEY;
const MODEL_FILE = "marginModel.json";
const MAX_GAMES = 40;
const START_HOUR = 15;

const { RandomForestClassifier } = require("ml-random-forest");
const modelData = JSON.parse(fs.readFileSync(MODEL_FILE, "utf-8"));
const classifier = RandomForestClassifier.load(modelData);
const bucketLabels = modelData.bucketLabels;

function getMarginBucket(margin) {
  if (margin <= 5) return "1-5";
  if (margin <= 10) return "6-10";
  if (margin <= 15) return "11-15";
  if (margin <= 20) return "16-20";
  if (margin <= 25) return "21-25";
  if (margin <= 30) return "26-30";
  return "31+";
}

function isWomenGame(game) {
  const league = game.league_name?.toLowerCase() || "";
  const home = game.event_home_team?.toLowerCase() || "";
  const away = game.event_away_team?.toLowerCase() || "";
  return league.includes("women") || home.includes(" w") || away.includes(" w");
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

function calculateStats(games, teamKey) {
  const scored = [], conceded = [], margins = [];
  let wins = 0;

  games.slice(0, 10).forEach(g => {
    if (!g.event_final_result?.includes("-")) return;
    const [home, away] = g.event_final_result.split("-").map(Number);
    const isHome = teamKey === g.home_team_key;
    const teamScore = isHome ? home : away;
    const oppScore = isHome ? away : home;
    const margin = Math.abs(teamScore - oppScore);
    if (teamScore > oppScore) {
      margins.push(margin);
      wins++;
    }
    scored.push(teamScore);
    conceded.push(oppScore);
  });

  const avg = arr => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);

  return {
    winRate: wins / (games.length || 1),
    avgScored: avg(scored),
    avgConceded: avg(conceded),
    avgMargin: avg(margins)
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

  console.log(`\n📊 Predicting YESTERDAY'S GAMES (${dateStr}) from ${START_HOUR}:00 WAT\n`);

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

      const [homeScore, awayScore] = g.event_final_result.split("-").map(Number);
      const actualMargin = Math.abs(homeScore - awayScore);
      const actualBucket = getMarginBucket(actualMargin);

      const h2h = await fetchPastGames(g.home_team_key, g.away_team_key);
      if (!h2h?.firstTeamResults || !h2h?.secondTeamResults) continue;

      const statsA = calculateStats(h2h.firstTeamResults, g.home_team_key);
      const statsB = calculateStats(h2h.secondTeamResults, g.away_team_key);

      const offenseGap = statsA.avgScored - statsB.avgConceded;
      const marginDiff = statsA.avgMargin - statsB.avgMargin;
      const totalGap = (statsA.avgScored - statsB.avgConceded) - (statsB.avgScored - statsA.avgConceded);
      const powerScoreA = statsA.winRate * statsA.avgMargin;
      const defenseGap = statsB.avgConceded - statsA.avgConceded;
      const momentumScore = (statsA.avgScored / statsA.avgConceded) * statsA.winRate;
      const relativePower = (statsA.winRate * statsA.avgMargin) - (statsB.winRate * statsB.avgMargin);
      const combinedGap = statsA.avgScored - statsB.avgConceded + (statsA.winRate * statsA.avgMargin);
      const winRateDiff = statsA.winRate - statsB.winRate;

      const input = [
        +statsA.winRate.toFixed(2),
        +statsB.winRate.toFixed(2),
        +offenseGap.toFixed(1),
        +marginDiff.toFixed(1),
        +totalGap.toFixed(1),
        +powerScoreA.toFixed(1),
        +defenseGap.toFixed(1),
        +momentumScore.toFixed(2),
        +relativePower.toFixed(2),
        +combinedGap.toFixed(2),
        +winRateDiff.toFixed(2),
        1
      ];

      if (input.some(v => typeof v !== "number" || isNaN(v))) continue;

      const predictedIndex = classifier.predict([input])[0];
      const predictedBucket = bucketLabels[predictedIndex];
      const isCorrect = predictedBucket === actualBucket;

      if (isCorrect) correct++;
      predicted++;

      const time = moment
        .tz(`${g.event_date} ${g.event_time}`, "YYYY-MM-DD HH:mm", "UTC")
        .tz("Africa/Lagos")
        .format("HH:mm");

      console.log(`${g.event_home_team} vs ${g.event_away_team} — ${g.event_date} ${time}`);
      console.log(`🔹 Predicted: ${predictedBucket} | 🔸 Actual: ${actualBucket} | Margin: ${actualMargin}`);
    }
  }

  console.log(`\n✅ Total predicted: ${predicted}`);
  console.log(`🎯 Correct predictions: ${correct}`);
  console.log(`📊 Accuracy: ${(100 * correct / predicted).toFixed(1)}%`);
}

predictYesterday();


// const axios = require("axios");
// const fs = require("fs");
// const moment = require("moment-timezone");
// require("dotenv").config();

// const { RandomForestClassifier } = require("ml-random-forest");

// const API_KEY = process.env.ALLSPORTS_API_KEY;
// const MODEL_FILE = "marginModel.json";
// const MAX_GAMES = 40;
// const START_HOUR = 8;

// const modelData = JSON.parse(fs.readFileSync(MODEL_FILE, "utf-8"));
// const classifier = RandomForestClassifier.load(modelData);
// const bucketLabels = modelData.bucketLabels;

// function getMarginBucket(margin) {
//   if (margin <= 5) return "1-5";
//   if (margin <= 10) return "6-10";
//   if (margin <= 15) return "11-15";
//   if (margin <= 20) return "16-20";
//   if (margin <= 25) return "21-25";
//   if (margin <= 30) return "26-30";
//   return "31+";
// }

// function isWomenGame(game) {
//   const league = game.league_name?.toLowerCase() || "";
//   const home = game.event_home_team?.toLowerCase() || "";
//   const away = game.event_away_team?.toLowerCase() || "";
//   return league.includes("women") || home.includes(" w") || away.includes(" w");
// }

// async function fetchFixtures(dateStr) {
//   const url = `https://apiv2.allsportsapi.com/basketball/?met=Fixtures&APIkey=${API_KEY}&from=${dateStr}&to=${dateStr}`;
//   try {
//     const res = await axios.get(url);
//     return res.data.result || [];
//   } catch {
//     return [];
//   }
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

// function calculateStats(games, teamKey) {
//   const scored = [], conceded = [], margins = [];
//   let wins = 0;

//   games.slice(0, 10).forEach(g => {
//     if (!g.event_final_result?.includes("-")) return;
//     const [home, away] = g.event_final_result.split("-").map(Number);
//     const isHome = teamKey === g.home_team_key;
//     const teamScore = isHome ? home : away;
//     const oppScore = isHome ? away : home;
//     const margin = Math.abs(teamScore - oppScore);
//     if (teamScore > oppScore) {
//       margins.push(margin);
//       wins++;
//     }
//     scored.push(teamScore);
//     conceded.push(oppScore);
//   });

//   const avg = arr => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);

//   return {
//     winRate: wins / (games.length || 1),
//     avgScored: avg(scored),
//     avgConceded: avg(conceded),
//     avgMargin: avg(margins)
//   };
// }

// async function predictHourly() {
//   const today = moment().tz("Africa/Lagos");
//   const tomorrow = today.clone().add(1, "day");

//   const dates = [
//     { label: "TODAY", date: today.format("YYYY-MM-DD"), startHour: START_HOUR },
//     { label: "TOMORROW", date: tomorrow.format("YYYY-MM-DD"), startHour: 0 }
//   ];

//   let predicted = 0;

//   for (const { label, date, startHour } of dates) {
//     const fixtures = await fetchFixtures(date);

//     console.log(`\n📊 Predicting from ${label} ${date} starting at ${startHour}:00 WAT\n`);

//     for (let hour = startHour; hour <= 23 && predicted < MAX_GAMES; hour++) {
//       const games = fixtures.filter(g => {
//         const gameTime = moment
//           .tz(`${g.event_date} ${g.event_time}`, "YYYY-MM-DD HH:mm", "UTC")
//           .tz("Africa/Lagos");
//         return !isWomenGame(g) && gameTime.hour() === hour;
//       });

//       for (const g of games) {
//         if (predicted >= MAX_GAMES) break;

//         const h2h = await fetchPastGames(g.home_team_key, g.away_team_key);
//         if (!h2h?.firstTeamResults || !h2h?.secondTeamResults) continue;

//         const statsA = calculateStats(h2h.firstTeamResults, g.home_team_key);
//         const statsB = calculateStats(h2h.secondTeamResults, g.away_team_key);
//         if (!statsA || !statsB) continue;

//         const offenseGap = statsA.avgScored - statsB.avgConceded;
//         const marginDiff = statsA.avgMargin - statsB.avgMargin;
//         const totalGap = (statsA.avgScored - statsB.avgConceded) - (statsB.avgScored - statsA.avgConceded);
//         const powerScoreA = statsA.winRate * statsA.avgMargin;
//         const defenseGap = statsB.avgConceded - statsA.avgConceded;
//         const momentumScore = (statsA.avgScored / statsA.avgConceded) * statsA.winRate;
//         const relativePower = (statsA.winRate * statsA.avgMargin) - (statsB.winRate * statsB.avgMargin);
//         const combinedGap = statsA.avgScored - statsB.avgConceded + (statsA.winRate * statsA.avgMargin);
//         const winRateDiff = statsA.winRate - statsB.winRate;

//         const input = [
//           +statsA.winRate.toFixed(2),
//           +statsB.winRate.toFixed(2),
//           +offenseGap.toFixed(1),
//           +marginDiff.toFixed(1),
//           +totalGap.toFixed(1),
//           +powerScoreA.toFixed(1),
//           +defenseGap.toFixed(1),
//           +momentumScore.toFixed(2),
//           +relativePower.toFixed(2),
//           +combinedGap.toFixed(2),
//           +winRateDiff.toFixed(2),
//           1
//         ];

//         if (input.some(v => typeof v !== "number" || isNaN(v))) continue;

//         const predictedIndex = classifier.predict([input])[0];
//         const predictedBucket = bucketLabels[predictedIndex];

//         const gameTime = moment
//           .tz(`${g.event_date} ${g.event_time}`, "YYYY-MM-DD HH:mm", "UTC")
//           .tz("Africa/Lagos")
//           .format("HH:mm");

//         console.log(`${g.event_home_team} vs ${g.event_away_team} — ${g.event_date} ${gameTime}`);
//         console.log(`🔹 Predicted Margin Bucket: ${predictedBucket}\n`);

//         predicted++;
//       }
//     }

//     if (predicted >= MAX_GAMES) break;
//   }

//   console.log(`\n✅ Total predicted: ${predicted}`);
// }

// predictHourly();
