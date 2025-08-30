require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const mongoose = require('mongoose');
const { sendWelcomeEmail } = require('./emailService');
const { generateApiConfig } = require('../scripts/generateApiConfig');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

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
  image: {
    type: String,
    default: null
  },
  imageStatus: {
    type: String,
    enum: ['none', 'pending', 'processing', 'ready', 'failed'],
    default: 'none'
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

// Comment Schema for MongoDB
const commentSchema = new mongoose.Schema({
  recipeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recipe',
    required: true,
    index: true // For fast lookups
  },
  authorEmail: {
    type: String,
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 1000 // Prevent long comments
  },
  parentCommentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null // For nested replies
  },
  isActive: {
    type: Number,
    default: 1,
    enum: [0, 1]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: null
  },
  deletedAt: {
    type: Date,
    default: null
  }
});

const Comment = mongoose.model('Comment', commentSchema);

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
      'SELECT username, email, dob, phone, points, created_at, profile_image_url FROM users WHERE email = $1',
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
        points: user.points,
        memberSince: user.created_at,
        profileImageUrl: user.profile_image_url
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

    // Update user profile (SQL)
    const result = await pool.query(
      'UPDATE users SET username = $1, email = $2 WHERE email = $3 RETURNING username, email, points, created_at',
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
        // Update authorEmail for recipes authored by this user
        const mongoUpdateResult = await Recipe.updateMany(
          { authorEmail: email },
          { 
            authorEmail: newEmail,
            author: username 
          }
        );

        // Update votedUsers array for recipes they've voted on
        const voteUpdateResult = await Recipe.updateMany(
          { "votedUsers.email": email },
          { 
            $set: { "votedUsers.$.email": newEmail }
          }
        );

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

        // Update comments collection when email changes
        const commentEmailUpdateResult = await Comment.updateMany(
          { authorEmail: email },
          { 
            authorEmail: newEmail,
            authorName: username 
          }
        );

        // console.log(`Updated authorEmail in ${mongoUpdateResult.modifiedCount} recipes`);
        // console.log(`Updated votedUsers email in ${voteUpdateResult.modifiedCount} recipes`);
        // console.log(`Updated authorEmail in ${commentEmailUpdateResult.modifiedCount} comments`);
      } catch (mongoErr) {
        console.error('Error updating MongoDB recipes and comments:', mongoErr);
      }
    } else if (username) {
      // If only username changed, update just the author field
      try {
        const mongoUpdateResult = await Recipe.updateMany(
          { authorEmail: email },
          { author: username }
        );

        // Update comments collection when username changes
        const commentUsernameUpdateResult = await Comment.updateMany(
          { authorEmail: email },
          { authorName: username }
        );

        console.log(`Updated author name in ${mongoUpdateResult.modifiedCount} recipes`);
        console.log(`Updated authorName in ${commentUsernameUpdateResult.modifiedCount} comments`);
      } catch (mongoErr) {
        console.error('Error updating MongoDB recipes and comments username:', mongoErr);
      }
    }

    // Return success response
    const updatedUser = result.rows[0];
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        username: updatedUser.username,
        email: updatedUser.email,
        points: updatedUser.points,
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

