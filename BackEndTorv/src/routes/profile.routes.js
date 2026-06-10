const express = require('express');
const router = express.Router();
const path = require('path');
const profileController = require('../controller/profile.controller');
const authenticateToken = require('../middlewares/auth.middleware');

// Configure Multer storage
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage()
});

router.get('/', authenticateToken, profileController.getProfile);
router.post('/upload', authenticateToken, upload.single('photo'), profileController.uploadPhoto);
router.put('/', authenticateToken, profileController.updateProfile);

module.exports = router;
