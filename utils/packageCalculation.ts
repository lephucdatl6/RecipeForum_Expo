import { API_BASE_URL } from '../config/apiConfig';

// Convert units to grams/ml for comparison
export const convertToBaseUnit = (amount: number, unit: string): number | null => {
  const unitLower = unit.toLowerCase();
  
  // Weight conversions to grams
  if (unitLower === 'kg') return amount * 1000; // kg → g
  if (unitLower === 'grams') return amount; // grams → g
  if (unitLower === 'oz') return amount * 28.35; // oz → g (approx)
  if (unitLower === 'lbs') return amount * 453.6; // lbs → g (approx)
  
  // Volume conversions to ml
  if (unitLower === 'liters') return amount * 1000; // liters → ml
  if (unitLower === 'ml') return amount; // ml → ml
  if (unitLower === 'cups') return amount * 240; // cups → ml (approx)
  if (unitLower === 'tbsp') return amount * 15; // tbsp → ml
  if (unitLower === 'tsp') return amount * 5; // tsp → ml
  
  // Countable items
  if (unitLower === 'pcs' || unitLower === 'cloves' || 
      unitLower === 'slices' || unitLower === 'bunch') return amount;
  
  return null;
};

// Check if two units are compatible for conversion/comparison
export const areUnitsCompatible = (unit1: string, unit2: string): boolean => {
  const getUnitType = (unit: string): 'weight' | 'volume' | 'count' | 'unknown' => {
    const unitLower = unit.toLowerCase();
    
    // Weight units
    if (unitLower === 'kg' || unitLower === 'grams' ||
        unitLower === 'oz' || unitLower === 'lbs') {
      return 'weight';
    }
    
    // Volume units
    if (unitLower === 'liters' || unitLower === 'ml' || 
        unitLower === 'cups' || unitLower === 'tbsp' || 
        unitLower === 'tsp') {
      return 'volume';
    }
    
    // Countable units
    if (unitLower === 'pcs' || unitLower === 'cloves' ||
        unitLower === 'slices' || unitLower === 'bunch') {
      return 'count';
    }
    
    return 'unknown';
  };
  
  const type1 = getUnitType(unit1);
  const type2 = getUnitType(unit2);
  
  // Units are compatible if they are the same type (weight-weight, volume-volume, count-count)
  return type1 === type2 && type1 !== 'unknown';
};

// Fallback logic when package info is not available or units are incompatible
export const getShoppingQuantityFallback = (
  amount: number, 
  unit: string, 
  ingredientName: string | null = null, 
  packageUnit: string | null = null
): number => {
  const unitLower = unit.toLowerCase();
  const ingredientLower = ingredientName?.toLowerCase() || '';
  const packageUnitLower = packageUnit?.toLowerCase() || '';
  
  // Check if package is sold by pieces first
  if (packageUnitLower === 'pcs') {
    const defaultPackageSize = 6;
    return Math.max(1, Math.ceil(amount / defaultPackageSize));
  }
  
  // Countable units - use recipe amount (makes sense for pieces, etc.)
  if (unitLower === 'pcs' || unitLower === 'cloves' ||
      unitLower === 'slices') {
    return Math.ceil(amount); // Round up to ensure enough
  }
  
  // Weight/volume units - assume 1 package will cover recipe needs
  // This handles cases like "1 cups fish" or "500 grams flour"
  if (unitLower === 'grams' || unitLower === 'kg' ||
      unitLower === 'cups' || unitLower === 'tbsp' ||
      unitLower === 'tsp' || unitLower === 'ml' ||
      unitLower === 'liters' || unitLower === 'oz' ||
      unitLower === 'lbs') {
    
    // For very large amounts, might need multiple packages
    if (amount > 50) {
      return Math.ceil(amount / 20);
    }
    return 1;
  }
  
  // For bunch units - use recipe amount
  if (unitLower === 'bunch') {
    return Math.ceil(amount);
  }
  
  // Default: use recipe amount for completely unknown units
  return Math.max(1, Math.ceil(amount));
};

// Smart quantity conversion for shopping cart with realistic package sizes
export const getShoppingQuantity = async (amount: number, unit: string, ingredientId: number): Promise<number> => {
  try {
    // For countable units, handle them directly first
    const unitLower = unit.toLowerCase();
    if (unitLower === 'cloves' || unitLower === 'pcs' || 
        unitLower === 'slices' || unitLower === 'bunch') {
      // For countable units, try to get package info to be smart about it
      try {
        const response = await fetch(`${API_BASE_URL}/api/ingredients/${ingredientId}`);
        const data = await response.json();
        
        if (data.success) {
          const ingredient = data.ingredient;
          const packageSize = parseFloat(ingredient.package_size) || 1;
          const packageUnit = ingredient.package_unit || 'piece';
          
          // If package is also countable, calculate packages needed
          const packageUnitLower = packageUnit.toLowerCase();
          if (packageUnitLower === 'pcs' || packageUnitLower === 'bunch' || 
              packageUnitLower === 'cloves' || packageUnitLower === 'slices') {
            // Use a reasonable conversion factor
            let conversionFactor = 1;
            if (unitLower === 'cloves' && packageUnitLower === 'bunch') {
              conversionFactor = 8; // 1 bunch is 8 cloves
            }
            // For same units, conversionFactor = 1
            
            const packagesNeeded = Math.ceil(amount / (packageSize * conversionFactor));
            return Math.max(1, packagesNeeded);
          }
        }
      } catch (error) {
        console.log('Could not get package info for countable unit, using recipe amount');
      }
      
      // Fallback for countable units: use recipe amount
      return Math.max(1, Math.ceil(amount));
    }
    
    // Get ingredient package information for non-countable units
    const response = await fetch(`${API_BASE_URL}/api/ingredients/${ingredientId}`);
    const data = await response.json();
    
    if (!data.success) {
      console.warn('Failed to get ingredient package info, using fallback logic');
      return getShoppingQuantityFallback(amount, unit, null, null);
    }
    
    const ingredient = data.ingredient;
    const packageSize = parseFloat(ingredient.package_size) || 1;
    const packageUnit = ingredient.package_unit || 'piece';
    
    // Special handling for ingredients sold by pieces (pcs)
    if (packageUnit.toLowerCase() === 'pcs') {
      // Calculate how many packages needed based on package size
      // For example if recipe needs 10 eggs and package has 12 eggs, buy 1 package
      const packagesNeeded = Math.ceil(amount / packageSize);
      return Math.max(1, packagesNeeded);
    }
    
    // Convert units to same base for comparison
    const recipeAmountInBaseUnit = convertToBaseUnit(amount, unit);
    const packageSizeInBaseUnit = convertToBaseUnit(packageSize, packageUnit);
    
    // Check if units are compatible for comparison
    if (recipeAmountInBaseUnit && packageSizeInBaseUnit && areUnitsCompatible(unit, packageUnit)) {
      // Calculate how many packages needed
      const packagesNeeded = Math.ceil(recipeAmountInBaseUnit / packageSizeInBaseUnit);
      return Math.max(1, packagesNeeded);
    }
    
    // Fallback for non-convertible or incompatible units
    console.warn(`Unit mismatch: Recipe uses "${unit}" but package is sold in "${packageUnit}". Using fallback logic.`);
    return getShoppingQuantityFallback(amount, unit, ingredient.name, packageUnit);
    
  } catch (error) {
    console.error('Error getting package info:', error);
    return getShoppingQuantityFallback(amount, unit, null, null);
  }
};