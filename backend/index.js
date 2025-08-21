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
  votedUsers: [{
    email: String,
    voteType: {
      type: String,
      enum: ['upvote', 'downvote']
    }
  }],
  isActive: {
    type: Number,
    default: 1,
    enum: [0, 1] // 0 = hidden/deleted, 1 = active/visible
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  deletedAt: {
    type: Date,
    default: null
  },
  updatedAt: {
    type: Date,
    default: null
  }
});

const Recipe = mongoose.model('Recipe', recipeSchema);

// Migration function to ensure all recipes have votedUsers field
async function ensureVotedUsersField() {
  try {
    const result = await Recipe.updateMany(
      { votedUsers: { $exists: false } },
      { 
        $set: { 
          votedUsers: [],
          upvotes: 0,
          downvotes: 0
        }
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`✅ Added votedUsers field to ${result.modifiedCount} recipes`);
    }
  } catch (error) {
    console.error('❌ Error in votedUsers migration:', error);
  }
}

// Run migration when server starts
mongoose.connection.once('open', () => {
  ensureVotedUsersField();
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

// Get user profile by email (for viewing other users' profiles)
app.get('/api/users/profile/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const result = await pool.query(
      'SELECT username, email, dob, phone, point, created_at FROM users WHERE email = $1',
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
        dateOfBirth: user.dob,
        phone: user.phone,
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

// Update user profile
app.put('/api/users/profile/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const { username, newEmail } = req.body;

    // Validate input
    if (!username || !newEmail) {
      return res.status(400).json({
        success: false,
        message: 'Username and email are required'
      });
    }

    // Check if the new email is already taken by another user
    if (newEmail !== email) {
      const existingUser = await pool.query(
        'SELECT * FROM users WHERE email = $1 AND email != $2',
        [newEmail, email]
      );
      
      if (existingUser.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email is already taken by another user'
        });
      }
    }

    // Update user profile
    const result = await pool.query(
      'UPDATE users SET username = $1, email = $2 WHERE email = $3 RETURNING username, email, point, created_at',
      [username, newEmail, email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // If email changed, update all MongoDB recipes with the new authorEmail
    if (newEmail !== email) {
      try {
        // Update authorEmail for recipes they own
        const mongoUpdateResult = await Recipe.updateMany(
          { authorEmail: email },
          { 
            authorEmail: newEmail,
            author: username 
          }
        );

        // Update votedUsers array for recipes they've voted on
        // First update using positional operator $ for recipes where user has voted
        const voteUpdateResult = await Recipe.updateMany(
          { "votedUsers.email": email },
          { 
            $set: { "votedUsers.$.email": newEmail }
          }
        );

        // Handle potential edge case where user has multiple votes
        // Only update recipes that actually have votedUsers field
        await Recipe.updateMany(
          { 
            votedUsers: { $exists: true },
            "votedUsers.email": email 
          },
          {
            $set: {
              "votedUsers.$[elem].email": newEmail
            }
          },
          {
            arrayFilters: [{ "elem.email": email }]
          }
        );

        // console.log(`Updated authorEmail in ${mongoUpdateResult.modifiedCount} recipes`);
        // console.log(`Updated votedUsers email in ${voteUpdateResult.modifiedCount} recipes`);
      } catch (mongoErr) {
        console.error('Error updating MongoDB recipes:', mongoErr);
      }
    } else if (username) {
      // If only username changed, update just the author field
      try {
        const mongoUpdateResult = await Recipe.updateMany(
          { authorEmail: email },
          { author: username }
        );
      } catch (mongoErr) {
        console.error('❌ Error updating MongoDB recipes username:', mongoErr);
      }
    }

    const updatedUser = result.rows[0];
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        username: updatedUser.username,
        email: updatedUser.email,
        points: updatedUser.point,
        memberSince: updatedUser.created_at
      }
    });
  } catch (err) {
    console.error('Error updating user profile:', err);
    
    // Handle database constraint violations
    if (err.code === '23505' && err.constraint === 'users_email_key') {
      return res.status(400).json({
        success: false,
        message: 'Email is already taken by another user'
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to update user profile' 
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

// Update a recipe
app.put('/api/recipes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      cookingTime,
      difficulty,
      category
    } = req.body;

    // Validate required fields
    if (!title || !description || !cookingTime || !category) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: title, description, cookingTime, category' 
      });
    }

    // Find and update the recipe
    const updatedRecipe = await Recipe.findByIdAndUpdate(
      id,
      {
        title,
        description,
        cookingTime,
        difficulty: difficulty || 'Easy',
        category,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!updatedRecipe) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found'
      });
    }

    res.json({
      success: true,
      message: 'Recipe updated successfully!',
      recipe: updatedRecipe
    });

  } catch (error) {
    console.error('Error updating recipe:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update recipe',
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

// Vote on a recipe 
app.post('/api/recipes/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;
    const { voteType, userEmail } = req.body; // voteType: 'upvote', 'downvote', or 'remove'

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        error: 'User email is required'
      });
    }

    if (!['upvote', 'downvote', 'remove'].includes(voteType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid vote type. Must be upvote, downvote, or remove'
      });
    }

    const recipe = await Recipe.findOne({ _id: id, isActive: 1 });
    
    if (!recipe) {
      return res.status(404).json({ 
        success: false,
        error: 'Recipe not found or has been removed' 
      });
    }

    // Find existing vote by this user
    const existingVoteIndex = recipe.votedUsers.findIndex(vote => vote.email === userEmail);
    const existingVote = existingVoteIndex !== -1 ? recipe.votedUsers[existingVoteIndex] : null;

    // Clean up any duplicate votes for this user (security fix for email change exploit)
    const allUserVotes = recipe.votedUsers.filter(vote => vote.email === userEmail);
    if (allUserVotes.length > 1) {
      console.log(`🔧 Cleaning up ${allUserVotes.length} duplicate votes for user ${userEmail} on recipe ${id}`);
      
      // Remove all votes from this user
      recipe.votedUsers = recipe.votedUsers.filter(vote => vote.email !== userEmail);
      
      // Recalculate vote counts by counting actual votes
      const recalculatedUpvotes = recipe.votedUsers.filter(vote => vote.voteType === 'upvote').length;
      const recalculatedDownvotes = recipe.votedUsers.filter(vote => vote.voteType === 'downvote').length;
      
      recipe.upvotes = recalculatedUpvotes;
      recipe.downvotes = recalculatedDownvotes;
      
      // If user had any votes, use the most recent vote type
      const lastVote = allUserVotes[allUserVotes.length - 1];
      if (lastVote && lastVote.voteType !== voteType) {
        // Re-add their last vote for clean state
        recipe.votedUsers.push({ email: userEmail, voteType: lastVote.voteType });
        if (lastVote.voteType === 'upvote') {
          recipe.upvotes += 1;
        } else if (lastVote.voteType === 'downvote') {
          recipe.downvotes += 1;
        }
      }
    }

    // Now handle the current vote normally
    const cleanExistingVoteIndex = recipe.votedUsers.findIndex(vote => vote.email === userEmail);
    const cleanExistingVote = cleanExistingVoteIndex !== -1 ? recipe.votedUsers[cleanExistingVoteIndex] : null;

    let upvoteChange = 0;
    let downvoteChange = 0;

    // Remove existing vote if it exists
    if (cleanExistingVote) {
      if (cleanExistingVote.voteType === 'upvote') {
        upvoteChange -= 1;
      } else if (cleanExistingVote.voteType === 'downvote') {
        downvoteChange -= 1;
      }
      recipe.votedUsers.splice(cleanExistingVoteIndex, 1);
    }

    // Add new vote if not removing
    if (voteType !== 'remove') {
      if (voteType === 'upvote') {
        upvoteChange += 1;
      } else if (voteType === 'downvote') {
        downvoteChange += 1;
      }
      recipe.votedUsers.push({ email: userEmail, voteType });
    }

    // Update vote counts
    recipe.upvotes = Math.max(0, recipe.upvotes + upvoteChange);
    recipe.downvotes = Math.max(0, recipe.downvotes + downvoteChange);

    await recipe.save();

    res.json({
      success: true,
      message: `Recipe ${voteType === 'remove' ? 'vote removed' : voteType + 'd'}!`,
      upvotes: recipe.upvotes,
      downvotes: recipe.downvotes,
      netVotes: recipe.upvotes - recipe.downvotes,
      userVote: voteType === 'remove' ? null : voteType
    });
  } catch (error) {
    console.error('Error voting on recipe:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to vote on recipe',
      details: error.message 
    });
  }
});

