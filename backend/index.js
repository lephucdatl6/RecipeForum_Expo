require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const { sendWelcomeEmail } = require('./emailService');
const { generateApiConfig } = require('../scripts/generateApiConfig');

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Route to get all users
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT user_id, username, email, dob, phone, point FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add created_at column if it doesn't exist
async function ensureCreatedAtColumn() {
  try {
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()
    `);
    // console.log('Ensured created_at column exists'); // Commented out to reduce console noise
  } catch (err) {
    console.error('Error adding created_at column:', err.message);
  }
}

// Call this when server starts
ensureCreatedAtColumn();

// Authentication routes
// Signup route
app.post('/api/auth/signup', async (req, res) => {
  const { username, email, password, dateOfBirth, phone, points = 0 } = req.body;
  
  try {
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists'
      });
    }
    
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Insert new user
    const result = await pool.query(
      'INSERT INTO users (username, email, password, dob, phone, point, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING user_id, username, email, dob, phone, point, created_at',
      [username, email, hashedPassword, dateOfBirth, phone, points]
    );
    
    const newUser = result.rows[0];
    
    // Send welcome email (don't wait for it to complete)
    sendWelcomeEmail(email, username).then(emailResult => {
      if (emailResult.success) {
        console.log(`Welcome email sent to ${email}`);
      } else {
        console.error(`Failed to send welcome email to ${email}:`, emailResult.error);
      }
    }).catch(error => {
      console.error('Error in email sending process:', error);
    });
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: newUser
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error'
    });
  }
});

// Login route
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // Find user by username
    const result = await pool.query(
      'SELECT user_id, username, email, password, dob, phone, point, created_at FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }
    
    const user = result.rows[0];
    
    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        ...userWithoutPassword,
        dateOfBirth: user.dob,
        points: user.point
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error'
    });
  }
});

// Debug route to check current database
app.get('/api/debug-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT current_database()');
    res.json({ database: result.rows[0].current_database });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;

// Auto-generate API configuration on server startup
console.log('Auto-generating API configuration...');
generateApiConfig();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Route to create a new user
app.post('/api/users', async (req, res) => {
  const { username, email } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO users (username, email, password, point) VALUES ($1, $2, $3, $4) RETURNING *',
      [username, email, 'defaultpassword', 0]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});