require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Route Imports
const authRoutes = require('./src/routes/auth.routes');
const profileRoutes = require('./src/routes/profile.routes');
const dietRoutes = require('./src/routes/diet.routes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Serve static files from profilePhotos folder (MVP for photo uploads)
app.use('/uploads', express.static(path.join(__dirname, 'profilePhotos')));

// Routes
app.use('/auth', authRoutes);
app.use('/profile', profileRoutes);
app.use('/diet', dietRoutes);

// Global Error Handler (Optional but recommended)
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: 'An unexpected error occurred' });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
