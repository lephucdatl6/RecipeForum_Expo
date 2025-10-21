require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const { Pool } = require('pg');
const mongoose = require('mongoose');
const { sendWelcomeEmail, sendOrderConfirmationEmail } = require('./emailService');
const { generateApiConfig } = require('../scripts/generateApiConfig');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const aiValidationService = require('./aiValidationService');
const nutritionService = require('./nutritionService');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Test Cloudinary connection
cloudinary.api.ping()
.then(() => console.log('✅ Cloudinary connected successfully'))
.catch(err => console.error('❌ Cloudinary connection error:', err));

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

// Test PostgreSQL connection
pool.connect()
.then(client => {
  console.log('✅ PostgreSQL connected successfully');
  client.release();
})
.catch(err => console.error('❌ PostgreSQL connection error:', err));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Test Gemini AI connection
aiValidationService.testConnection();

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
    ingredientId: Number,
    name: String,
    amount: Number,
    unit: String
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
  },
  nutritionalInfo: {
    totalCalories: {
      type: Number,
      default: null
    },
    servings: {
      type: Number,
      default: null
    },
    caloriesPerServing: {
      type: Number,
      default: null
    },
    macronutrients: {
      carbohydrates: {
        type: Number,
        default: null
      },
      protein: {
        type: Number,
        default: null
      },
      fat: {
        type: Number,
        default: null
      }
    },
    micronutrients: {
      fiber: {
        type: Number,
        default: null
      },
      sugar: {
        type: Number,
        default: null
      },
      sodium: {
        type: Number,
        default: null
      },
      calcium: {
        type: Number,
        default: null
      },
      iron: {
        type: Number,
        default: null
      },
      vitaminC: {
        type: Number,
        default: null
      }
    },
    calculatedAt: {
      type: Date,
      default: null
    },
    ingredientsHash: {
      type: String,
      default: null // Hash of ingredients to detect changes
    },
    notes: {
      type: String,
      default: null // Warning message for database fallback calculations
    }
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

        // console.log(`Updated author name in ${mongoUpdateResult.modifiedCount} recipes`);
        // console.log(`Updated authorName in ${commentUsernameUpdateResult.modifiedCount} comments`);
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

// Create users table
async function ensureUsersTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        dob DATE,
        phone VARCHAR(20),
        points INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        profile_image_url TEXT
      )
    `);
  } catch (err) {
    console.error('Error creating users table:', err.message);
  }
}

// Add ingredients table
async function ensureIngredientsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ingredients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        price DECIMAL(10,2) DEFAULT 0.00,
        package_size DECIMAL(10,2) DEFAULT 1.00,
        package_unit VARCHAR(50) DEFAULT 'pcs',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (err) {
    console.error('Error creating ingredients table:', err.message);
  }
}

// Add shopping cart tables
async function ensureShoppingCartTables() {
  try {
    const userIdTypeQuery = await pool.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'user_id'
    `);
    
    let userIdType = 'INTEGER';
    if (userIdTypeQuery.rows.length > 0) {
      const actualType = userIdTypeQuery.rows[0].data_type;
      if (actualType === 'uuid' || actualType === 'text') {
        userIdType = 'TEXT';
      }
    }

    // Create shopping_carts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shopping_carts (
        id SERIAL PRIMARY KEY,
        user_id ${userIdType} NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `);

    // Create cart_items table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        cart_id INTEGER NOT NULL,
        ingredient_id INTEGER NOT NULL,
        quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
        added_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(cart_id, ingredient_id),
        FOREIGN KEY (cart_id) REFERENCES shopping_carts(id) ON DELETE CASCADE,
        FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
      )
    `);

  } catch (err) {
    console.error('Error creating shopping cart tables:', err.message);
  }
}

// Add user bookmarks table
async function ensureBookmarksTable() {
  try {
    // Get user_id data type to match the users table
    const userIdTypeQuery = await pool.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'user_id'
    `);
    
    let userIdType = 'INTEGER';
    if (userIdTypeQuery.rows.length > 0) {
      const actualType = userIdTypeQuery.rows[0].data_type;
      if (actualType.includes('character') || actualType.includes('varchar') || actualType.includes('uuid')) {
        userIdType = 'TEXT';
      }
    }

    // Create user_bookmarks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_bookmarks (
        id SERIAL PRIMARY KEY,
        user_id ${userIdType} NOT NULL,
        recipe_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, recipe_id)
      )
    `);

  } catch (err) {
    console.error('Error creating bookmarks table:', err.message);
  }
}

// Add orders and order_items tables
async function ensureOrderTables() {
  try {
    const userIdTypeQuery = await pool.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'user_id'
    `);
    
    let userIdType = 'INTEGER';
    if (userIdTypeQuery.rows.length > 0) {
      const actualType = userIdTypeQuery.rows[0].data_type;
      if (actualType.includes('character') || actualType.includes('varchar') || actualType.includes('uuid')) {
        userIdType = 'TEXT';
      }
    }

    // Create orders table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id ${userIdType} NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        delivery_address TEXT NOT NULL,
        payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('Cash', 'Credit')),
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        points_used INTEGER DEFAULT 0,
        discount_amount DECIMAL(10,2) DEFAULT 0.00,
        status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Preparing', 'Shipped', 'Arrived', 'Cancelled')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create order_items table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL,
        ingredient_id INTEGER NOT NULL,
        ingredient_name VARCHAR(255) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
        unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        total_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        package_size DECIMAL(10,2) DEFAULT 1.00,
        package_unit VARCHAR(50) DEFAULT 'pcs',
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `);

  } catch (err) {
    console.error('Error creating order tables:', err.message);
  }
}

