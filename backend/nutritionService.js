const aiValidationService = require('./aiValidationService');

class NutritionService {
  constructor() {
    // Basic nutritional database - calories per 100g
    this.nutritionDB = {
      // Grains & Starches
      'rice': { calories: 130, carbs: 28, protein: 2.7, fat: 0.3, fiber: 0.4, sodium: 5 },
      'white rice': { calories: 130, carbs: 28, protein: 2.7, fat: 0.3, fiber: 0.4, sodium: 5 },
      'brown rice': { calories: 111, carbs: 23, protein: 2.6, fat: 0.9, fiber: 1.8, sodium: 5 },
      'bread': { calories: 265, carbs: 49, protein: 9, fat: 3.2, fiber: 2.7, sodium: 491 },
      'white bread': { calories: 265, carbs: 49, protein: 9, fat: 3.2, fiber: 2.7, sodium: 491 },
      'pasta': { calories: 220, carbs: 44, protein: 8, fat: 1.1, fiber: 2.5, sodium: 6 },
      'flour': { calories: 364, carbs: 76, protein: 10, fat: 1, fiber: 2.7, sodium: 2 },
      
      // Vegetables
      'garlic': { calories: 149, carbs: 33, protein: 6.4, fat: 0.5, fiber: 2.1, sodium: 17 },
      'onion': { calories: 40, carbs: 9, protein: 1.1, fat: 0.1, fiber: 1.7, sodium: 4 },
      'tomato': { calories: 18, carbs: 3.9, protein: 0.9, fat: 0.2, fiber: 1.2, sodium: 5 },
      'carrot': { calories: 41, carbs: 10, protein: 0.9, fat: 0.2, fiber: 2.8, sodium: 69 },
      'potato': { calories: 77, carbs: 17, protein: 2, fat: 0.1, fiber: 2.2, sodium: 6 },
      'lettuce': { calories: 15, carbs: 2.9, protein: 1.4, fat: 0.2, fiber: 1.3, sodium: 28 },
      'cucumber': { calories: 16, carbs: 4, protein: 0.7, fat: 0.1, fiber: 0.5, sodium: 2 },
      
      // Proteins
      'chicken': { calories: 239, carbs: 0, protein: 27, fat: 14, fiber: 0, sodium: 82 },
      'chicken breast': { calories: 165, carbs: 0, protein: 31, fat: 3.6, fiber: 0, sodium: 74 },
      'beef': { calories: 250, carbs: 0, protein: 26, fat: 15, fiber: 0, sodium: 72 },
      'pork': { calories: 242, carbs: 0, protein: 27, fat: 14, fiber: 0, sodium: 62 },
      'fish': { calories: 206, carbs: 0, protein: 22, fat: 12, fiber: 0, sodium: 59 },
      'salmon': { calories: 208, carbs: 0, protein: 20, fat: 13, fiber: 0, sodium: 59 },
      'egg': { calories: 155, carbs: 1.1, protein: 13, fat: 11, fiber: 0, sodium: 124 },
      'tofu': { calories: 76, carbs: 1.9, protein: 8, fat: 4.8, fiber: 0.3, sodium: 7 },
      
      // Dairy
      'milk': { calories: 42, carbs: 5, protein: 3.4, fat: 1, fiber: 0, sodium: 44 },
      'cheese': { calories: 113, carbs: 1, protein: 7, fat: 9, fiber: 0, sodium: 178 },
      'butter': { calories: 717, carbs: 0.1, protein: 0.9, fat: 81, fiber: 0, sodium: 11 },
      'yogurt': { calories: 59, carbs: 3.6, protein: 10, fat: 0.4, fiber: 0, sodium: 36 },
      
      // Oils & Fats
      'oil': { calories: 884, carbs: 0, protein: 0, fat: 100, fiber: 0, sodium: 0 },
      'olive oil': { calories: 884, carbs: 0, protein: 0, fat: 100, fiber: 0, sodium: 2 },
      'coconut oil': { calories: 862, carbs: 0, protein: 0, fat: 100, fiber: 0, sodium: 0 },
      
      // Spices & Seasonings (per 100g, but typically used in small amounts)
      'salt': { calories: 0, carbs: 0, protein: 0, fat: 0, fiber: 0, sodium: 38758 },
      'pepper': { calories: 251, carbs: 64, protein: 10, fat: 3.3, fiber: 25, sodium: 20 },
      'paprika': { calories: 282, carbs: 54, protein: 14, fat: 13, fiber: 35, sodium: 68 },
      
      // Fruits
      'apple': { calories: 52, carbs: 14, protein: 0.3, fat: 0.2, fiber: 2.4, sodium: 1 },
      'banana': { calories: 89, carbs: 23, protein: 1.1, fat: 0.3, fiber: 2.6, sodium: 1 },
      'orange': { calories: 47, carbs: 12, protein: 0.9, fat: 0.1, fiber: 2.4, sodium: 0 },
      
      // Legumes
      'beans': { calories: 347, carbs: 63, protein: 22, fat: 1.2, fiber: 15, sodium: 16 },
      'lentils': { calories: 353, carbs: 60, protein: 25, fat: 1.1, fiber: 11, sodium: 6 },
      'chickpeas': { calories: 378, carbs: 63, protein: 20, fat: 6, fiber: 12, sodium: 7 }
    };

    // Common unit conversions to grams
    this.unitConversions = {
      'g': 1,
      'gram': 1,
      'grams': 1,
      'kg': 1000,
      'kilogram': 1000,
      'kilograms': 1000,
      'lb': 453.592,
      'lbs': 453.592,
      'pound': 453.592,
      'pounds': 453.592,
      'oz': 28.3495,
      'ounce': 28.3495,
      'ounces': 28.3495,
      'cup': 240, // ml, varies by ingredient
      'cups': 240,
      'tbsp': 15,
      'tablespoon': 15,
      'tablespoons': 15,
      'tsp': 5,
      'teaspoon': 5,
      'teaspoons': 5,
      'ml': 1, // for liquids, assuming density ~1
      'liter': 1000,
      'liters': 1000,
      'l': 1000,
      'slice': 30, // average bread slice
      'slices': 30,
      'piece': 50, // average piece
      'pieces': 50,
      'pcs': 50,
      'clove': 3, // garlic clove
      'cloves': 3
    };
  }

