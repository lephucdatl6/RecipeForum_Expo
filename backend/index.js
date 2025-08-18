require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const mongoose = require('mongoose');
const { sendWelcomeEmail } = require('./emailService');
const { generateApiConfig } = require('../scripts/generateApiConfig');

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Recipe Schema for MongoDB
const recipeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  ingredients: [{
    name: String,
    amount: String,
    unit: String
  }],
  instructions: [{
    step: Number,
    description: String
  }],
  cookingTime: {
    type: Number,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Easy'
  },
  category: {
    type: String,
    required: true
  },
  author: {
    type: String,
    required: true
  },
  authorEmail: {
    type: String,
    required: true
  },
  upvotes: {
    type: Number,
    default: 0
  },
  downvotes: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Number,
    default: 1,
    enum: [0, 1] // 0 = hidden/deleted, 1 = active/visible
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  deletedAt: {
    type: Date,
    default: null
  }
});

const Recipe = mongoose.model('Recipe', recipeSchema);

// Route to get all users
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT user_id, username, email, dob, phone, point FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user profile by email (for viewing other users' profiles)
app.get('/api/users/profile/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const result = await pool.query(
      'SELECT username, email, point, created_at FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = result.rows[0];
    res.json({
      success: true,
      user: {
        username: user.username,
        email: user.email,
        points: user.point,
        memberSince: user.created_at
      }
    });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch user profile' 
    });
  }
});

