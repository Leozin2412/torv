const dietRepository = require('../repository/diet.repository');

// Helper to format the SP output into our uniform JSON
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
      return {
        ...log,
        macros_json: macros,
      };
    })
  };
};

class DietController {
  async getDietSummary(req, res) {
    try {
      const { userId } = req.user;
      let { date } = req.query;

      if (!date) {
        date = new Date().toISOString().split('T')[0];
      }

      const spResult = await dietRepository.getDietSummaryByDate(userId, date);
      const { foodLogs } = await dietRepository.getDietDataByDate(userId, date);

      console.log('DEBUG getDietSummary - spResult:', spResult);
      console.log('DEBUG getDietSummary - foodLogs:', foodLogs);

      const finalResponse = formatDietSummaryResponse(date, spResult || {
        GoalCalories: 2000, GoalProtein: 150, GoalCarbs: 250, GoalFat: 65,
        ConsumedCalories: 0, ConsumedProtein: 0, ConsumedCarbs: 0, ConsumedFat: 0,
        RemainingCalories: 2000, RemainingProtein: 150, RemainingCarbs: 250, RemainingFat: 65
      }, foodLogs || []);
      
      res.status(200).json(finalResponse);
    } catch (error) {
      console.error('Get Diet Summary Error:', error);
      res.status(500).json({ error: 'Internal server error fetching diet summary' });
    }
  }

  async getDiet(req, res) {
    // We can alias this to the summary directly for backwards compatibility
    return this.getDietSummary(req, res);
  }

  async addFoodLog(req, res) {
    try {
      const { userId } = req.user;
      const { food_name, calories, macros_json, logged_date } = req.body;

      if (!food_name || calories === undefined || !macros_json) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const date = logged_date || new Date().toISOString().split('T')[0];
      
      // Execute SP (creates log AND returns summary)
      const spResult = await dietRepository.createFoodLog(userId, {
        food_name, calories, macros_json, logged_date: date
      });

      // Refetch the logs list for the day
      const { foodLogs } = await dietRepository.getDietDataByDate(userId, date);

      const finalResponse = formatDietSummaryResponse(date, spResult, foodLogs || []);
      
      res.status(201).json(finalResponse);
    } catch (error) {
      console.error('Add Food Log Error:', error);
      res.status(500).json({ error: 'Internal server error creating food log' });
    }
  }

  async updateFoodLog(req, res) {
    try {
      const { userId } = req.user;
      const { logId } = req.params;
      const { food_name, calories, macros_json } = req.body;

      if (!logId) {
        return res.status(400).json({ error: 'Missing logId' });
      }

      // We need the date of the log to return the updated summary
      const existingLog = await dietRepository.getFoodLogById(logId);
      if (!existingLog || existingLog.user_id !== userId) {
        return res.status(404).json({ error: 'Food log not found' });
      }
      const date = new Date(existingLog.logged_date).toISOString().split('T')[0];

      await dietRepository.updateFoodLog(userId, logId, {
        food_name, calories, macros_json
      });

      // Refetch the summary
      const spResult = await dietRepository.getDietSummaryByDate(userId, date);
      const { foodLogs } = await dietRepository.getDietDataByDate(userId, date);

      res.status(200).json(formatDietSummaryResponse(date, spResult, foodLogs || []));
    } catch (error) {
      console.error('Update Food Log Error:', error);
      res.status(500).json({ error: 'Internal server error updating food log' });
    }
  }

  async deleteFoodLog(req, res) {
    try {
      const { userId } = req.user;
      const { logId } = req.params;

      if (!logId) {
        return res.status(400).json({ error: 'Missing logId' });
      }

      // We need the date to refresh the summary
      const existingLog = await dietRepository.getFoodLogById(logId);
      if (!existingLog || existingLog.user_id !== userId) {
        return res.status(404).json({ error: 'Food log not found' });
      }
      const date = new Date(existingLog.logged_date).toISOString().split('T')[0];

      await dietRepository.deleteFoodLog(userId, logId);

      // Refetch the summary
      const spResult = await dietRepository.getDietSummaryByDate(userId, date);
      const { foodLogs } = await dietRepository.getDietDataByDate(userId, date);

      res.status(200).json(formatDietSummaryResponse(date, spResult, foodLogs || []));
    } catch (error) {
      console.error('Delete Food Log Error:', error);
      res.status(500).json({ error: 'Internal server error deleting food log' });
    }
  }

  async updateNutritionTargets(req, res) {
    try {
      const { userId } = req.user;
      const { daily_calories, protein_g, carbs_g, fat_g } = req.body;

      if (daily_calories === undefined) {
        return res.status(400).json({ error: 'Missing daily_calories' });
      }

      const targets = await dietRepository.upsertNutritionTargets(userId, {
        daily_calories,
        protein_g: protein_g || 0,
        carbs_g: carbs_g || 0,
        fat_g: fat_g || 0,
      });

      // Refetch today's summary to reflect the new targets
      const date = new Date().toISOString().split('T')[0];
      const spResult = await dietRepository.getDietSummaryByDate(userId, date);
      const { foodLogs } = await dietRepository.getDietDataByDate(userId, date);

      res.status(200).json(formatDietSummaryResponse(date, spResult, foodLogs || []));
    } catch (error) {
      console.error('Update Nutrition Targets Error:', error);
      res.status(500).json({ error: 'Internal server error updating targets' });
    }
  }
}

module.exports = new DietController();