  /**
   * Convert ingredient amount to grams
   * @param {number} amount 
   * @param {string} unit 
   * @param {string} ingredientName 
   * @returns {number} amount in grams
   */
  convertToGrams(amount, unit, ingredientName) {
    const normalizedUnit = unit.toLowerCase().trim();
    
    // Special cases for specific ingredients
    if (ingredientName.toLowerCase().includes('garlic') && (normalizedUnit.includes('clove') || normalizedUnit.includes('pcs'))) {
      return amount * 3; // 3g per clove
    }
    
    if (normalizedUnit.includes('slice') && ingredientName.toLowerCase().includes('bread')) {
      return amount * 30; // 30g per slice
    }

    // Standard unit conversion
    return amount * (this.unitConversions[normalizedUnit] || 1);
  }

  /**
   * Find nutritional data for an ingredient
   * @param {string} ingredientName 
   * @returns {object|null} nutrition data per 100g or null if not found
   */
  findNutritionData(ingredientName) {
    const normalized = ingredientName.toLowerCase().trim();
    
    // Direct match
    if (this.nutritionDB[normalized]) {
      return this.nutritionDB[normalized];
    }

    // Partial match - find the best match
    const keys = Object.keys(this.nutritionDB);
    for (const key of keys) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return this.nutritionDB[key];
      }
    }

    return null;
  }

  /**
   * Calculate nutrition using AI first with database fallback
   * @param {Array} ingredients 
   * @param {object} existingNutritionInfo - existing nutrition data to check for notes
   * @returns {Promise<{success: boolean, nutritionalInfo?: object, error?: string}>}
   */
  async calculateNutritionalInfo(ingredients, existingNutritionInfo = null) {
    try {
      // If the AI service is available, attempt to use it first.
      if (process.env.GEMINI_API_KEY) {
        try {
          console.log('Attempting AI calculation...');
          const aiResult = await aiValidationService.calculateNutritionalInfo(ingredients);
          
          // If AI calculation is successful, return its result.
          if (aiResult.success && aiResult.nutritionalInfo) {
            console.log('AI calculation successful.');
            // Ensure no old warning notes are carried over from a previous DB calculation.
            if (aiResult.nutritionalInfo.notes) {
              delete aiResult.nutritionalInfo.notes;
            }
            return aiResult;
          }
          // If AI fails, log it but proceed to database fallback.
          console.log('AI calculation failed or returned no data. Proceeding to database fallback.');
        } catch (aiError) {
          // If AI throws an error, log it and proceed to database fallback.
          console.log('AI calculation threw an error:', aiError.message, '. Proceeding to database fallback.');
        }
      } else {
        console.log('No AI API key found, skipping AI calculation.');
      }

      // Fallback to database calculation if AI is unavailable or failed.
      console.log('Falling back to database calculation...');
      return await this.calculateWithDatabase(ingredients);

    } catch (error) {
      console.error('Error in nutrition calculation:', error);
      return {
        success: false,
        error: 'Failed to calculate nutritional information'
      };
    }
  }

  /**
   * Calculate nutrition using database only
   * @param {Array} ingredients 
   * @returns {Promise<{success: boolean, nutritionalInfo?: object, error?: string}>}
   */
  async calculateWithDatabase(ingredients) {
    try {
      let totalCalories = 0;
      let totalCarbs = 0;
      let totalProtein = 0;
      let totalFat = 0;
      let totalFiber = 0;
      let totalSodium = 0;
      let unknownIngredients = [];
      let totalWeight = 0;

      console.log('Starting database nutrition calculation for ingredients:', ingredients);

      // Process each ingredient
      for (const ingredient of ingredients) {
        const weightInGrams = this.convertToGrams(ingredient.amount, ingredient.unit, ingredient.name);
        totalWeight += weightInGrams;
        
        const nutritionData = this.findNutritionData(ingredient.name);
        
        if (nutritionData) {
          // Calculate nutrition based on actual weight (nutrition data is per 100g)
          const factor = weightInGrams / 100;
          totalCalories += nutritionData.calories * factor;
          totalCarbs += nutritionData.carbs * factor;
          totalProtein += nutritionData.protein * factor;
          totalFat += nutritionData.fat * factor;
          totalFiber += (nutritionData.fiber || 0) * factor;
          totalSodium += (nutritionData.sodium || 0) * factor;
          
          console.log(`Found data for ${ingredient.name}: ${weightInGrams}g = ${nutritionData.calories * factor} calories`);
        } else {
          unknownIngredients.push(ingredient);
          console.log(`No data found for: ${ingredient.name}`);
        }
      }

      // Estimate servings based on total weight
      let servings = 1;
      if (totalWeight > 800) servings = 4;
      else if (totalWeight > 500) servings = 3;
      else if (totalWeight > 300) servings = 2;

      const nutritionalInfo = {
        totalCalories: Math.round(totalCalories),
        servings: servings,
        caloriesPerServing: Math.round(totalCalories / servings),
        macronutrients: {
          carbohydrates: Math.round(totalCarbs),
          protein: Math.round(totalProtein),
          fat: Math.round(totalFat)
        },
        micronutrients: {
          fiber: Math.round(totalFiber),
          sugar: Math.round(totalCarbs * 0.1), // rough estimate
          sodium: Math.round(totalSodium),
          calcium: Math.round(totalWeight * 0.5), // rough estimate
          iron: Math.round(totalWeight * 0.05), // rough estimate
          vitaminC: Math.round(totalWeight * 0.1) // rough estimate
        }
      };

      // Add warnings about unknown ingredients
      const knownIngredients = ingredients.length - unknownIngredients.length;
      const unknownPercentage = Math.round((unknownIngredients.length / ingredients.length) * 100);
      
      let warningMessage = null;
      if (unknownIngredients.length > 0) {
        if (unknownPercentage >= 70) {
          warningMessage = `Very limited data: Only ${knownIngredients}/${ingredients.length} ingredients recognized. Values are highly approximate.`;
        } else if (unknownPercentage >= 50) {
          warningMessage = `Limited data: Only ${knownIngredients}/${ingredients.length} ingredients recognized. Values are approximate.`;
        } else if (unknownPercentage >= 30) {
          warningMessage = `Partial data: ${knownIngredients}/${ingredients.length} ingredients recognized. Some values may be underestimated.`;
        } else {
          warningMessage = `Mostly complete: ${knownIngredients}/${ingredients.length} ingredients recognized.`;
        }
        
        // Add the warning message to the nutritionalInfo object
        nutritionalInfo.notes = warningMessage;
      }

      console.log('Database calculation completed:', nutritionalInfo);
      if (warningMessage) {
        console.log('Warning:', warningMessage);
      }

      return {
        success: true,
        nutritionalInfo: nutritionalInfo,
        databaseFallback: true,
        unknownIngredients: unknownIngredients.map(ing => ing.name)
      };

    } catch (error) {
      console.error('Error in database nutrition calculation:', error);
      return {
        success: false,
        error: 'Database calculation failed'
      };
    }
  }
}

module.exports = new NutritionService();