// Initialize all tables in proper order
async function initializeTables() {
  await ensureUsersTable();
  await ensureIngredientsTable();
  await ensureShoppingCartTables();
  await ensureBookmarksTable();
  await ensureOrderTables();
}

initializeTables();

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

// ==================== INGREDIENTS ENDPOINTS (PostgreSQL) ====================

// Get all ingredients
app.get('/api/ingredients', async (req, res) => {
  try {
    const { search } = req.query;
    
    let query = 'SELECT * FROM ingredients';
    let queryParams = [];
    
    if (search) {
      query += ' WHERE LOWER(name) LIKE LOWER($1) OR LOWER(description) LIKE LOWER($1)';
      queryParams.push(`%${search}%`);
    }
    
    query += ' ORDER BY name ASC';
    
    const result = await pool.query(query, queryParams);
    res.json({
      success: true,
      ingredients: result.rows
    });
  } catch (err) {
    console.error('Error fetching ingredients:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch ingredients' 
    });
  }
});

// Add new ingredient
app.post('/api/ingredients', async (req, res) => {
  try {
    const { name, description, price, package_size, package_unit } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Ingredient name is required'
      });
    }

    const ingredientPrice = price ? parseFloat(price) : 0.00;
    if (isNaN(ingredientPrice) || ingredientPrice < 0) {
      return res.status(400).json({
        success: false,
        error: 'Price must be a valid non-negative number'
      });
    }

    const ingredientPackageSize = package_size ? parseFloat(package_size) : 1.00;
    if (isNaN(ingredientPackageSize) || ingredientPackageSize <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Package size must be a valid positive number'
      });
    }

    const result = await pool.query(
      'INSERT INTO ingredients (name, description, price, package_size, package_unit) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name.trim(), description?.trim() || null, ingredientPrice, ingredientPackageSize, package_unit || 'piece']
    );

    res.status(201).json({
      success: true,
      message: 'Ingredient added successfully',
      ingredient: result.rows[0]
    });
  } catch (err) {
    console.error('Error adding ingredient:', err);
    
    if (err.code === '23505') { 
      return res.status(400).json({
        success: false,
        error: 'An ingredient with this name already exists'
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to add ingredient' 
    });
  }
});

// Update ingredient
app.put('/api/ingredients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, package_size, package_unit } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Ingredient name is required'
      });
    }

    const ingredientPrice = price ? parseFloat(price) : 0.00;
    if (isNaN(ingredientPrice) || ingredientPrice < 0) {
      return res.status(400).json({
        success: false,
        error: 'Price must be a valid non-negative number'
      });
    }

    const ingredientPackageSize = package_size ? parseFloat(package_size) : 1.00;
    if (isNaN(ingredientPackageSize) || ingredientPackageSize <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Package size must be a valid positive number'
      });
    }

    const result = await pool.query(
      'UPDATE ingredients SET name = $1, description = $2, price = $3, package_size = $4, package_unit = $5, updated_at = NOW() WHERE id = $6 RETURNING *',
      [name.trim(), description?.trim() || null, ingredientPrice, ingredientPackageSize, package_unit || 'piece', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ingredient not found'
      });
    }

    res.json({
      success: true,
      message: 'Ingredient updated successfully',
      ingredient: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating ingredient:', err);
    
    if (err.code === '23505') { 
      return res.status(400).json({
        success: false,
        error: 'An ingredient with this name already exists'
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to update ingredient' 
    });
  }
});

// Delete ingredient
app.delete('/api/ingredients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM ingredients WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ingredient not found'
      });
    }

    res.json({
      success: true,
      message: 'Ingredient deleted successfully',
      ingredient: result.rows[0]
    });
  } catch (err) {
    console.error('Error deleting ingredient:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete ingredient' 
    });
  }
});

// Get single ingredient by ID (for smart cart calculations)
app.get('/api/ingredients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('SELECT * FROM ingredients WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ingredient not found'
      });
    }

    res.json({
      success: true,
      ingredient: result.rows[0]
    });
  } catch (err) {
    console.error('Error fetching ingredient:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch ingredient' 
    });
  }
});

// ==================== SHOPPING CART ENDPOINTS (PostgreSQL) ====================

// Get user's shopping cart
app.get('/api/cart/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get or create cart for user
    let cartResult = await pool.query(
      'SELECT * FROM shopping_carts WHERE user_id = $1',
      [userId]
    );

    if (cartResult.rows.length === 0) {
      // Create new cart
      cartResult = await pool.query(
        'INSERT INTO shopping_carts (user_id) VALUES ($1) RETURNING *',
        [userId]
      );
    }

    const cart = cartResult.rows[0];

    // Get cart items with ingredient details
    const itemsResult = await pool.query(`
      SELECT 
        ci.id,
        ci.quantity,
        ci.added_at,
        i.id as ingredient_id,
        i.name as ingredient_name,
        i.description as ingredient_description,
        i.price as ingredient_price,
        i.package_size,
        i.package_unit
      FROM cart_items ci
      JOIN ingredients i ON ci.ingredient_id = i.id
      WHERE ci.cart_id = $1
      ORDER BY ci.added_at DESC
    `, [cart.id]);

    res.json({
      success: true,
      cart: {
        id: cart.id,
        userId: cart.user_id,
        createdAt: cart.created_at,
        updatedAt: cart.updated_at,
        items: itemsResult.rows,
        totalItems: itemsResult.rows.length,
        totalPrice: itemsResult.rows.reduce((sum, item) => 
          sum + (parseFloat(item.quantity) * parseFloat(item.ingredient_price || 0)), 0
        ).toFixed(2)
      }
    });
  } catch (err) {
    console.error('Error fetching cart:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch cart' 
    });
  }
});

