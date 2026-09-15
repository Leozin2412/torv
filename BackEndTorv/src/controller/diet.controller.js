const dietRepository = require('../repository/diet.repository');

const formatDietSummaryResponse = (date, spResult, logsArray) => {
  return {
    date,
    targets: {
      daily_calories: spResult.GoalCalories,
      protein_g: spResult.GoalProtein,
      carbs_g: spResult.GoalCarbs,
      fat_g: spResult.GoalFat,
    },
    consumed: {
      calories: spResult.ConsumedCalories,
      protein_g: spResult.ConsumedProtein,
      carbs_g: spResult.ConsumedCarbs,
      fat_g: spResult.ConsumedFat,
    },
    remaining: {
      calories: spResult.RemainingCalories,
      protein_g: spResult.RemainingProtein,
      carbs_g: spResult.RemainingCarbs,
      fat_g: spResult.RemainingFat,
    },
    logs: logsArray.map(log => {
      let macros = { proteins: 0, carbs: 0, fats: 0 };
      if (log.macros_json) {
        try {
          macros = typeof log.macros_json === 'string' ? JSON.parse(log.macros_json) : log.macros_json;
        } catch (e) {}
      }
      return { ...log, macros_json: macros };
    })
  };
};

class DietController {
  async getDietSummary(request, reply) {
    try {
      const { userId } = request.user;
      let { date } = request.query;

      if (!date) {
        date = new Date().toISOString().split('T')[0];
      }

      const spResult = await dietRepository.getDietSummaryByDate(userId, date);
      const { foodLogs } = await dietRepository.getDietDataByDate(userId, date);

      const finalResponse = formatDietSummaryResponse(date, spResult || {
        GoalCalories: 2000, GoalProtein: 150, GoalCarbs: 250, GoalFat: 65,
        ConsumedCalories: 0, ConsumedProtein: 0, ConsumedCarbs: 0, ConsumedFat: 0,
        RemainingCalories: 2000, RemainingProtein: 150, RemainingCarbs: 250, RemainingFat: 65
      }, foodLogs || []);

      reply.status(200).send(finalResponse);
    } catch (error) {
      request.log.error(error);
      console.error(error);
      reply.status(500).send({ error: 'Internal server error fetching diet summary' });
    }
  }

  async getDiet(request, reply) {
    return this.getDietSummary(request, reply);
  }

  async addFoodLog(request, reply) {
    try {
      const { userId } = request.user;
      const { food_name, calories, macros_json, logged_date } = request.body;

      if (!food_name || calories === undefined || !macros_json) {
        return reply.status(400).send({ error: 'Missing required fields' });
      }

      const date = logged_date || new Date().toISOString().split('T')[0];

      const spResult = await dietRepository.createFoodLog(userId, {
        food_name, calories, macros_json, logged_date: date
      });

      const { foodLogs } = await dietRepository.getDietDataByDate(userId, date);

      reply.status(201).send(formatDietSummaryResponse(date, spResult, foodLogs || []));
    } catch (error) {
      request.log.error(error);
      console.error(error);
      reply.status(500).send({ error: 'Internal server error creating food log' });
    }
  }

  async updateFoodLog(request, reply) {
    try {
      const { userId } = request.user;
      const { logId } = request.params;
      const { food_name, calories, macros_json } = request.body;

      if (!logId) {
        return reply.status(400).send({ error: 'Missing logId' });
      }

      const existingLog = await dietRepository.getFoodLogById(logId);
      if (!existingLog || existingLog.user_id !== userId) {
        return reply.status(404).send({ error: 'Food log not found' });
      }
      const date = new Date(existingLog.logged_date).toISOString().split('T')[0];

      await dietRepository.updateFoodLog(userId, logId, { food_name, calories, macros_json });

      const spResult = await dietRepository.getDietSummaryByDate(userId, date);
      const { foodLogs } = await dietRepository.getDietDataByDate(userId, date);

      reply.status(200).send(formatDietSummaryResponse(date, spResult, foodLogs || []));
    } catch (error) {
      request.log.error(error);
      console.error(error);
      reply.status(500).send({ error: 'Internal server error updating food log' });
    }
  }

  async deleteFoodLog(request, reply) {
    try {
      const { userId } = request.user;
      const { logId } = request.params;

      if (!logId) {
        return reply.status(400).send({ error: 'Missing logId' });
      }

      const existingLog = await dietRepository.getFoodLogById(logId);
      if (!existingLog || existingLog.user_id !== userId) {
        return reply.status(404).send({ error: 'Food log not found' });
      }
      const date = new Date(existingLog.logged_date).toISOString().split('T')[0];

      await dietRepository.deleteFoodLog(userId, logId);

      const spResult = await dietRepository.getDietSummaryByDate(userId, date);
      const { foodLogs } = await dietRepository.getDietDataByDate(userId, date);

      reply.status(200).send(formatDietSummaryResponse(date, spResult, foodLogs || []));
    } catch (error) {
      request.log.error(error);
      console.error(error);
      reply.status(500).send({ error: 'Internal server error deleting food log' });
    }
  }

  async updateNutritionTargets(request, reply) {
    try {
      const { userId } = request.user;
      const { daily_calories, protein_g, carbs_g, fat_g } = request.body;

      if (daily_calories === undefined) {
        return reply.status(400).send({ error: 'Missing daily_calories' });
      }

      await dietRepository.upsertNutritionTargets(userId, {
        daily_calories, protein_g: protein_g || 0, carbs_g: carbs_g || 0, fat_g: fat_g || 0,
      });

      const date = new Date().toISOString().split('T')[0];
      const spResult = await dietRepository.getDietSummaryByDate(userId, date);
      const { foodLogs } = await dietRepository.getDietDataByDate(userId, date);

      reply.status(200).send(formatDietSummaryResponse(date, spResult, foodLogs || []));
    } catch (error) {
      request.log.error(error);
      console.error(error);
      reply.status(500).send({ error: 'Internal server error updating targets' });
    }
  }
}

module.exports = new DietController();
