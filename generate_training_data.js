// =============================
// 📁 generate_training_data.js
// =============================

const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

const API_KEY = process.env.ALLSPORTS_API_KEY;
const OUTPUT_FILE = "./data/training.json";

const MARGIN_BUCKETS = [
  { min: 1, max: 5, label: "1-5" },
  { min: 6, max: 10, label: "6-10" },
  { min: 11, max: 15, label: "11-15" },
  { min: 16, max: 20, label: "16-20" },
  { min: 21, max: 25, label: "21-25" },
  { min: 26, max: 30, label: "26-30" },
  { min: 31, max: Infinity, label: "31+" },
];

function getMarginBucket(margin) {
  const bucket = MARGIN_BUCKETS.find(b => margin >= b.min && margin <= b.max);
  return bucket ? bucket.label : "unknown";
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
  let wins = 0, scored = 0, conceded = 0, winMargins = 0;

  games.slice(0, 10).forEach(g => {
    if (!g.event_final_result?.includes("-")) return;
    const [home, away] = g.event_final_result.split("-").map(Number);
    const isHome = teamKey === g.home_team_key;
    const teamScore = isHome ? home : away;
    const oppScore = isHome ? away : home;
    const margin = Math.abs(teamScore - oppScore);
    if (teamScore > oppScore) {
      winMargins += margin;
      wins++;
    }
    scored += teamScore;
    conceded += oppScore;
  });

  const count = games.length || 1;

  return {
    winRate: wins / count,
    avgScored: scored / count,
    avgConceded: conceded / count,
    avgMargin: winMargins / (wins || 1),
  };
}

function getDateRange(days = 5) {
  const today = new Date();
  const dates = [];
  for (let i = days; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

async function generateTrainingSet() {
  const allSamples = [];
  const dates = getDateRange(5);

  for (const date of dates) {
    const url = `https://apiv2.allsportsapi.com/basketball/?met=Fixtures&APIkey=${API_KEY}&from=${date}&to=${date}`;
    const res = await axios.get(url);
    const games = res.data.result || [];
    console.log(`📅 ${date} — total games fetched: ${games.length}`);


    for (const g of games) {
      if (isWomenGame(g)) continue;
      if (!g.event_final_result?.includes("-")) continue;

      const [homeScore, awayScore] = g.event_final_result.split("-").map(Number);
      const margin = Math.abs(homeScore - awayScore);
      const marginLabel = getMarginBucket(margin);

      const h2hData = await fetchPastGames(g.home_team_key, g.away_team_key);
      if (!h2hData?.firstTeamResults || !h2hData?.secondTeamResults) continue;

      const statsA = calculateStats(h2hData.firstTeamResults, g.home_team_key);
      const statsB = calculateStats(h2hData.secondTeamResults, g.away_team_key);

      const input = {
        winRateA: +statsA.winRate.toFixed(2),
        winRateB: +statsB.winRate.toFixed(2),
        avgScoredA: +statsA.avgScored.toFixed(1),
        avgScoredB: +statsB.avgScored.toFixed(1),
        avgConcededA: +statsA.avgConceded.toFixed(1),
        avgConcededB: +statsB.avgConceded.toFixed(1),
        avgMarginA: +statsA.avgMargin.toFixed(1),
        avgMarginB: +statsB.avgMargin.toFixed(1),
        isHomeTeam: 1,
        momentumScore: +((statsA.avgScored / statsA.avgConceded) * statsA.winRate).toFixed(2),
        combinedGap: +(statsA.avgScored - statsB.avgConceded + (statsA.winRate * statsA.avgMargin)).toFixed(2),
      };

      allSamples.push({ input, output: marginLabel });

      console.log(`${g.event_home_team} vs ${g.event_away_team} (${date})`);
      console.log(`🔸 Margin: ${margin} → Bucket: ${marginLabel}`);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allSamples, null, 2));
  console.log(`\n✅ Training data saved to ${OUTPUT_FILE} with ${allSamples.length} samples.`);
}

generateTrainingSet();