// Add ingredient to cart
app.post('/api/cart/:userId/items', async (req, res) => {
  try {
    const { userId } = req.params;
    const { ingredientId, quantity } = req.body;

    if (!ingredientId || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'Ingredient ID and quantity are required'
      });
    }

    // Validate quantity
    const itemQuantity = parseFloat(quantity);
    if (isNaN(itemQuantity) || itemQuantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be a positive number'
      });
    }

    // Verify ingredient exists
    const ingredientCheck = await pool.query(
      'SELECT * FROM ingredients WHERE id = $1',
      [ingredientId]
    );

    if (ingredientCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ingredient not found'
      });
    }

    // Get or create cart
    let cartResult = await pool.query(
      'SELECT * FROM shopping_carts WHERE user_id = $1',
      [userId]
    );

    if (cartResult.rows.length === 0) {
      cartResult = await pool.query(
        'INSERT INTO shopping_carts (user_id) VALUES ($1) RETURNING *',
        [userId]
      );
    }

    const cart = cartResult.rows[0];

    // Check if item already exists in cart
    const existingItem = await pool.query(
      'SELECT * FROM cart_items WHERE cart_id = $1 AND ingredient_id = $2',
      [cart.id, ingredientId]
    );

    if (existingItem.rows.length > 0) {
      // Update existing item quantity
      const newQuantity = parseFloat(existingItem.rows[0].quantity) + itemQuantity;
      const updateResult = await pool.query(
        'UPDATE cart_items SET quantity = $1 WHERE id = $2 RETURNING *',
        [newQuantity, existingItem.rows[0].id]
      );

      res.json({
        success: true,
        message: 'Cart item quantity updated',
        item: updateResult.rows[0]
      });
    } else {
      // Add new item to cart
      const result = await pool.query(
        'INSERT INTO cart_items (cart_id, ingredient_id, quantity) VALUES ($1, $2, $3) RETURNING *',
        [cart.id, ingredientId, itemQuantity]
      );

      res.status(201).json({
        success: true,
        message: 'Item added to cart',
        item: result.rows[0]
      });
    }

    // Update cart timestamp
    await pool.query(
      'UPDATE shopping_carts SET updated_at = NOW() WHERE id = $1',
      [cart.id]
    );

  } catch (err) {
    console.error('Error adding item to cart:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to add item to cart' 
    });
  }
});

// Update cart item quantity
app.put('/api/cart/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!quantity) {
      return res.status(400).json({
        success: false,
        error: 'Quantity is required'
      });
    }

    const itemQuantity = parseFloat(quantity);
    if (isNaN(itemQuantity) || itemQuantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be a positive number'
      });
    }

    const result = await pool.query(
      'UPDATE cart_items SET quantity = $1 WHERE id = $2 RETURNING *',
      [itemQuantity, itemId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cart item not found'
      });
    }

    // Update cart timestamp
    await pool.query(`
      UPDATE shopping_carts 
      SET updated_at = NOW() 
      WHERE id = (SELECT cart_id FROM cart_items WHERE id = $1)
    `, [itemId]);

    res.json({
      success: true,
      message: 'Cart item updated',
      item: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating cart item:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update cart item' 
    });
  }
});

// Remove item from cart
app.delete('/api/cart/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    const result = await pool.query(
      'DELETE FROM cart_items WHERE id = $1 RETURNING *',
      [itemId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cart item not found'
      });
    }

    // Update cart timestamp
    await pool.query(`
      UPDATE shopping_carts 
      SET updated_at = NOW() 
      WHERE id = $1
    `, [result.rows[0].cart_id]);

    res.json({
      success: true,
      message: 'Item removed from cart',
      item: result.rows[0]
    });
  } catch (err) {
    console.error('Error removing cart item:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to remove cart item' 
    });
  }
});

// Clear entire cart
app.delete('/api/cart/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get cart
    const cartResult = await pool.query(
      'SELECT * FROM shopping_carts WHERE user_id = $1',
      [userId]
    );

    if (cartResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    const cart = cartResult.rows[0];

    // Delete all cart items
    await pool.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);

    // Update cart timestamp
    await pool.query(
      'UPDATE shopping_carts SET updated_at = NOW() WHERE id = $1',
      [cart.id]
    );

    res.json({
      success: true,
      message: 'Cart cleared successfully'
    });
  } catch (err) {
    console.error('Error clearing cart:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to clear cart' 
    });
  }
});

// ==================== BOOKMARK ENDPOINTS (PostgreSQL) ====================

