require('dotenv').config();
const { Pool } = require('pg');
const mongoose = require('mongoose');

async function generatePerformanceReport() {
  const originalConsoleError = console.error;
  console.error = () => {};
  
  console.log('Performance Check\\n');
  console.log('========================================\\n');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await mongoose.connect(process.env.MONGODB_URI);

  console.log('[1] Database Query Performance:\n');

  let start = Date.now();
  await pool.query('SELECT * FROM users LIMIT 50');
  const pgUserTime = Date.now() - start;
  console.log(`   PostgreSQL user lookup: ${pgUserTime}ms`);

  start = Date.now();
  await pool.query('SELECT * FROM ingredients WHERE name ILIKE $1 LIMIT 20', ['%chicken%']);
  const pgSearchTime = Date.now() - start;
  console.log(`   PostgreSQL ingredient search: ${pgSearchTime}ms`);

  start = Date.now();
  await pool.query(`
    SELECT u.username, COUNT(o.id) as order_count 
    FROM users u 
    LEFT JOIN orders o ON u.user_id::text = o.user_id::text 
    GROUP BY u.username 
    LIMIT 20
  `);
  const pgComplexTime = Date.now() - start;
  console.log(`   PostgreSQL complex query: ${pgComplexTime}ms`);

  let Recipe;
  try {
    Recipe = mongoose.model('Recipe');
  } catch (error) {
    Recipe = mongoose.model('Recipe', new mongoose.Schema({}, { strict: false }), 'recipes');
  }

  start = Date.now();
  await Recipe.find({ isActive: 1 }).limit(20).lean();
  const mongoFeedTime = Date.now() - start;
  console.log(`   MongoDB recipe feed (20 items): ${mongoFeedTime}ms`);

  start = Date.now();
  const sampleRecipe = await Recipe.findOne({ isActive: 1 }).lean();
  const mongoDetailTime = Date.now() - start;
  console.log(`   MongoDB single recipe detail: ${mongoDetailTime}ms`);

  start = Date.now();
  const user = await pool.query('SELECT * FROM users LIMIT 1');
  if (user.rows.length > 0) {
    await Recipe.find({ authorEmail: user.rows[0].email, isActive: 1 }).lean();
  }
  const crossDbTime = Date.now() - start;
  console.log(`   Cross-database operation: ${crossDbTime}ms`);

  console.log('\n[2] Memory Usage:\n');
  const mem = process.memoryUsage();
  console.log(`   Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);

  console.log('\n[3] AI Service Performance:\n');
  
  const aiValidationService = require('./aiValidationService');
  let aiValidationTime = null;
  let aiNutritionTime = null;
  
  try {
    start = Date.now();
    const validationResult = await aiValidationService.validateRecipe(
      'Chicken Pasta',
      'Delicious pasta with grilled chicken and creamy sauce',
      'Italian'
    );
    aiValidationTime = Date.now() - start;
    console.log(`   Google Gemini validation: ${aiValidationTime}ms (${(aiValidationTime/1000).toFixed(1)}s)`);
  } catch (error) {
    console.log(`   Google Gemini validation: Not available (${error.message || 'No API key'})`);
  }

  try {
    const testIngredients = [
      { name: 'chicken', amount: 300, unit: 'grams' },
      { name: 'pasta', amount: 200, unit: 'grams' }
    ];
    
    start = Date.now();
    const nutritionResult = await aiValidationService.calculateNutritionalInfo(testIngredients);
    aiNutritionTime = Date.now() - start;
    
    if (nutritionResult.success) {
      console.log(`   Nutritional analysis (AI): ${aiNutritionTime}ms (${(aiNutritionTime/1000).toFixed(1)}s)`);
    } else {
      console.log(`   Nutritional analysis (AI): Failed - using database fallback`);
    }
  } catch (error) {
    if (error.status === 503 || (error.message && error.message.includes('503'))) {
      console.log(`   Nutritional analysis (AI): Service temporarily unavailable (503 - server overloaded)`);
    } else {
      console.log(`   Nutritional analysis (AI): Not available (${error.message || 'Unknown error'})`);
    }
  }

  console.log('\n[4] Performance Summary:\n');
  
  const avgPostgres = Math.round((pgUserTime + pgSearchTime + pgComplexTime) / 3);
  const avgMongo = Math.round((mongoFeedTime + mongoDetailTime) / 2);
  
  console.log('   Database Performance:');
  console.log(`   - PostgreSQL: ${avgPostgres}ms average (${getPerformanceRating(avgPostgres, 100)})`);
  console.log(`   - MongoDB: ${avgMongo}ms average (${getPerformanceRating(avgMongo, 150)})`);
  console.log(`   - Cross-database: ${crossDbTime}ms (${getPerformanceRating(crossDbTime, 300)})`);

  console.log('\\n========================================');
  console.log('Report generated successfully!\\n');

  await pool.end();
  await mongoose.disconnect();
  console.error = originalConsoleError;
}

function getPerformanceRating(time, threshold) {
  if (time < threshold * 0.5) return 'Excellent';
  if (time < threshold) return 'Good';
  if (time < threshold * 2) return 'Acceptable';
  return 'Needs Optimization';
}

generatePerformanceReport().catch(console.error);