// Upload profile image
app.post('/api/users/profile/:email/upload-image', upload.single('profileImage'), async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Verify user exists
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Upload to Cloudinary
    const uploadPromise = new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder: 'recipe_forum/profile_images',
          public_id: `profile_${email.replace('@', '_at_').replace('.', '_dot_')}`,
          overwrite: true,
          transformation: [
            { width: 300, height: 300, crop: 'fill', gravity: 'face' },
            { quality: 'auto:good' }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    const uploadResult = await uploadPromise;

    // Update user profile with image URL
    const updateResult = await pool.query(
      'UPDATE users SET profile_image_url = $1 WHERE email = $2 RETURNING username, email, profile_image_url',
      [uploadResult.secure_url, email]
    );

    res.json({
      success: true,
      message: 'Profile image uploaded successfully',
      imageUrl: uploadResult.secure_url,
      user: updateResult.rows[0]
    });

  } catch (error) {
    console.error('Error uploading profile image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile image'
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

// Add profile_image_url column if it doesn't exist
async function ensureProfileImageColumn() {
  try {
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS profile_image_url TEXT
    `);
    console.log('✅ Cloudinary connected successfully');
  } catch (err) {
    console.error('Error adding profile_image_url column:', err.message);
  }
}

ensureCreatedAtColumn();
ensureProfileImageColumn();

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
      'INSERT INTO users (username, email, password, dob, phone, points, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING user_id, username, email, dob, phone, points, created_at',
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
      'SELECT user_id, username, email, password, dob, phone, points, created_at FROM users WHERE email = $1',
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
        points: user.points
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

// Upload image to Cloudinary
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'recipe-forum',
          transformation: [
            { width: 600, height: 400, crop: 'limit' }, 
            { quality: '70' } 
          ],
          eager: [
            { width: 300, height: 200, crop: 'fill' } 
          ],
          resource_type: 'auto'
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    res.json({
      success: true,
      imageUrl: result.secure_url,
      publicId: result.public_id
    });

  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Update recipe image asynchronously
app.put('/api/recipes/:id/image', async (req, res) => {
  try {
    const { id } = req.params;
    const { imageUrl, imageStatus } = req.body;

    const updatedRecipe = await Recipe.findByIdAndUpdate(
      id,
      {
        image: imageUrl,
        imageStatus: imageStatus || 'ready',
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!updatedRecipe) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found'
      });
    }

    res.json({
      success: true,
      message: 'Recipe image updated successfully',
      recipe: updatedRecipe
    });

  } catch (error) {
    console.error('Error updating recipe image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update recipe image'
    });
  }
});

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
      authorEmail,
      image,
      imageStatus
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
      authorEmail,
      image: image || null,
      imageStatus: imageStatus || (image ? 'ready' : 'none')
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
      category,
      image
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
        ...(image !== undefined && { image: image }),
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

// Get all recipes (only active ones) - Optimized MongoDB query
app.get('/api/recipes', async (req, res) => {
  try {
    // MongoDB advantage: Single query vs multiple JOINs in SQL
    // This would require 4+ table JOINs in pure SQL (recipes, users, ingredients, instructions, votes)
    const startTime = Date.now();
    
    const recipes = await Recipe.find({ isActive: 1 })
      .sort({ createdAt: -1 })
      .select('title description cookingTime difficulty category author authorEmail upvotes downvotes createdAt image imageStatus');
    
    const queryTime = Date.now() - startTime;
    // console.log(`MongoDB Recipe Query Performance: ${queryTime}ms for ${recipes.length} recipes`);
    
    res.json({
      success: true,
      count: recipes.length,
      recipes,
      performance: {
        queryTime: `${queryTime}ms`,
        advantage: "Single document query vs 4+ table JOINs in SQL"
      }
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

// Helper function to update author points based on net votes
async function updateAuthorPoints(authorEmail) {
  try {
    // Get all recipes by this author
    const authorRecipes = await Recipe.find({ 
      authorEmail: authorEmail, 
      isActive: 1 
    });

    // Calculate total net votes across all their recipes
    let totalPoints = 0;
    authorRecipes.forEach(recipe => {
      const netVotes = (recipe.upvotes || 0) - (recipe.downvotes || 0);
      totalPoints += netVotes;
      // console.log(`Recipe "${recipe.title}": ${recipe.upvotes || 0} upvotes - ${recipe.downvotes || 0} downvotes = ${netVotes} net`);
    });

    // Ensure points can't go negative
    totalPoints = Math.max(0, totalPoints);

    // Update user points in PostgreSQL (using 'points' column name)
    const updateQuery = 'UPDATE users SET points = $1 WHERE email = $2';
    await pool.query(updateQuery, [totalPoints, authorEmail]);

    // console.log(`Updated points for ${authorEmail}: ${totalPoints} points`);
    return totalPoints;
  } catch (error) {
    console.error('Error updating author points:', error);
    throw error;
  }
}

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

    // Clean up any duplicate votes for this user
    const allUserVotes = recipe.votedUsers.filter(vote => vote.email === userEmail);
    if (allUserVotes.length > 1) {
      console.log(`Cleaning up ${allUserVotes.length} duplicate votes for user ${userEmail} on recipe ${id}`);
      
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

    // Update author points based on net votes
    try {
      await updateAuthorPoints(recipe.authorEmail);
    } catch (pointError) {
      console.error('Error updating author points:', pointError);
      // Don't fail the vote if point update fails
    }

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

// ==================== COMMENT ENDPOINTS (MongoDB) ====================

// Get comments for a specific recipe
app.get('/api/recipes/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query; // Default pagination

    // Validate recipe exists and is active
    const recipe = await Recipe.findOne({ _id: id, isActive: 1 });
    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found or has been removed'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get comments for this recipe (only top-level comments first)
    const comments = await Comment.find({ 
      recipeId: id, 
      isActive: 1,
      parentCommentId: null // Only top-level comments
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    // Get total count for pagination
    const totalComments = await Comment.countDocuments({ 
      recipeId: id, 
      isActive: 1,
      parentCommentId: null
    });

    // Get replies for each comment
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const replies = await Comment.find({
          parentCommentId: comment._id,
          isActive: 1
        }).sort({ createdAt: 1 }); // Replies in chronological order

        return {
          ...comment.toObject(),
          replies: replies
        };
      })
    );

    res.json({
      success: true,
      comments: commentsWithReplies,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalComments / parseInt(limit)),
        totalComments,
        hasNextPage: skip + comments.length < totalComments,
        hasPreviousPage: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch comments',
      details: error.message
    });
  }
});

// Post a new comment
app.post('/api/recipes/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, authorEmail, authorName, parentCommentId = null } = req.body;

    // Validate required fields
    if (!content || !authorEmail || !authorName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: content, authorEmail, authorName'
      });
    }

    // Validate content length
    if (content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Comment content cannot be empty'
      });
    }

    if (content.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Comment content cannot exceed 1000 characters'
      });
    }

    // Validate recipe exists and is active
    const recipe = await Recipe.findOne({ _id: id, isActive: 1 });
    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found or has been removed'
      });
    }

    // If replying to a comment, validate parent comment exists
    if (parentCommentId) {
      const parentComment = await Comment.findOne({ 
        _id: parentCommentId, 
        recipeId: id,
        isActive: 1 
      });
      
      if (!parentComment) {
        return res.status(404).json({
          success: false,
          error: 'Parent comment not found'
        });
      }
    }

    // Create new comment
    const comment = new Comment({
      recipeId: id,
      content: content.trim(),
      authorEmail,
      authorName,
      parentCommentId
    });

    const savedComment = await comment.save();

    res.status(201).json({
      success: true,
      message: 'Comment posted successfully!',
      comment: savedComment
    });

  } catch (error) {
    console.error('Error posting comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to post comment',
      details: error.message
    });
  }
});

// Update/Edit a comment
app.put('/api/comments/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content, userEmail } = req.body;

    // Validate required fields
    if (!content || !userEmail) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: content, userEmail'
      });
    }

    // Validate content
    if (content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Comment content cannot be empty'
      });
    }

    if (content.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Comment content cannot exceed 1000 characters'
      });
    }

    // Find comment and verify ownership
    const comment = await Comment.findOne({ 
      _id: commentId, 
      isActive: 1 
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found'
      });
    }

    // Check if user owns this comment
    if (comment.authorEmail !== userEmail) {
      return res.status(403).json({
        success: false,
        error: 'You can only edit your own comments'
      });
    }

    // Update comment
    const updatedComment = await Comment.findByIdAndUpdate(
      commentId,
      {
        content: content.trim(),
        updatedAt: new Date()
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Comment updated successfully!',
      comment: updatedComment
    });

  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update comment',
      details: error.message
    });
  }
});

// Soft delete a comment
app.delete('/api/comments/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        error: 'User email is required'
      });
    }

    // Find comment and verify ownership
    const comment = await Comment.findOne({ 
      _id: commentId, 
      isActive: 1 
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found'
      });
    }

    // Check if user owns this comment
    if (comment.authorEmail !== userEmail) {
      return res.status(403).json({
        success: false,
        error: 'You can only delete your own comments'
      });
    }

    // Soft delete the comment
    const deletedComment = await Comment.findByIdAndUpdate(
      commentId,
      {
        isActive: 0,
        deletedAt: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );

    // Also soft delete any replies to this comment
    await Comment.updateMany(
      { parentCommentId: commentId, isActive: 1 },
      {
        isActive: 0,
        deletedAt: new Date(),
        updatedAt: new Date()
      }
    );

    res.json({
      success: true,
      message: 'Comment deleted successfully!',
      deletedComment: {
        id: deletedComment._id,
        content: deletedComment.content,
        author: deletedComment.authorName,
        deletedAt: deletedComment.deletedAt
      }
    });

  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete comment',
      details: error.message
    });
  }
});

// Get comment statistics for a recipe
app.get('/api/recipes/:id/comments/stats', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate recipe exists
    const recipe = await Recipe.findOne({ _id: id, isActive: 1 });
    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found or has been removed'
      });
    }

    // Get comment statistics
    const totalComments = await Comment.countDocuments({ 
      recipeId: id, 
      isActive: 1 
    });

    const topLevelComments = await Comment.countDocuments({ 
      recipeId: id, 
      isActive: 1,
      parentCommentId: null
    });

    const replies = totalComments - topLevelComments;

    res.json({
      success: true,
      stats: {
        totalComments,
        topLevelComments,
        replies
      }
    });

  } catch (error) {
    console.error('Error fetching comment stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch comment statistics',
      details: error.message
    });
  }
});

// ==================== ADMIN ENDPOINTS ====================

// Database Analytics - Demonstrates benefits of hybrid architecture
app.get('/api/admin/analytics', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // PostgreSQL - Optimized for user analytics and aggregations
    const userStats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        AVG(points) as avg_points,
        MAX(points) as max_points,
        MIN(points) as min_points
      FROM users
    `);
    
    // MongoDB - Optimized for content analytics
    const recipeStats = await Recipe.aggregate([
      { $match: { isActive: 1 } },
      {
        $group: {
          _id: null,
          totalRecipes: { $sum: 1 },
          avgUpvotes: { $avg: "$upvotes" },
          avgDownvotes: { $avg: "$downvotes" },
          totalVotes: { $sum: { $add: ["$upvotes", "$downvotes"] } },
          categories: { $push: "$category" }
        }
      }
    ]);
    
    const categoryStats = await Recipe.aggregate([
      { $match: { isActive: 1 } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const queryTime = Date.now() - startTime;

    // Clean up unwanted fields
    let cleanRecipeStats = {};
    if (recipeStats[0]) {
      const { _id, ...rest } = recipeStats[0];
      cleanRecipeStats = rest;
    }

    const cleanCategoryStats = categoryStats.map(({ _id }) => ({
      category: _id 
    }));

    res.json({
      success: true,
      performance: {
        queryTime: `${queryTime}ms`,
        architecture: "Hybrid PostgreSQL + MongoDB",
        benefits: [
          "PostgreSQL: ACID compliance for user data aggregations",
          "MongoDB: Flexible aggregation pipeline for content analytics",
          "Optimal performance: Each DB handles what it does best"
        ]
      },
      userAnalytics: userStats.rows[0],
      recipeAnalytics: cleanRecipeStats,
      categoryBreakdown: cleanCategoryStats,
      technicalNotes: {
        sqlComplexity: "Simple aggregation queries on normalized user data",
        nosqlComplexity: "Complex aggregation pipeline on denormalized recipe documents",
        reasoning: "Users need ACID compliance, Recipes need flexible schema and fast reads"
      }
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics',
      details: error.message
    });
  }
});


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
        console.log(`Cleaning duplicates in recipe: ${recipe.title}`);
        
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

// Get all deleted/inactive comments (admin)
app.get('/api/admin/comments/deleted', async (req, res) => {
  try {
    const deletedComments = await Comment.find({ isActive: 0 })
      .populate('recipeId', 'title')
      .sort({ deletedAt: -1 });
    
    res.json({
      success: true,
      count: deletedComments.length,
      comments: deletedComments
    });
  } catch (error) {
    console.error('Error fetching deleted comments:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch deleted comments',
      details: error.message 
    });
  }
});

// Restore a deleted comment (admin)
app.patch('/api/admin/comments/:commentId/restore', async (req, res) => {
  try {
    const comment = await Comment.findOneAndUpdate(
      { _id: req.params.commentId, isActive: 0 },
      { 
        isActive: 1,
        deletedAt: null,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!comment) {
      return res.status(404).json({ 
        success: false,
        error: 'Deleted comment not found' 
      });
    }
    
    res.json({
      success: true,
      message: 'Comment restored successfully!',
      comment: {
        id: comment._id,
        content: comment.content,
        author: comment.authorName
      }
    });
  } catch (error) {
    console.error('Error restoring comment:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to restore comment',
      details: error.message 
    });
  }
});

// Get all comments for admin (active and inactive)
app.get('/api/admin/comments/all', async (req, res) => {
  try {
    const allComments = await Comment.find()
      .populate('recipeId', 'title')
      .sort({ createdAt: -1 });
    
    const activeCount = allComments.filter(c => c.isActive === 1).length;
    const deletedCount = allComments.filter(c => c.isActive === 0).length;
    
    res.json({
      success: true,
      totalCount: allComments.length,
      activeCount,
      deletedCount,
      comments: allComments
    });
  } catch (error) {
    console.error('Error fetching all comments:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch all comments',
      details: error.message 
    });
  }
});

// Get all deleted/inactive recipes
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

// Restore a deleted recipe
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

// Admin endpoint to recalculate all user points based on their recipes' net votes
app.post('/api/admin/recalculate-points', async (req, res) => {
  try {
    // Get all users
    const usersResult = await pool.query('SELECT email FROM users');
    const users = usersResult.rows;
    
    let updatedCount = 0;
    const results = [];

    for (const user of users) {
      try {
        const newPoints = await updateAuthorPoints(user.email);
        results.push({
          email: user.email,
          points: newPoints
        });
        updatedCount++;
      } catch (error) {
        console.error(`Failed to update points for ${user.email}:`, error);
        results.push({
          email: user.email,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Recalculated points for ${updatedCount} users`,
      totalUsers: users.length,
      results: results
    });
  } catch (error) {
    console.error('Error recalculating points:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to recalculate points',
      details: error.message
    });
  }
});