// Add bookmark
app.post('/api/bookmarks', async (req, res) => {
  try {
    const { userId, recipeId } = req.body;

    if (!userId || !recipeId) {
      return res.status(400).json({
        success: false,
        error: 'User ID and Recipe ID are required'
      });
    }

    // Check if user exists
    const userCheck = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Insert bookmark
    const result = await pool.query(
      'INSERT INTO user_bookmarks (user_id, recipe_id) VALUES ($1, $2) RETURNING *',
      [userId, recipeId]
    );

    res.status(201).json({
      success: true,
      message: 'Recipe bookmarked successfully',
      bookmark: result.rows[0]
    });
  } catch (err) {
    console.error('Error adding bookmark:', err);
    
    // Handle duplicate bookmark
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Recipe is already bookmarked'
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to add bookmark' 
    });
  }
});

// Remove bookmark
app.delete('/api/bookmarks', async (req, res) => {
  try {
    const { userId, recipeId } = req.body;

    if (!userId || !recipeId) {
      return res.status(400).json({
        success: false,
        error: 'User ID and Recipe ID are required'
      });
    }

    const result = await pool.query(
      'DELETE FROM user_bookmarks WHERE user_id = $1 AND recipe_id = $2 RETURNING *',
      [userId, recipeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Bookmark not found'
      });
    }

    res.json({
      success: true,
      message: 'Bookmark removed successfully',
      bookmark: result.rows[0]
    });
  } catch (err) {
    console.error('Error removing bookmark:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to remove bookmark' 
    });
  }
});

// Get user bookmarks
app.get('/api/bookmarks/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get all bookmarked recipe IDs for the user
    const bookmarksResult = await pool.query(
      'SELECT recipe_id, created_at FROM user_bookmarks WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    const recipeIds = bookmarksResult.rows.map(row => row.recipe_id);

    if (recipeIds.length === 0) {
      return res.json({
        success: true,
        bookmarks: [],
        recipes: [],
        count: 0
      });
    }

    // Get recipe details from MongoDB
    const recipes = await Recipe.find({ 
      _id: { $in: recipeIds }, 
      isActive: 1 
    }).select('title description cookingTime difficulty category author authorEmail upvotes downvotes createdAt image imageStatus');

    // Sort recipes by bookmark creation date
    const bookmarkMap = new Map();
    bookmarksResult.rows.forEach(row => {
      bookmarkMap.set(row.recipe_id, row.created_at);
    });

    const sortedRecipes = recipes.sort((a, b) => {
      const aBookmarkDate = bookmarkMap.get(a._id.toString());
      const bBookmarkDate = bookmarkMap.get(b._id.toString());
      return new Date(bBookmarkDate) - new Date(aBookmarkDate);
    });

    res.json({
      success: true,
      bookmarks: bookmarksResult.rows,
      recipes: sortedRecipes,
      count: sortedRecipes.length
    });
  } catch (err) {
    console.error('Error fetching bookmarks:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch bookmarks' 
    });
  }
});

