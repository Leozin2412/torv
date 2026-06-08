const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authRepository = require('../repository/auth.repository');

class AuthController {
  async register(req, res) {
    try {
      console.log('--- [DEBUG] POST /auth/register ---');
      console.log('Request Body:', req.body);
      
      const typesReceived = Object.keys(req.body).reduce((acc, key) => {
        acc[key] = typeof req.body[key];
        return acc;
      }, {});
      console.log('Data Types Received:', typesReceived);

      const { email, password, name, birth_date, weight, height, gender, fitness_level, goal } = req.body;

      if (!email || !password || !name) {
        console.error('--- [DEBUG] Error: Missing required fields ---');
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check if user already exists
      const existingUser = await authRepository.findUserByEmail(email);
      if (existingUser) {
        console.error('--- [DEBUG] Error: User already exists with this email ---');
        return res.status(409).json({ error: 'User already exists with this email' });
      }

      // Convert birth_date to Date object
      let parsedBirthDate = null;
      if (birth_date) {
        // Convert "DD/MM/YYYY" to "YYYY-MM-DD" for correct parsing
        if (birth_date.includes('/')) {
          const [day, month, year] = birth_date.split('/');
          parsedBirthDate = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
        } else {
          parsedBirthDate = new Date(birth_date);
        }

        if (isNaN(parsedBirthDate.getTime())) {
          console.error('--- [DEBUG] Error: Invalid birth_date format ---', birth_date);
          return res.status(400).json({ error: 'Invalid birth_date format' });
        }
      }

      // Encrypt password
      const password_hash = await bcrypt.hash(password, 10);
      const username = email.split('@')[0] + Math.floor(Math.random() * 1000); // Simple username generator

      // Save to database
      const user = await authRepository.createUser({
        email,
        password_hash,
        username,
        name,
        birth_date: parsedBirthDate,
        weight,
        height,
        gender,
        fitness_level,
        goal,
      });

      res.status(201).json({ message: 'User registered successfully', userId: user.id });
    } catch (error) {
      console.error('Registration Error:', error);
      res.status(500).json({ error: 'Internal server error during registration' });
    }
  }

  async login(req, res) {
    try {
      console.log('--- [DEBUG] POST /auth/login ---');
      console.log('Request Body (excluding password):', { email: req.body.email });

      const { email, password } = req.body;

      if (!email || !password) {
        console.error('--- [DEBUG] Error: Missing email or password ---');
        return res.status(400).json({ error: 'Missing email or password' });
      }

      const user = await authRepository.findUserByEmail(email);
      if (!user) {
        console.error('--- [DEBUG] Error: Invalid credentials (user not found) ---');
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        console.error('--- [DEBUG] Error: Invalid credentials (wrong password) ---');
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'uma_frase_longa_com_letras_numeros_e_simbolos_bem_aleatorios',
        { expiresIn: '7d' }
      );

      const host = req.get('host');
      const protocol = req.protocol;
      const photoUrl = user.user_profiles?.photo_url 
        ? `${protocol}://${host}/uploads/${user.user_profiles.photo_url}`
        : null;

      res.status(200).json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.user_profiles ? user.user_profiles.name : null,
          username: user.user_profiles ? user.user_profiles.username : null,
          photo_url: photoUrl,
          profile: user.user_profiles,
        },
      });
    } catch (error) {
      console.error('Login Error:', error);
      res.status(500).json({ error: 'Internal server error during login' });
    }
  }
}

module.exports = new AuthController();
