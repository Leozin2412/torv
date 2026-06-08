const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const profileController = require('../controller/profile.controller');
const authenticateToken = require('../middlewares/auth.middleware');

// Configure Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../profilePhotos'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + req.user.userId + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

router.get('/', authenticateToken, profileController.getProfile);
router.post('/upload', authenticateToken, upload.single('photo'), profileController.uploadPhoto);
router.put('/', authenticateToken, profileController.updateProfile);

module.exports = router;