// Check if recipe is bookmarked by user
app.get('/api/bookmarks/:userId/:recipeId', async (req, res) => {
  try {
    const { userId, recipeId } = req.params;

    const result = await pool.query(
      'SELECT * FROM user_bookmarks WHERE user_id = $1 AND recipe_id = $2',
      [userId, recipeId]
    );

    res.json({
      success: true,
      isBookmarked: result.rows.length > 0,
      bookmark: result.rows[0] || null
    });
  } catch (err) {
    console.error('Error checking bookmark status:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to check bookmark status' 
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

// Validate ingredients endpoint (legacy - keeping for backward compatibility)
app.post('/api/validate-ingredients', async (req, res) => {
  try {
    const { ingredients } = req.body;

    if (!ingredients || !Array.isArray(ingredients)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ingredients data'
      });
    }

    // Use AI validation service to check ingredient units
    const unitValidation = await aiValidationService.validateIngredientUnits(ingredients);
    
    res.json({
      success: true,
      warnings: unitValidation.warnings || []
    });

  } catch (error) {
    console.error('Error validating ingredients:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate ingredients',
      warnings: []
    });
  }
});

// Combined validation endpoint for recipe content and ingredients
app.post('/api/validate-recipe', async (req, res) => {
  try {
    const { title, description, category, ingredients } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({
        success: false,
        error: 'Title, description, and category are required'
      });
    }

    // Use AI validation service to check both content and ingredient units
    const validation = await aiValidationService.validateRecipeComplete(
      title, 
      description, 
      category, 
      ingredients || []
    );
    
    res.json({
      success: true,
      contentValid: validation.contentValid,
      contentReason: validation.contentReason,
      unitWarnings: validation.unitWarnings
    });

  } catch (error) {
    console.error('Error validating recipe:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate recipe',
      contentValid: true,
      unitWarnings: []
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

    // Basic ingredient validation - check for zero or negative amounts
    if (ingredients && ingredients.length > 0) {
      const invalidIngredients = ingredients.filter(ingredient => ingredient.amount <= 0);
      if (invalidIngredients.length > 0) {
        return res.status(400).json({ 
          error: 'All ingredients must have an amount greater than 0' 
        });
      }
    }

    // Note: AI validation is now done upfront in the frontend via /api/validate-recipe
    // This avoids duplicate validation and improves performance

    const recipe = new Recipe({
      title,
      description,
      ingredients: ingredients || [],
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
      ingredients,
      image,
      imageStatus
    } = req.body;

    // Validate required fields
    if (!title || !description || !cookingTime || !category) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: title, description, cookingTime, category' 
      });
    }

    // Update AI Content Validation existing recipe
    console.log('Validating recipe content with AI...');
    const aiValidation = await aiValidationService.validateRecipe(title, description, category);
    if (!aiValidation.isValid) {
      return res.status(400).json({ 
        success: false,
        error: `Content validation failed: ${aiValidation.reason}`,
        validationError: true
      });
    }

    // Validate ingredients - check for zero or negative amounts
    if (ingredients && ingredients.length > 0) {
      const invalidIngredients = ingredients.filter(ingredient => ingredient.amount <= 0);
      if (invalidIngredients.length > 0) {
        return res.status(400).json({ 
          success: false,
          error: 'All ingredients must have an amount greater than 0' 
        });
      }
    }

    // AI Ingredient Unit Validation (warnings only)
    let unitWarnings = [];
    if (ingredients && ingredients.length > 0) {
      console.log('Validating ingredient units with AI...');
      const unitValidation = await aiValidationService.validateIngredientUnits(ingredients);
      unitWarnings = unitValidation.warnings || [];
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
        ...(ingredients !== undefined && { ingredients: ingredients }),
        ...(image !== undefined && { image: image }),
        ...(imageStatus !== undefined && { imageStatus: imageStatus }),
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

    const response = {
      success: true,
      message: 'Recipe updated successfully!',
      recipe: updatedRecipe
    };

    // Include unit warnings if any
    if (unitWarnings.length > 0) {
      response.unitWarnings = unitWarnings;
      response.message = 'Recipe updated successfully! Note: Some ingredient units may not be typical for those ingredients.';
    }

    res.json(response);

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

// Function to update author points based on incremental vote change
async function updateAuthorPointsIncremental(authorEmail, voteChange) {
  try {
    // voteChange: +1 for new upvote, -1 for new downvote, 0 for no net change
    const pointsChange = voteChange * 150;
    
    if (pointsChange === 0) {
      return;
    }

    // Get current user points from PostgreSQL
    const currentUserQuery = 'SELECT points FROM users WHERE email = $1';
    const currentUserResult = await pool.query(currentUserQuery, [authorEmail]);
    
    if (currentUserResult.rows.length === 0) {
      console.error(`User not found for email: ${authorEmail}`);
      return;
    }

    const currentPoints = currentUserResult.rows[0].points || 0;
    const newPoints = Math.max(0, currentPoints + pointsChange); // Points can't go negative

    // Update user points incrementally
    const updateQuery = 'UPDATE users SET points = $1 WHERE email = $2';
    await pool.query(updateQuery, [newPoints, authorEmail]);

    // console.log(`Updated points for ${authorEmail}: ${currentPoints} + ${pointsChange} = ${newPoints} points`);
    return newPoints;
  } catch (error) {
    console.error('Error updating author points incrementally:', error);
    throw error;
  }
}

// Helper function to recalculate total author points
async function recalculateAuthorPoints(authorEmail) {
  try {
    // Get all recipes by this author
    const authorRecipes = await Recipe.find({ 
      authorEmail: authorEmail, 
      isActive: 1 
    });

    // Calculate total net votes across all their recipes
    let totalVotePoints = 0;
    authorRecipes.forEach(recipe => {
      const netVotes = (recipe.upvotes || 0) - (recipe.downvotes || 0);
      const points = netVotes * 150; // Net vote is set to 150 points for demo
      totalVotePoints += points;
    });

    // Get current user points from PostgreSQL
    const currentUserQuery = 'SELECT points FROM users WHERE email = $1';
    const currentUserResult = await pool.query(currentUserQuery, [authorEmail]);
    
    if (currentUserResult.rows.length === 0) {
      console.error(`User not found for email: ${authorEmail}`);
      return;
    }

    const currentPoints = currentUserResult.rows[0].points || 0;
    // console.log(`${authorEmail}: Current points: ${currentPoints}, Vote-based points: ${totalVotePoints}`);
    
    return currentPoints;
  } catch (error) {
    console.error('Error recalculating author points:', error);
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

    // Update author points incrementally based on the net change in votes
    try {
      const netVoteChange = upvoteChange - downvoteChange;
      await updateAuthorPointsIncremental(recipe.authorEmail, netVoteChange);
    } catch (pointError) {
      console.error('Error updating author points incrementally:', pointError);
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

// Utility function to generate hash of ingredients for cache validation
const crypto = require('crypto');

function generateIngredientsHash(ingredients) {
  if (!ingredients || ingredients.length === 0) {
    return null;
  }
  
  // Create a consistent string representation of ingredients
  const ingredientsString = ingredients
    .map(ing => `${ing.ingredientId}-${ing.name}-${ing.amount}-${ing.unit}`)
    .sort() 
    .join('|');
  
  return crypto.createHash('md5').update(ingredientsString).digest('hex');
}

// Calculate nutritional information for a recipe
app.post('/api/recipes/:id/nutrition', async (req, res) => {
  try {
    const { id } = req.params;
    const { forceRecalculate = false } = req.body;

    // Get recipe data
    const recipe = await Recipe.findOne({ _id: id, isActive: 1 });
    
    if (!recipe) {
      return res.status(404).json({ 
        success: false,
        error: 'Recipe not found or has been removed' 
      });
    }

    if (!recipe.ingredients || recipe.ingredients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Recipe has no ingredients to analyze'
      });
    }

    // Generate current ingredients hash
    const currentIngredientsHash = generateIngredientsHash(recipe.ingredients);

    // Check if have cached nutrition data
    const hasCachedNutrition = recipe.nutritionalInfo && 
                              recipe.nutritionalInfo.totalCalories !== null &&
                              recipe.nutritionalInfo.ingredientsHash === currentIngredientsHash;

    // Check for existing warning notes in cached data
    const hasWarningNotes = recipe.nutritionalInfo && recipe.nutritionalInfo.notes;
    const shouldForceRecalculation = forceRecalculate || hasWarningNotes;

    if (hasCachedNutrition && !shouldForceRecalculation) {
      // Return cached data
      return res.json({
        success: true,
        nutritionalInfo: {
          totalCalories: recipe.nutritionalInfo.totalCalories,
          servings: recipe.nutritionalInfo.servings,
          caloriesPerServing: recipe.nutritionalInfo.caloriesPerServing,
          macronutrients: recipe.nutritionalInfo.macronutrients,
          micronutrients: recipe.nutritionalInfo.micronutrients,
          notes: recipe.nutritionalInfo.notes
        },
        calculatedAt: recipe.nutritionalInfo.calculatedAt,
        cached: true
      });
    }

    // Calculate new nutrition data using nutrition service
    const nutritionResult = await nutritionService.calculateNutritionalInfo(
      recipe.ingredients, 
      recipe.nutritionalInfo
    );

    if (!nutritionResult.success) {
      return res.status(500).json({
        success: false,
        error: nutritionResult.error || 'Failed to calculate nutritional information'
      });
    }

    // Cache the nutrition data in the database
    const calculatedAt = new Date();
    recipe.nutritionalInfo = {
      ...nutritionResult.nutritionalInfo,
      calculatedAt: calculatedAt,
      ingredientsHash: currentIngredientsHash
    };

    await recipe.save();

    res.json({
      success: true,
      nutritionalInfo: nutritionResult.nutritionalInfo,
      calculatedAt: calculatedAt.toISOString(),
      cached: false,
      warning: nutritionResult.warning,
      databaseFallback: nutritionResult.databaseFallback,
      unknownIngredients: nutritionResult.unknownIngredients
    });

  } catch (error) {
    console.error('Error calculating nutrition:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to calculate nutritional information',
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
    const { page = 1, limit = 20 } = req.query;

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
        }).sort({ createdAt: 1 });

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

// Clear cart endpoint
app.delete('/api/cart/clear', async (req, res) => {
  const { userEmail } = req.body;
  
  try {
    // Find the cart
    const cartResult = await pool.query(
      'SELECT id FROM shopping_carts WHERE user_email = $1',
      [userEmail]
    );

    if (cartResult.rows.length > 0) {
      const cartId = cartResult.rows[0].id;
      
      // Delete all cart items
      await pool.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
      
      // Delete the cart
      await pool.query('DELETE FROM shopping_carts WHERE id = $1', [cartId]);
    }

    res.json({
      success: true,
      message: 'Cart cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cart',
      details: error.message
    });
  }
});

const PORT = process.env.PORT || 3001;

// ==================== ADMIN ORDER ENDPOINTS ====================

// Create a new order
app.post('/api/orders', async (req, res) => {
  try {
    const {
      userEmail,
      customer_name,
      delivery_address,
      payment_method,
      total_amount,
      points_used = 0,
      discount_amount = 0,
      cart_items,
      status = 'Pending'
    } = req.body;

    // Validate required fields
    if (!userEmail || !customer_name || !delivery_address || !payment_method || !cart_items || cart_items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Get user_id from email
    const userResult = await pool.query(
      'SELECT user_id, points FROM users WHERE email = $1',
      [userEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Check if user has enough points for discount
    if (points_used > 0 && user.points < points_used) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient points for discount'
      });
    }

    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create the order - convert user_id to string to handle both integers and UUIDs
      const orderResult = await client.query(`
        INSERT INTO orders (
          user_id, customer_name, delivery_address, payment_method, 
          total_amount, points_used, discount_amount, status, created_at, updated_at
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) 
        RETURNING id
      `, [
        String(user.user_id), customer_name, delivery_address, payment_method,
        total_amount, points_used, discount_amount, status
      ]);

      const orderId = orderResult.rows[0].id;

      // Insert order items
      for (const item of cart_items) {
        const totalPrice = parseFloat(item.ingredient_price) * parseFloat(item.quantity);
        
        await client.query(`
          INSERT INTO order_items (
            order_id, ingredient_id, ingredient_name, quantity, 
            unit_price, total_price, package_size, package_unit
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          orderId, item.ingredient_id, item.ingredient_name, item.quantity,
          item.ingredient_price, totalPrice, item.package_size, item.package_unit
        ]);
      }

      // Deduct points if used
      if (points_used > 0) {
        await client.query(
          'UPDATE users SET points = points - $1 WHERE user_id = $2',
          [points_used, user.user_id]
        );
      }

      // Clear user's shopping cart (shopping_carts might use integer user_id)
      const cartResult = await client.query(
        'SELECT id FROM shopping_carts WHERE user_id = $1',
        [user.user_id]
      );

      if (cartResult.rows.length === 0) {
        // Try with string user_id if integer didn't work
        const cartResultStr = await client.query(
          'SELECT id FROM shopping_carts WHERE user_id = $1',
          [String(user.user_id)]
        );
        if (cartResultStr.rows.length > 0) {
          const cartId = cartResultStr.rows[0].id;
          await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
          await client.query('DELETE FROM shopping_carts WHERE id = $1', [cartId]);
        }
      } else {
        const cartId = cartResult.rows[0].id;
        await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
        await client.query('DELETE FROM shopping_carts WHERE id = $1', [cartId]);
      }

      await client.query('COMMIT');

      // Send order confirmation email (don't wait for it to complete)
      const orderDetails = {
        orderId: orderId,
        customerName: customer_name,
        totalAmount: total_amount,
        pointsUsed: points_used,
        discountAmount: discount_amount,
        deliveryAddress: delivery_address,
        paymentMethod: payment_method,
        items: cart_items.map(item => ({
          ingredient_name: item.ingredient_name,
          quantity: item.quantity,
          package_size: item.package_size,
          package_unit: item.package_unit,
          total_price: parseFloat(item.ingredient_price) * parseFloat(item.quantity)
        }))
      };

      sendOrderConfirmationEmail(userEmail, orderDetails).then(emailResult => {
        if (emailResult.success) {
          // console.log(`Order confirmation email sent to ${userEmail} for order #${orderId}`);
        } else {
          console.error(`Failed to send order confirmation email to ${userEmail}:`, emailResult.error);
        }
      }).catch(error => {
        console.error('Error in order confirmation email process:', error);
      });

      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        order_id: orderId
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      details: error.message
    });
  }
});

// Get user's orders
app.get('/api/orders/user/:userEmail', async (req, res) => {
  try {
    const { userEmail } = req.params;

    // Get user_id from email
    const userResult = await pool.query(
      'SELECT user_id FROM users WHERE email = $1',
      [userEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const userId = String(userResult.rows[0].user_id);

    // Get orders with items
    const ordersQuery = `
      SELECT 
        o.id, o.customer_name, o.delivery_address, o.payment_method,
        o.total_amount, o.points_used, o.discount_amount, o.status,
        o.created_at, o.updated_at,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'ingredient_id', oi.ingredient_id,
              'ingredient_name', oi.ingredient_name,
              'quantity', oi.quantity,
              'unit_price', oi.unit_price,
              'total_price', oi.total_price,
              'package_size', oi.package_size,
              'package_unit', oi.package_unit
            ) ORDER BY oi.id
          ) FILTER (WHERE oi.id IS NOT NULL), 
          '[]'::json
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.user_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `;

    const result = await pool.query(ordersQuery, [userId]);

    res.json({
      success: true,
      orders: result.rows
    });

  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

// Get user's orders by userId (for mobile app)
app.get('/api/orders/userid/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    // console.log('Fetching orders for userId:', userId);

    // Get orders for the user (fixed column names)
    const ordersQuery = `
      SELECT 
        o.id as order_id,
        o.user_id,
        o.customer_name,
        o.delivery_address,
        o.payment_method,
        o.total_amount,
        o.points_used,
        o.discount_amount,
        o.status,
        o.created_at,
        o.updated_at,
        '' as user_email,
        '' as username,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
      FROM orders o
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC
    `;

    const result = await pool.query(ordersQuery, [userId]);
    // console.log('Query result:', result.rows.length, 'orders found');

    res.json({
      success: true,
      orders: result.rows
    });

  } catch (error) {
    console.error('Error fetching user orders by userId:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

// Get order items by order ID
app.get('/api/orders/:orderId/items', async (req, res) => {
  try {
    const { orderId } = req.params;

    const itemsQuery = `
      SELECT 
        oi.ingredient_id,
        oi.ingredient_name,
        oi.quantity,
        CONCAT(oi.package_size, ' ', oi.package_unit) as package_type,
        oi.unit_price as price_per_unit,
        oi.total_price
      FROM order_items oi
      WHERE oi.order_id = $1
      ORDER BY oi.ingredient_id
    `;

    const result = await pool.query(itemsQuery, [orderId]);

    res.json({
      success: true,
      items: result.rows
    });

  } catch (error) {
    console.error('Error fetching order items:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order items'
    });
  }
});

// Get all orders (admin) with pagination and search
app.get('/api/admin/orders', async (req, res) => {
  try {
    const { 
      status, 
      search, 
      page = 1, 
      limit = 20 
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Base query for counting total results
    let countQuery = `
      SELECT COUNT(*) as total
      FROM orders o
      JOIN users u ON o.user_id::text = u.user_id::text
    `;

    // Base query for fetching results
    let dataQuery = `
      SELECT 
        o.id as order_id, o.user_id, o.customer_name, o.delivery_address, o.payment_method,
        o.total_amount, o.points_used, o.discount_amount, o.status,
        o.created_at, o.updated_at, u.email as user_email, u.username,
        COUNT(oi.id) as item_count
      FROM orders o
      JOIN users u ON o.user_id::text = u.user_id::text
      LEFT JOIN order_items oi ON o.id = oi.order_id
    `;

    const queryParams = [];
    let whereConditions = [];
    
    if (status && status !== 'all') {
      whereConditions.push(`o.status = $${queryParams.length + 1}`);
      queryParams.push(status);
    }
    
    if (search) {
      whereConditions.push(`(
        o.customer_name ILIKE $${queryParams.length + 1} OR 
        u.email ILIKE $${queryParams.length + 1} OR 
        o.id::text LIKE $${queryParams.length + 1}
      )`);
      queryParams.push(`%${search}%`);
    }

    if (whereConditions.length > 0) {
      const whereClause = ` WHERE ${whereConditions.join(' AND ')}`;
      countQuery += whereClause;
      dataQuery += whereClause;
    }

    // Get total count
    const countResult = await pool.query(countQuery, queryParams);
    const totalOrders = parseInt(countResult.rows[0].total);

    // Get paginated data
    dataQuery += ` GROUP BY o.id, u.email, u.username ORDER BY o.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(parseInt(limit), offset);

    const dataResult = await pool.query(dataQuery, queryParams);

    const totalPages = Math.ceil(totalOrders / parseInt(limit));

    res.json({
      success: true,
      orders: dataResult.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalOrders,
        hasNextPage: parseInt(page) < totalPages,
        hasPreviousPage: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
});

// Get order statistics (admin)
app.get('/api/admin/orders/stats', async (req, res) => {
  try {
    // Overall statistics (excluding cancelled orders from revenue)
    const overallStats = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(CASE WHEN LOWER(status) != 'cancelled' THEN total_amount ELSE 0 END), 0) as total_revenue,
        COALESCE(AVG(CASE WHEN LOWER(status) != 'cancelled' THEN total_amount END), 0) as average_order_value
      FROM orders
    `);

    // Status breakdown (revenue only for non-cancelled orders)
    const statusStats = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count,
        CASE 
          WHEN LOWER(status) = 'cancelled' THEN 0
          ELSE COALESCE(SUM(total_amount), 0)
        END as revenue
      FROM orders
      GROUP BY status
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      stats: {
        overall: overallStats.rows[0],
        statusBreakdown: statusStats.rows
      }
    });

  } catch (error) {
    console.error('Error fetching order stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order statistics'
    });
  }
});

// Update order status
app.put('/api/orders/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['Pending', 'Preparing', 'Shipped', 'Arrived', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    const result = await pool.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, orderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status'
    });
  }
});

// Get single order details
app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const orderQuery = `
      SELECT 
        o.id, o.customer_name, o.delivery_address, o.payment_method,
        o.total_amount, o.points_used, o.discount_amount, o.status,
        o.created_at, o.updated_at, u.email as user_email,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'ingredient_id', oi.ingredient_id,
              'ingredient_name', oi.ingredient_name,
              'quantity', oi.quantity,
              'unit_price', oi.unit_price,
              'total_price', oi.total_price,
              'package_size', oi.package_size,
              'package_unit', oi.package_unit
            ) ORDER BY oi.id
          ) FILTER (WHERE oi.id IS NOT NULL), 
          '[]'::json
        ) as items
      FROM orders o
      JOIN users u ON o.user_id = u.user_id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id = $1
      GROUP BY o.id, u.email
    `;

    const result = await pool.query(orderQuery, [orderId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    res.json({
      success: true,
      order: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order details'
    });
  }
});

// Cancel order endpoint
app.put('/api/orders/:orderId/cancel', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { userId } = req.body;

    // Get the current order details
    const orderCheck = await pool.query(
      'SELECT status, created_at, user_id FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orderCheck.rows[0];

    // Verify the user owns this order
    if (order.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You can only cancel your own orders'
      });
    }

    // Check if order is already cancelled
    if (order.status.toLowerCase() === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Order is already cancelled'
      });
    }

    // Only allow cancellation of pending orders
    const cancellableStatuses = ['pending'];
    if (!cancellableStatuses.includes(order.status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel order with status: ${order.status}. Only pending orders can be cancelled.`
      });
    }

    // Only allow cancellation within 30 minutes
    const orderTime = new Date(order.created_at);
    const currentTime = new Date();
    const timeDiffMinutes = (currentTime - orderTime) / (1000 * 60);
    
    if (timeDiffMinutes > 30) {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel order after 30 minutes of placement'
      });
    }

    // Update order status to cancelled
    const result = await pool.query(
      'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      ['Cancelled', orderId]
    );

    // console.log(`Order ${orderId} cancelled by user ${userId}`);

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: result.rows[0]
    });

  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order'
    });
  }
});

// Get single order details (admin) - includes more user info
app.get('/api/admin/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const orderQuery = `
      SELECT 
        o.id as order_id, o.customer_name, o.delivery_address, o.payment_method,
        o.total_amount, o.points_used, o.discount_amount, o.status,
        o.created_at, o.updated_at, 
        JSON_BUILD_OBJECT(
          'email', u.email,
          'username', u.username,
          'phone', u.phone,
          'points', u.points
        ) as user_info,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'ingredient_id', oi.ingredient_id,
              'ingredient_name', oi.ingredient_name,
              'ingredient_price', oi.unit_price,
              'quantity', oi.quantity,
              'item_total', oi.total_price,
              'package_size', oi.package_size,
              'package_unit', oi.package_unit
            ) ORDER BY oi.id
          ) FILTER (WHERE oi.id IS NOT NULL), 
          '[]'::json
        ) as items
      FROM orders o
      JOIN users u ON o.user_id::text = u.user_id::text
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id = $1
      GROUP BY o.id, u.email, u.username, u.phone, u.points
    `;

    const result = await pool.query(orderQuery, [orderId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    res.json({
      success: true,
      order: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching admin order details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order details'
    });
  }
});

// ==================== STATIC ROUTES ====================

// Serve ingredients manager HTML page
app.get('/ingredients-manager', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin', 'ingredients-manager.html'));
});

// Serve orders manager HTML page
app.get('/orders-manager', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin', 'orders-manager.html'));
});

// Auto-generate API configuration on server startup
console.log('Auto-generating API configuration...');
generateApiConfig();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

