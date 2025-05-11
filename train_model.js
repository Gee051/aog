const fs = require("fs");
const { RandomForestClassifier } = require("ml-random-forest");

const bucketLabels = ["1-5", "6-10", "11-15", "16-20", "21-25", "26-30", "31+"];
const bucketToIndex = Object.fromEntries(bucketLabels.map((b, i) => [b, i]));

let raw;
try {
  raw = JSON.parse(fs.readFileSync("./data/training.json", "utf-8"));
} catch (e) {
  console.error("❌ Failed to load training.json");
  process.exit(1);
}

const filtered = raw.filter(
  d =>
    d.input &&
    typeof d.output === "string" &&
    bucketToIndex[d.output] !== undefined
);

const bucketMap = {};
for (const d of filtered) {
  const bucket = d.output;
  if (!bucketMap[bucket]) bucketMap[bucket] = [];
  bucketMap[bucket].push(d);
}

const minSize = Math.min(...Object.values(bucketMap).map(arr => arr.length));
let balanced = [];
for (const bucket in bucketMap) {
  const shuffled = bucketMap[bucket].sort(() => 0.5 - Math.random());
  balanced = balanced.concat(shuffled.slice(0, minSize));
}
balanced = balanced.sort(() => 0.5 - Math.random());

const inputs = [];
const outputs = [];

for (const d of balanced) {
  const input = d.input;
  if (!input) continue;

  const {
    winRateA, winRateB,
    avgScoredA, avgScoredB,
    avgConcededA, avgConcededB,
    avgMarginA, avgMarginB,
    momentumScore = 0,
    combinedGap = 0,
    isHomeTeam
  } = input;

  const required = [
    winRateA, winRateB,
    avgScoredA, avgScoredB,
    avgConcededA, avgConcededB,
    avgMarginA, avgMarginB,
    isHomeTeam
  ];

  if (required.some(v => typeof v !== "number" || isNaN(v))) continue;

  const offenseGap = avgScoredA - avgConcededB;
  const marginDiff = avgMarginA - avgMarginB;
  const totalGap = (avgScoredA - avgConcededB) - (avgScoredB - avgConcededA);
  const powerScoreA = winRateA * avgMarginA;
  const defenseGap = avgConcededB - avgConcededA;
  const relativePower = (winRateA * avgMarginA) - (winRateB * avgMarginB);
  const winRateDiff = winRateA - winRateB;

  const features = [
    +winRateA.toFixed(2),
    +winRateB.toFixed(2),
    +offenseGap.toFixed(1),
    +marginDiff.toFixed(1),
    +totalGap.toFixed(1),
    +powerScoreA.toFixed(1),
    +defenseGap.toFixed(1),
    +momentumScore.toFixed(2),
    +relativePower.toFixed(2),
    +combinedGap.toFixed(2),
    +winRateDiff.toFixed(2),
    isHomeTeam
  ];

  inputs.push(features);
  outputs.push(bucketToIndex[d.output]);
}

if (inputs.length === 0 || inputs.length !== outputs.length) {
  console.error("❌ No valid training data.");
  process.exit(1);
}

const classifier = new RandomForestClassifier({
  nEstimators: 75,
  maxDepth: 10,
  minNumSamples: 3,
  seed: 42
});

classifier.train(inputs, outputs);

const modelJSON = classifier.toJSON();
modelJSON.bucketLabels = bucketLabels;
fs.writeFileSync("marginModel.json", JSON.stringify(modelJSON, null, 2));

console.log("✅ Trained model with", inputs.length, "samples");
console.log("📊 Features used:", inputs[0].length);
console.log("🎯 Balanced per bucket:", minSize);