// Get user vote status for a recipe
app.get('/api/recipes/:id/vote-status/:userEmail', async (req, res) => {
  try {
    const { id, userEmail } = req.params;

    const recipe = await Recipe.findOne({ _id: id, isActive: 1 });
    
    if (!recipe) {
      return res.status(404).json({ 
        success: false,
        error: 'Recipe not found or has been removed' 
      });
    }

    const userVote = recipe.votedUsers.find(vote => vote.email === userEmail);

    res.json({
      success: true,
      userVote: userVote ? userVote.voteType : null,
      upvotes: recipe.upvotes,
      downvotes: recipe.downvotes,
      netVotes: recipe.upvotes - recipe.downvotes
    });
  } catch (error) {
    console.error('Error getting vote status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get vote status',
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

// Clean up duplicate votes (admin/maintenance endpoint)
app.post('/api/admin/cleanup-votes', async (req, res) => {
  try {
    const recipes = await Recipe.find({});
    let totalCleaned = 0;
    let recipesAffected = 0;

    for (const recipe of recipes) {
      const userVoteCounts = {};
      let hasDuplicates = false;

      // Count votes per user
      recipe.votedUsers.forEach(vote => {
        if (userVoteCounts[vote.email]) {
          userVoteCounts[vote.email]++;
          hasDuplicates = true;
        } else {
          userVoteCounts[vote.email] = 1;
        }
      });

      if (hasDuplicates) {
        console.log(`🔧 Cleaning duplicates in recipe: ${recipe.title}`);
        
        // Keep only the last vote for each user
        const cleanedVotes = [];
        const processedUsers = new Set();

        // Process votes in reverse order to keep the most recent
        for (let i = recipe.votedUsers.length - 1; i >= 0; i--) {
          const vote = recipe.votedUsers[i];
          if (!processedUsers.has(vote.email)) {
            cleanedVotes.unshift(vote);
            processedUsers.add(vote.email);
          } else {
            totalCleaned++;
          }
        }

        // Recalculate vote counts
        const upvotes = cleanedVotes.filter(v => v.voteType === 'upvote').length;
        const downvotes = cleanedVotes.filter(v => v.voteType === 'downvote').length;

        // Update the recipe
        await Recipe.updateOne(
          { _id: recipe._id },
          {
            votedUsers: cleanedVotes,
            upvotes: upvotes,
            downvotes: downvotes
          }
        );

        recipesAffected++;
      }
    }

    res.json({
      success: true,
      message: `Cleanup completed! Removed ${totalCleaned} duplicate votes from ${recipesAffected} recipes.`,
      duplicatesRemoved: totalCleaned,
      recipesAffected: recipesAffected
    });
  } catch (error) {
    console.error('Error during vote cleanup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup votes',
      details: error.message
    });
  }
});

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