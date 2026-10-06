const prisma = require('../lib/prisma');

class DietRepository {
  async getDietDataByDate(userId, targetDate) {
    const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
    const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);

    const foodLogs = await prisma.food_logs.findMany({
      where: {
        user_id: userId,
        logged_date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: {
        logged_date: 'asc',
      },
    });

    return { foodLogs };
  }

  async getFoodLogById(logId) {
    return await prisma.food_logs.findUnique({
      where: { id: logId }
    });
  }

  async getDietSummaryByDate(userId, targetDate) {
    // Call the Postgres function for the exact summary
    const result = await prisma.$queryRaw`SELECT * FROM fn_get_diet_summary(${userId}::uuid, ${targetDate}::date)`;
    return result[0]; // Assuming it returns a single row
  }

  async createFoodLog(userId, data) {
    const targetDate = data.logged_date ? new Date(data.logged_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const macrosJsonStr = typeof data.macros_json === 'string' ? data.macros_json : JSON.stringify(data.macros_json || { protein: 0, carbs: 0, fat: 0 });

    // Execute the Postgres function and capture the new summary balance
    // Explicit ::integer cast on calories: Prisma's $queryRaw infers JS numbers as
    // bigint, which doesn't match the function's `integer` parameter and Postgres
    // won't implicitly cast bigint->integer for overload resolution.
    const result = await prisma.$queryRaw`
      SELECT * FROM fn_log_food_and_return_remaining(
        ${userId}::uuid, ${data.food_name}, ${data.calories}::integer, ${macrosJsonStr}, ${targetDate}::date
      )
    `;

    return result[0];
  }

  async deleteFoodLog(userId, logId) {
    // Delete the log only if it belongs to the user
    return await prisma.food_logs.deleteMany({
      where: {
        id: logId,
        user_id: userId,
      },
    });
  }

  async updateFoodLog(userId, logId, data) {
    const macrosJsonStr = data.macros_json 
      ? (typeof data.macros_json === 'string' ? data.macros_json : JSON.stringify(data.macros_json))
      : undefined;

    // We use updateMany to safely enforce the user_id check
    await prisma.food_logs.updateMany({
      where: {
        id: logId,
        user_id: userId,
      },
      data: {
        ...(data.food_name && { food_name: data.food_name }),
        ...(data.calories !== undefined && { calories: data.calories }),
        ...(macrosJsonStr && { macros_json: macrosJsonStr }),
      },
    });
  }

  async getCalcInputs(userId) {
    const [profile, measurement] = await Promise.all([
      prisma.user_profiles.findUnique({
        where: { user_id: userId },
        select: { gender: true, birth_date: true, fitness_level: true, goal: true },
      }),
      prisma.user_measurements.findFirst({
        where: { user_id: userId },
        orderBy: { recorded_at: 'desc' },
        select: { weight_kg: true, height_cm: true },
      }),
    ]);
    if (!profile) return null;
    return {
      gender: profile.gender,
      birthDate: profile.birth_date,
      fitnessLevel: profile.fitness_level,
      goals: profile.goal,
      weightKg: measurement?.weight_kg ?? null,
      heightCm: measurement?.height_cm ?? null,
    };
  }

  async getNutritionTargets(userId) {
    return await prisma.nutrition_targets.findUnique({ where: { user_id: userId } });
  }

  async updateTargetsBasis(userId, basis) {
    return await prisma.nutrition_targets.upsert({
      where: { user_id: userId },
      update: { basis_json: basis, updated_at: new Date() },
      create: { user_id: userId, basis_json: basis, updated_at: new Date() },
    });
  }

  async upsertNutritionTargets(userId, targets) {
    const data = {
      daily_calories: targets.daily_calories,
      protein_g: targets.protein_g,
      carbs_g: targets.carbs_g,
      fat_g: targets.fat_g,
      basis_json: targets.basis_json ?? null,
      updated_at: new Date(),
    };
    return await prisma.nutrition_targets.upsert({
      where: { user_id: userId },
      update: data,
      create: { user_id: userId, ...data },
    });
  }
}

module.exports = new DietRepository();
