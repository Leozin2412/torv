const express = require('express');
const router = express.Router();
const dietController = require('../controller/diet.controller');
const authenticateToken = require('../middlewares/auth.middleware');

router.get('/summary', authenticateToken, dietController.getDietSummary);
router.get('/', authenticateToken, dietController.getDiet);
router.post('/', authenticateToken, dietController.addFoodLog);
router.put('/targets', authenticateToken, dietController.updateNutritionTargets);
router.put('/:logId', authenticateToken, dietController.updateFoodLog);
router.delete('/:logId', authenticateToken, dietController.deleteFoodLog);

module.exports = router;
