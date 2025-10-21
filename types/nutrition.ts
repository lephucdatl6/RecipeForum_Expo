export interface NutritionalInfo {
  totalCalories: number;
  servings: number;
  caloriesPerServing: number;
  macronutrients: {
    carbohydrates: number;
    protein: number;
    fat: number;
  };
  micronutrients: {
    fiber: number;
    sugar: number;
    sodium: number;
    calcium: number;
    iron: number;
    vitaminC: number;
  };
  notes?: string;
}

export interface NutritionResponse {
  success: boolean;
  nutritionalInfo?: NutritionalInfo;
  calculatedAt?: string;
  cached?: boolean;
  error?: string;
}