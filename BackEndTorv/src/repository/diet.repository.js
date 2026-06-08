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
    // Call the Stored Procedure for the exact summary
    const result = await prisma.$queryRaw`EXEC sp_GetDietSummary @UserId=${userId}, @Date=${targetDate}`;
    return result[0]; // Assuming it returns a single row
  }

  async createFoodLog(userId, data) {
    const targetDate = data.logged_date ? new Date(data.logged_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const macrosJsonStr = typeof data.macros_json === 'string' ? data.macros_json : JSON.stringify(data.macros_json || { proteins: 0, carbs: 0, fats: 0 });

    // Execute the updated Stored Procedure and capture the new summary balance
    const result = await prisma.$queryRaw`
      EXEC sp_LogFoodAndReturnRemaining 
      @UserId=${userId}, 
      @FoodName=${data.food_name}, 
      @Calories=${data.calories}, 
      @MacrosJson=${macrosJsonStr}, 
      @Date=${targetDate}
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

  async upsertNutritionTargets(userId, targets) {
    return await prisma.nutrition_targets.upsert({
      where: { user_id: userId },
      update: {
        daily_calories: targets.daily_calories,
        protein_g: targets.protein_g,
        carbs_g: targets.carbs_g,
        fat_g: targets.fat_g,
      },
      create: {
        user_id: userId,
        daily_calories: targets.daily_calories,
        protein_g: targets.protein_g,
        carbs_g: targets.carbs_g,
        fat_g: targets.fat_g,
      },
    });
  }
}

module.exports = new DietRepository();
