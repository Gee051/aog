const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

const API_KEY = process.env.ALLSPORTS_API_KEY;
const OUTPUT_FILE = "./data/point_total_training.json";

// Bucket logic
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

function isNBA(game) {
  return game.league_name?.toLowerCase().includes("nba");
}

function isWomenGame(game) {
  const league = game.league_name?.toLowerCase() || "";
  const home = game.event_home_team?.toLowerCase() || "";
  const away = game.event_away_team?.toLowerCase() || "";
  return league.includes("women") || home.includes(" w") || away.includes(" w");
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

async function fetchGames(date) {
  const url = `https://apiv2.allsportsapi.com/basketball/?met=Fixtures&APIkey=${API_KEY}&from=${date}&to=${date}`;
  try {
    const res = await axios.get(url);
    return res.data.result || [];
  } catch {
    return [];
  }
}

// Utility to compute median
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
    medianScored: median(scored),
    medianConceded: median(conceded),
    momentum: (avgScored / avgConceded) * (wins / count)
  };
}

async function fetchH2H(teamA, teamB) {
  const url = `https://apiv2.allsportsapi.com/basketball/?met=H2H&APIkey=${API_KEY}&firstTeamId=${teamA}&secondTeamId=${teamB}`;
  try {
    const res = await axios.get(url);
    return res.data.result;
  } catch {
    return null;
  }
}

async function generateTrainingSet() {
  const allSamples = [];
  const dates = getDateRange(5);

  for (const date of dates) {
    const games = await fetchGames(date);
    console.log(`📅 ${date} — total games fetched: ${games.length}`);

    for (const g of games) {
      if (isWomenGame(g)) continue;
      if (!g.event_final_result?.includes("-")) continue;

      const [home, away] = g.event_final_result.split("-").map(Number);
      const totalPoints = home + away;
      const isNBAFlag = isNBA(g);
      const bucket = getTotalPointsBucket(totalPoints, isNBAFlag);
      if (!bucket) continue;

      const h2h = await fetchH2H(g.home_team_key, g.away_team_key);
      if (!h2h?.firstTeamResults || !h2h?.secondTeamResults) continue;

      const statsA = calculateStats(h2h.firstTeamResults, g.home_team_key);
      const statsB = calculateStats(h2h.secondTeamResults, g.away_team_key);
      if (!statsA || !statsB) continue;

      const avgTotalPointsA = statsA.avgScored + statsA.avgConceded;
      const avgTotalPointsB = statsB.avgScored + statsB.avgConceded;
      const medianTotalPointsA = statsA.medianScored + statsA.medianConceded;
      const medianTotalPointsB = statsB.medianScored + statsB.medianConceded;
      const scoringGap = avgTotalPointsA - avgTotalPointsB;

      const offenseGap = statsA.avgScored - statsB.avgConceded;
      const defenseGap = statsB.avgConceded - statsA.avgConceded;
      const combinedMomentum = statsA.momentum - statsB.momentum;
      const homeScoringAdvantage = statsA.avgScored - statsB.avgScored;
      const homeConcedingGap = statsA.avgConceded - statsB.avgConceded;
      const homeWinRateGap = statsA.winRate - statsB.winRate;

      const input = {
        winRateA: +statsA.winRate.toFixed(2),
        winRateB: +statsB.winRate.toFixed(2),
        avgScoredA: +statsA.avgScored.toFixed(1),
        avgScoredB: +statsB.avgScored.toFixed(1),
        avgConcededA: +statsA.avgConceded.toFixed(1),
        avgConcededB: +statsB.avgConceded.toFixed(1),
        momentumA: +statsA.momentum.toFixed(2),
        momentumB: +statsB.momentum.toFixed(2),
        offenseGap: +offenseGap.toFixed(1),
        defenseGap: +defenseGap.toFixed(1),
        combinedMomentum: +combinedMomentum.toFixed(2),
        homeScoringAdvantage: +homeScoringAdvantage.toFixed(1),
        homeConcedingGap: +homeConcedingGap.toFixed(1),
        homeWinRateGap: +homeWinRateGap.toFixed(2),
        avgTotalPointsA: +avgTotalPointsA.toFixed(1),
        avgTotalPointsB: +avgTotalPointsB.toFixed(1),
        scoringGap: +scoringGap.toFixed(1),
        medianTotalPointsA: +medianTotalPointsA.toFixed(1),
        medianTotalPointsB: +medianTotalPointsB.toFixed(1),
        isNBA: isNBAFlag ? 1 : 0
      };

      allSamples.push({
        input,
        output: +totalPoints.toFixed(1),
        bucket,
        league: isNBAFlag ? "NBA" : "NON-NBA"
      });

      console.log(`${g.event_home_team} vs ${g.event_away_team} → Total: ${totalPoints} | Bucket: ${bucket}`);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allSamples, null, 2));
  console.log(`\n✅ Training data saved to ${OUTPUT_FILE} with ${allSamples.length} samples.`);
}

generateTrainingSet();
