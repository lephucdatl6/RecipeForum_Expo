const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIValidationService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }

  /**
   * Validates recipe content using Gemini AI
   * @param {string} title - Recipe title
   * @param {string} description - Recipe description
   * @param {string} category - Recipe category
   * @returns {Promise<{isValid: boolean, reason?: string}>}
   */
  
  async validateRecipeContent(title, description, category) {
    try {
      // Check if API key is configured
      if (!process.env.GEMINI_API_KEY) {
        console.warn('GEMINI_API_KEY not configured, skipping AI validation');
        return { isValid: true };
      }

      const prompt = `You are a content moderator for a recipe sharing platform. Analyze the following recipe post and determine if it's legitimate content or spam.

Title: "${title}"
Description: "${description}"
Category: "${category}"

Consider these criteria:
1. Is the title coherent and food-related? (not random characters like "fdseawd", "asdasd", "uije", "qwerty")
2. Is the description meaningful and recipe-related? (not gibberish or extremely generic)
3. Does it appear to be a genuine attempt to share a recipe?
4. Is it in a reasonable language (any language is fine, but not random characters)?
5. Does the category match the recipe? The category should be appropriate for the dish described.

Examples of INVALID content:
- Title: "fdseawd" Description: "random text" Category: "Pasta"
- Title: "uije" Description: "some description" Category: "Dessert"
- Title: "asdasd" Description: "asdadasdasd" Category: "Bread"
- Title: "qwerty" Description: "keyboard mashing" Category: "Soup"
- Title: "" Description: "" Category: ""
- Title: "Steak and Potatoes" Description: "Grilled beef with roasted potatoes" Category: "Pasta" (wrong category)
- Title: "Chocolate Cake" Description: "Rich chocolate dessert" Category: "Soup" (wrong category)

Examples of VALID content:
- Title: "Chocolate Chip Cookies" Description: "These cookies are soft and chewy..." Category: "Dessert"
- Title: "Pasta Carbonara" Description: "A classic Italian dish with eggs and cheese" Category: "Pasta"
- Title: "Cheese Bread" Description: "Soft bread with melted cheese" Category: "Bread"
- Title: "Beef Stew" Description: "Hearty stew with tender beef and vegetables" Category: "Soup"
- Title: "Cơm chiên" Description: "Công thức làm cơm chiên" Category: "Cơm" (any language is fine)

Common category matches:
- Bread recipes → "Bread" category
- Pasta dishes → "Pasta" category  
- Cakes, cookies, ice cream → "Dessert" category
- Soups, stews, broths → "Soup" category
- Main meat/protein dishes → "Main Course" category
- Salads → "Salad" category
- Appetizers, snacks → "Appetizer" category

Respond with ONLY one of these formats:
- If valid: "VALID"
- If invalid: "INVALID: [brief reason]"

Do not include any other text in your response.`;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text().trim();
      console.log('AI Validation Response:', text);

      if (text.startsWith('VALID')) {
        return { isValid: true };
      } else if (text.startsWith('INVALID')) {
        const reason = text.replace('INVALID:', '').trim() || 'Content appears to be spam or low quality';
        return { 
          isValid: false, 
          reason: reason 
        };
      } else {
        // If response format is unexpected, log and allow content
        console.warn('Unexpected AI response format:', text);
        return { isValid: true };
      }

    } catch (error) {
      // console.error('AI Validation Error:', error);
      // If AI validation fails, allow the content to avoid blocking legitimate posts
      return { isValid: true };
    }
  }

  /**
   * Quick validation for obviously invalid content before using AI
   * @param {string} title 
   * @param {string} description 
   * @param {string} category 
   * @returns {boolean}
   */
  quickValidation(title, description, category) {
    // Basic checks before using AI
    if (!title || !description || !category) return false;
    if (title.trim().length === 0 || description.trim().length === 0 || category.trim().length === 0) return false;
    
    // Only catch the most obvious spam patterns - let AI handle the rest
    const obviousSpamPattern = /^[a-zA-Z]*[0-9]+[a-zA-Z]*$|^(.)\1{4,}$|^[0-9]+$|^\s+$/;
    if (obviousSpamPattern.test(title.toLowerCase())) return false;
    
    return true;
  }

  /**
   * Fallback rule-based ingredient unit validation using pattern classification
   * @param {Array} ingredients - Array of ingredient objects
   * @returns {Array<string>} - Array of warning messages
   */
  fallbackValidateIngredientUnits(ingredients) {
    const warnings = [];
    
    const unitCategories = {
      weight: ['g', 'grams', 'kg', 'kilogram', 'oz', 'ounce', 'lb', 'lbs', 'pound', 'pounds'],
      volume: ['ml', 'milliliters', 'l', 'liter', 'liters', 'cup', 'cups', 'tbsp', 'tablespoon', 'tsp', 'teaspoon'],
      count: ['pcs', 'pieces', 'piece', 'cloves', 'clove', 'slices', 'slice', 'bottles', 'bottle', 'cans', 'can', 'bunch']
    };
    
    // Pattern-based classification
    const patterns = {
      // Liquid indicators
      liquid: /\b(oil|milk|water|juice|broth|stock|cream|wine|vinegar|sauce|syrup|honey)\b/i,
      
      // Spice/seasoning indicators  
      spice: /\b(salt|pepper|paprika|cumin|oregano|basil|thyme|rosemary|cinnamon|nutmeg|ginger|turmeric|curry|chili|cayenne)\b/i,
      
      // Meat indicators
      meat: /\b(chicken|beef|pork|fish|lamb|turkey|duck|salmon|tuna|shrimp|crab)\b/i,
      
      // Garlic specific
      garlic: /\bgarlic\b/i,
      
      // Flour/powder ingredients
      powder: /\b(flour|sugar|powder|starch|cocoa|butter)\b/i,
      
      // Countable items
      countable: /\b(egg|apple|banana|potato|onion|tomato|lemon|lime|orange|bread)\b/i
    };
    
    ingredients.forEach(ingredient => {
      const name = ingredient.name.toLowerCase();
      const unit = ingredient.unit.toLowerCase();
      const amount = parseFloat(ingredient.amount);
      
      // Rule 1: Garlic in liquid units
      if (patterns.garlic.test(name) && unitCategories.volume.includes(unit)) {
        warnings.push(`${ingredient.name} - Use 'cloves' or 'grams' instead of '${ingredient.unit}'`);
      }
      
      // Rule 2: Liquids in count units
      if (patterns.liquid.test(name) && unitCategories.count.includes(unit)) {
        warnings.push(`${ingredient.name} - Use 'ml', 'cups', or 'tbsp' instead of '${ingredient.unit}'`);
      }
      
      // Rule 3: Excessive spice amounts
      if (patterns.spice.test(name)) {
        if (unitCategories.weight.includes(unit) && amount > 50) {
          warnings.push(`${ingredient.name} - ${amount}${ingredient.unit} seems excessive for seasoning`);
        }
        if (unit === 'cups' && amount > 0.5) {
          warnings.push(`${ingredient.name} - ${amount} cups seems too much for seasoning`);
        }
        if (['ml', 'milliliters', 'l', 'liter', 'liters'].includes(unit)) {
          warnings.push(`${ingredient.name} - Use 'tsp', 'tbsp', or 'grams' instead of '${ingredient.unit}'`);
        }
      }
      
      // Rule 4: Meat in tiny units
      if (patterns.meat.test(name) && ['tsp', 'teaspoon', 'tbsp', 'tablespoon'].includes(unit)) {
        warnings.push(`${ingredient.name} - Use 'grams', 'lbs', or 'pcs' instead of '${ingredient.unit}'`);
      }
      
      // Rule 5: Powder/flour in count units
      if (patterns.powder.test(name) && unitCategories.count.includes(unit)) {
        warnings.push(`${ingredient.name} - Use 'grams', 'cups', or 'tbsp' instead of '${ingredient.unit}'`);
      }
      
      // Rule 6: Very large liquid amounts
      if (patterns.liquid.test(name) && unitCategories.weight.includes(unit) && amount > 1000) {
        warnings.push(`${ingredient.name} - ${amount}${ingredient.unit} seems too much, maybe use 'ml' or 'cups'?`);
      }
      
      // Rule 7: Liquids in weight units
      if (patterns.liquid.test(name) && unitCategories.weight.includes(unit)) {
        warnings.push(`${ingredient.name} - Liquids are usually measured in 'ml', 'cups', or 'tbsp' instead of '${ingredient.unit}'`);
      }
    });
    
    return warnings;
  }

  /**
   * Validates ingredient units using AI-first approach with pattern-based fallback
   * @param {Array} ingredients - Array of ingredient objects with name, amount, and unit
   * @returns {Promise<{warnings: Array<string>}>}
   */
  async validateIngredientUnits(ingredients) {
    try {
      if (!ingredients || ingredients.length === 0) {
        return { warnings: [] };
      }

      let warnings = [];

      // Use AI as primary validation method if available
      if (process.env.GEMINI_API_KEY) {
        // console.log('Using AI validation for ingredients...');
        
        const ingredientList = ingredients.map(ing => 
          `- ${ing.name}: ${ing.amount} ${ing.unit}`
        ).join('\n');

        const prompt = `You are an expert chef and recipe validator. Check these recipe ingredients for unusual or incorrect unit measurements:

${ingredientList}

Common issues to look for:
- Solid ingredients (garlic, onions, potatoes, carrots, etc.) measured in liquid units (ml, liters, cups of liquid)
- Liquid ingredients (milk, water, oil, vinegar, etc.) measured in solid units (pieces, slices)
- Very small ingredients (garlic, herbs, spices) measured in very large units (liters, kg)
- Very large amounts of seasonings (salt, pepper, spices) that would be overwhelming
- Butter/margarine in pieces instead of weight/volume
- Flour, sugar in pieces instead of weight/volume
- Meat, fish measured in teaspoons/tablespoons
- Rice, pasta measured in liquid units when dry
- Any measurement that seems unrealistic for cooking

Available proper units: pcs, cups, tbsp, tsp, grams, kg, lbs, oz, ml, liters, cloves, slices, bunch

For each problematic ingredient, respond with warnings in this exact format:
[Ingredient Name] - Use '[suggested units]' instead of '[current unit]'

Examples:
- If you see "Garlic: 2 liters" → "Garlic - Use 'cloves' or 'grams' instead of 'liters'"
- If you see "Rice: 3 cloves" → "Rice - Use 'grams' or 'cups' instead of 'cloves'"
- If you see "Chicken: 2 tsp" → "Chicken - Use 'grams', 'lbs', or 'pcs' instead of 'tsp'"

If all measurements seem reasonable for cooking, respond with exactly: OK

Do not explain your reasoning, just provide the warnings or "OK".`;

        try {
          const result = await this.model.generateContent(prompt);
          const response = result.response;
          const text = response.text().trim();
          
          // console.log('AI Ingredient Unit Validation Response:', text);

          if (text !== 'OK' && !text.includes('OK')) {
            const aiWarnings = text.split('\n')
              .filter(line => line.trim().length > 0 && line.includes(' - '))
              .map(line => line.trim());
            warnings.push(...aiWarnings);
          }
        } catch (aiError) {
          // console.error('AI validation failed, using fallback validation:', aiError);
          // Use fallback validation when AI fails
          warnings = this.fallbackValidateIngredientUnits(ingredients);
        }
      } else {
        // console.log('No AI key configured, using fallback ingredient unit validation');
        // Use fallback validation when no AI available
        warnings = this.fallbackValidateIngredientUnits(ingredients);
      }

      return { warnings };

    } catch (error) {
      console.error('Ingredient Unit Validation Error:', error);
      return { warnings: [] };
    }
  }

  /**
   * Full validation pipeline
   * @param {string} title 
   * @param {string} description 
   * @param {string} category 
   * @returns {Promise<{isValid: boolean, reason?: string}>}
   */
  async validateRecipe(title, description, category) {
    // First, do quick validation
    if (!this.quickValidation(title, description, category)) {
      return { 
        isValid: false, 
        reason: 'Title, description, or category appears to contain random characters or invalid content' 
      };
    }

    // Then use AI for deeper analysis
    return await this.validateRecipeContent(title, description, category);
  }

  /**
   * Combined validation for both recipe content and ingredient units
   * @param {string} title - Recipe title
   * @param {string} description - Recipe description
   * @param {string} category - Recipe category
   * @param {Array} ingredients - Array of ingredient objects
   * @returns {Promise<{contentValid: boolean, contentReason?: string, unitWarnings: Array<string>}>}
   */
  async validateRecipeComplete(title, description, category, ingredients) {
    try {
      // Run both validations in parallel for better performance
      const [contentValidation, unitValidation] = await Promise.all([
        this.validateRecipe(title, description, category),
        this.validateIngredientUnits(ingredients || [])
      ]);

      return {
        contentValid: contentValidation.isValid,
        contentReason: contentValidation.reason,
        unitWarnings: unitValidation.warnings || []
      };

    } catch (error) {
      console.error('Combined Recipe Validation Error:', error);
      
      // If validation fails, allow the recipe to avoid blocking users
      return {
        contentValid: true,
        unitWarnings: []
      };
    }
  }

  /**
   * Test Gemini AI connection on startup
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      if (!process.env.GEMINI_API_KEY) {
        console.log('❌ Gemini AI: No API key configured (content validation disabled)');
        return false;
      }

      console.log('Testing Gemini AI connection...');
      
      const result = await this.model.generateContent("Reply with a short (under 5 words) confirmation that you're online. Only one line."
);
      const response = result.response.text().trim();
      
      if (response && response.length > 0) {
        console.log(`✅ Gemini AI connected successfully\nTest response: ${response}`);
        return true;
      } else {
        console.log('❌ Gemini AI: Connection test failed - no response');
        return false;
      }
      
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('API key')) {
        console.log('❌ Gemini AI: Invalid API key. Please check your GEMINI_API_KEY in .env file');
        console.log('   Get a free API key at: https://makersuite.google.com/app/apikey');
      } else if (error.message.includes('403') || error.message.includes('PERMISSION_DENIED')) {
        console.log('❌ Gemini AI: Permission denied. Make sure billing is enabled in Google Cloud Console');
      } else if (error.message.includes('quota') || error.message.includes('QUOTA_EXCEEDED')) {
        console.log('❌ Gemini AI: API quota exceeded. Please check your Google Cloud console');
      } else if (error.message.includes('404') || error.message.includes('not found')) {
        console.log('❌ Gemini AI: Model not available. Please check if the Generative Language API is enabled');
      } else {
        console.log(`❌ Gemini AI: Connection failed - ${error.message}`);
      }
      
      console.log('Note: App will work normally, but content validation is disabled');
      return false;
    }
  }
}

module.exports = new AIValidationService();