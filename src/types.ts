export interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  score: 'green' | 'orange' | 'red';
}

export interface UserProfile {
  uid: string;
  displayName?: string;
  email: string;
  dailyCaloriesGoal: number;
  dailyProteinGoal: number;
  dailyCarbsGoal: number;
  dailyFatGoal: number;
  createdAt: any;
}

export interface Meal {
  id?: string;
  uid: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  imageUrl?: string;
  timestamp: any;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  ingredients?: Ingredient[];
}

export interface NutritionAnalysis {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
  description: string;
}

export interface ScannedProduct {
  barcode: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  salt?: number;
  nutriscore?: string;
  novaGroup?: number;
  ingredients?: string;
  healthScore: number;
  healthLabel: 'excellent' | 'good' | 'mediocre' | 'poor';
  healthColor: 'green' | 'orange' | 'red';
  positivePoints?: string[];
  negativePoints?: string[];
}