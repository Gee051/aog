const fs = require("fs");
const { RandomForestRegression } = require("ml-random-forest");

const INPUT_FILE = "./data/point_total_training.json";
const OUTPUT_MODEL_FILE = "./data/pointsModel.json";

let raw;
try {
  raw = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8"));
} catch (e) {
  console.error("❌ Failed to load training data:", INPUT_FILE);
  process.exit(1);
}

// Filter valid samples
const validSamples = raw.filter(
  d =>
    d.input &&
    typeof d.output === "number" &&
    !isNaN(d.output) &&
    Object.values(d.input).every(v => typeof v === "number" && !isNaN(v))
);

if (validSamples.length === 0) {
  console.error("❌ No valid training samples found.");
  process.exit(1);
}

// Build feature arrays
const inputs = validSamples.map(d => Object.values(d.input));
const outputs = validSamples.map(d => d.output);

console.log(`📊 Training on ${inputs.length} samples with ${inputs[0].length} features each.`);

// Train the regression model
const regressor = new RandomForestRegression({
  nEstimators: 100,
  maxDepth: 14,
  minNumSamples: 3,
  seed: 42
});

regressor.train(inputs, outputs);

// Save model to JSON
const modelJSON = regressor.toJSON();

try {
  fs.writeFileSync(OUTPUT_MODEL_FILE, JSON.stringify(modelJSON, null, 2));
  console.log(`✅ Model saved to ${OUTPUT_MODEL_FILE}`);
  console.log(`📦 Total training samples: ${inputs.length}`);
} catch (err) {
  console.error("❌ Failed to save model:", err.message);
}
