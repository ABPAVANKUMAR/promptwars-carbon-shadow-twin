export function calculateScore(data) {
  let score = 0;

  // Travel
  if (data.travel === "car") score += 30;
  else if (data.travel === "bike") score += 10;
  else if (data.travel === "public") score += 15;

  // Food
  if (data.food === "non-veg") score += 25;
  else if (data.food === "veg") score += 10;

  // Electricity
  if (data.electricity === "high") score += 30;
  else if (data.electricity === "low") score += 10;

  // Level system
  let level;
  if (score > 70) {
    level = { key: "heavy", name: "Heavy", emoji: "🌫️" };
  } else if (score > 40) {
    level = { key: "moderate", name: "Moderate", emoji: "🌱" };
  } else {
    level = { key: "clean", name: "Clean", emoji: "🌿" };
  }

  return {
    score,
    breakdown: {
      travel: data.travel,
      food: data.food,
      electricity: data.electricity
    },
    level
  };
}

export function getEmotionalMessage(level, prevScore, currentScore, isNew = false) {
  if (isNew) return `New shadow recorded: ${level.name} ${level.emoji}`;
  if (currentScore > prevScore) return "Your shadow is getting heavier ⚠️";
  if (currentScore < prevScore) return "Nice improvement! 🌱";
  return "Consistent impact.";
}

export function getShadowVisuals(score) {
  return {
    pollution: score / 100
  };
}
