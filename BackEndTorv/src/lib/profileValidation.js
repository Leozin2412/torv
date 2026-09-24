const { GOAL_NAMES, ACTIVITY_FACTORS } = require('./nutritionCalculator');

// Faixas iguais aos CHECK de user_measurements.
function validateProfileUpdate({ username, goal, fitness_level, weight_kg, height_cm } = {}) {
  const profileData = {};
  const measurement = {};

  if (username) profileData.username = username;

  if (goal !== undefined) {
    const goals = String(goal).split(',').map((g) => g.trim().normalize('NFC')).filter(Boolean);
    if (goals.length === 0 || goals.some((g) => !GOAL_NAMES.includes(g))) {
      return { error: 'goal must list one or more valid goals' };
    }
    profileData.goal = goals.join(', ');
  }

  if (fitness_level !== undefined) {
    if (!ACTIVITY_FACTORS[fitness_level]) return { error: 'fitness_level must be INICIANTE, INTERMEDIÁRIO or AVANÇADO' };
    profileData.fitness_level = fitness_level;
  }

  if (weight_kg !== undefined) {
    const w = Number(weight_kg);
    if (!(w >= 20 && w <= 300)) return { error: 'weight_kg must be between 20 and 300' };
    measurement.weight_kg = w;
  }

  if (height_cm !== undefined) {
    const h = Number(height_cm);
    if (!Number.isInteger(h) || h < 50 || h > 250) return { error: 'height_cm must be an integer between 50 and 250' };
    measurement.height_cm = h;
  }

  const hasMeasurement = Object.keys(measurement).length > 0;
  if (Object.keys(profileData).length === 0 && !hasMeasurement) return { error: 'No fields provided for update' };

  return { profileData, measurement: hasMeasurement ? measurement : null };
}

module.exports = { validateProfileUpdate };