// Add created_at column if it doesn't exist
async function ensureCreatedAtColumn() {
  try {
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()
    `);
    // console.log('Ensured created_at column exists');
  } catch (err) {
    console.error('Error adding created_at column:', err.message);
  }
}
ensureCreatedAtColumn();

// Authentication routes
// Signup route
app.post('/api/auth/signup', async (req, res) => {
  const { username, email, password, dateOfBirth, phone, points = 0, confirmDuplicateUsername = false } = req.body;
  
  try {
    // Check if email already exists (email must be unique per database constraint)
    const existingEmail = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (existingEmail.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists. Please use a different email address.'
      });
    }

    // Check if username already exists (username can be duplicate but warn user)
    const existingUsername = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (existingUsername.rows.length > 0 && !confirmDuplicateUsername) {
      return res.status(409).json({
        success: false,
        message: 'Username already exists. Are you sure you want to use this username?',
        type: 'username_exists',
        requireConfirmation: true
      });
    }
    
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Insert new user (database will enforce email uniqueness)
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
    
    // Handle database constraint violations
    if (err.code === '23505' && err.constraint === 'users_email_key') {
      return res.status(400).json({
        success: false,
        message: 'Email already exists. Please use a different email address.'
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Internal server error'
    });
  }
});

// Login route
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Find user by email
    const result = await pool.query(
      'SELECT user_id, username, email, password, dob, phone, point, created_at FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    const user = result.rows[0];
    
    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
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

// ==================== RECIPE ENDPOINTS (MongoDB) ====================

// Post a new recipe
app.post('/api/recipes', async (req, res) => {
  try {
    const {
      title,
      description,
      ingredients,
      instructions,
      cookingTime,
      difficulty,
      category,
      author,
      authorEmail
    } = req.body;

    // Validate required fields
    if (!title || !description || !cookingTime || !category || !author || !authorEmail) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, description, cookingTime, category, author, authorEmail' 
      });
    }

    const recipe = new Recipe({
      title,
      description,
      ingredients: ingredients || [],
      instructions: instructions || [],
      cookingTime,
      difficulty: difficulty || 'Easy',
      category,
      author,
      authorEmail
    });

    const savedRecipe = await recipe.save();
    
    res.status(201).json({
      success: true,
      message: 'Recipe posted successfully!',
      recipe: savedRecipe
    });

  } catch (error) {
    console.error('Error posting recipe:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to post recipe',
      details: error.message 
    });
  }
});

// Get all recipes (only active ones)
app.get('/api/recipes', async (req, res) => {
  try {
    const recipes = await Recipe.find({ isActive: 1 }).sort({ createdAt: -1 });
    res.json({
      success: true,
      count: recipes.length,
      recipes
    });
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch recipes',
      details: error.message 
    });
  }
});

// Get single recipe by ID (only if active)
app.get('/api/recipes/:id', async (req, res) => {
  try {
    const recipe = await Recipe.findOne({ _id: req.params.id, isActive: 1 });
    if (!recipe) {
      return res.status(404).json({ 
        success: false,
        error: 'Recipe not found or has been removed' 
      });
    }
    res.json({
      success: true,
      recipe
    });
  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch recipe',
      details: error.message 
    });
  }
});

// Upvote a recipe (only if active)
app.post('/api/recipes/:id/upvote', async (req, res) => {
  try {
    const recipe = await Recipe.findOneAndUpdate(
      { _id: req.params.id, isActive: 1 },
      { $inc: { upvotes: 1 } },
      { new: true }
    );
    
    if (!recipe) {
      return res.status(404).json({ 
        success: false,
        error: 'Recipe not found or has been removed' 
      });
    }
    
    res.json({
      success: true,
      message: 'Recipe upvoted!',
      upvotes: recipe.upvotes,
      downvotes: recipe.downvotes,
      netVotes: recipe.upvotes - recipe.downvotes
    });
  } catch (error) {
    console.error('Error upvoting recipe:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to upvote recipe',
      details: error.message 
    });
  }
});

// Downvote a recipe (only if active)
app.post('/api/recipes/:id/downvote', async (req, res) => {
  try {
    const recipe = await Recipe.findOneAndUpdate(
      { _id: req.params.id, isActive: 1 },
      { $inc: { downvotes: 1 } },
      { new: true }
    );
    
    if (!recipe) {
      return res.status(404).json({ 
        success: false,
        error: 'Recipe not found or has been removed' 
      });
    }
    
    res.json({
      success: true,
      message: 'Recipe downvoted!',
      upvotes: recipe.upvotes,
      downvotes: recipe.downvotes,
      netVotes: recipe.upvotes - recipe.downvotes
    });
  } catch (error) {
    console.error('Error downvoting recipe:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to downvote recipe',
      details: error.message 
    });
  }
});

// Soft delete a recipe post (mark as inactive)
app.delete('/api/recipes/:id', async (req, res) => {
  try {
    const recipe = await Recipe.findOneAndUpdate(
      { _id: req.params.id, isActive: 1 },
      { 
        isActive: 0,
        deletedAt: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!recipe) {
      return res.status(404).json({ 
        success: false,
        error: 'Recipe not found or already deleted' 
      });
    }
    
    res.json({
      success: true,
      message: 'Post deleted successfully!',
      deletedPost: {
        id: recipe._id,
        title: recipe.title,
        author: recipe.author,
        deletedAt: recipe.deletedAt
      }
    });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete recipe',
      details: error.message 
    });
  }
});

// ==================== ADMIN ENDPOINTS (Optional) ====================

// Get all deleted/inactive recipes (admin only)
app.get('/api/admin/recipes/deleted', async (req, res) => {
  try {
    const deletedRecipes = await Recipe.find({ isActive: 0 }).sort({ deletedAt: -1 });
    res.json({
      success: true,
      count: deletedRecipes.length,
      recipes: deletedRecipes
    });
  } catch (error) {
    console.error('Error fetching deleted recipes:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch deleted recipes',
      details: error.message 
    });
  }
});

// Restore a deleted recipe (admin only)
app.patch('/api/admin/recipes/:id/restore', async (req, res) => {
  try {
    const recipe = await Recipe.findOneAndUpdate(
      { _id: req.params.id, isActive: 0 },
      { 
        isActive: 1,
        deletedAt: null,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!recipe) {
      return res.status(404).json({ 
        success: false,
        error: 'Deleted recipe not found' 
      });
    }
    
    res.json({
      success: true,
      message: 'Recipe restored successfully!',
      recipe: {
        id: recipe._id,
        title: recipe.title,
        author: recipe.author
      }
    });
  } catch (error) {
    console.error('Error restoring recipe:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to restore recipe',
      details: error.message 
    });
  }
});

// Get all recipes (active and inactive) for admin
app.get('/api/admin/recipes/all', async (req, res) => {
  try {
    const allRecipes = await Recipe.find().sort({ createdAt: -1 });
    const activeCount = allRecipes.filter(r => r.isActive === 1).length;
    const deletedCount = allRecipes.filter(r => r.isActive === 0).length;
    
    res.json({
      success: true,
      totalCount: allRecipes.length,
      activeCount,
      deletedCount,
      recipes: allRecipes
    });
  } catch (error) {
    console.error('Error fetching all recipes:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch all recipes',
      details: error.message 
    });
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