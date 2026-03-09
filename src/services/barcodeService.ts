import { ScannedProduct } from '../types';

interface OFFNutriments {
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  'saturated-fat_100g'?: number;
  fiber_100g?: number;
  sugars_100g?: number;
  salt_100g?: number;
}

interface OFFProduct {
  product_name?: string;
  product_name_fr?: string;
  brands?: string;
  image_front_url?: string;
  image_url?: string;
  nutriscore_grade?: string;
  nova_group?: number;
  additives_tags?: string[];
  ingredients_text_fr?: string;
  ingredients_text?: string;
  nutriments?: OFFNutriments;
}

function calculateHealthScore(product: OFFProduct): number {
  const n = product.nutriments || {};
  const ns = product.nutriscore_grade?.toLowerCase();
  const nova = product.nova_group;
  let score: number;
  if (ns && ['a', 'b', 'c', 'd', 'e'].includes(ns)) {
    const nsMap: Record<string, number> = { a: 60, b: 48, c: 36, d: 18, e: 6 };
    score = nsMap[ns];
  } else {
    score = 50;
    const kcal = n['energy-kcal_100g'] || 0;
    const sugar = n.sugars_100g || 0;
    const sat = n['saturated-fat_100g'] || 0;
    const salt = n.salt_100g || 0;
    const fiber = n.fiber_100g || 0;
    const protein = n.proteins_100g || 0;
    if (kcal > 500) score -= 8;
    if (sugar > 20) score -= 15; else if (sugar > 10) score -= 7;
    if (sat > 10) score -= 10; else if (sat > 5) score -= 5;
    if (salt > 1.5) score -= 8; else if (salt > 0.8) score -= 4;
    if (fiber > 5) score += 10; else if (fiber > 3) score += 5;
    if (protein > 15) score += 5;
  }
  if (nova === 1) score += 30;
  else if (nova === 2) score += 15;
  else if (nova === 3) score += 5;
  else if (nova === 4) score = Math.min(score, 35);
  const additives = (product.additives_tags || []).length;
  score -= Math.min(20, additives * 4);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getHealthLabel(score: number): 'excellent' | 'good' | 'mediocre' | 'poor' {
  if (score >= 75) return 'excellent';
  if (score >= 50) return 'good';
  if (score >= 25) return 'mediocre';
  return 'poor';
}

function getHealthColor(score: number): 'green' | 'orange' | 'red' {
  if (score >= 50) return 'green';
  if (score >= 25) return 'orange';
  return 'red';
}

function getPositivePoints(n: OFFNutriments): string[] {
  const pts: string[] = [];
  if ((n.fiber_100g || 0) > 3) pts.push('Riche en fibres');
  if ((n.proteins_100g || 0) > 10) pts.push('Riche en protéines');
  if ((n.sugars_100g || 0) < 5) pts.push('Faible en sucres');
  if ((n['saturated-fat_100g'] || 0) < 1.5) pts.push('Faible en graisses saturées');
  if ((n.salt_100g || 0) < 0.3) pts.push('Faible en sel');
  return pts;
}

function getNegativePoints(n: OFFNutriments): string[] {
  const pts: string[] = [];
  if ((n.sugars_100g || 0) > 15) pts.push('Riche en sucres');
  if ((n['saturated-fat_100g'] || 0) > 5) pts.push('Riche en graisses saturées');
  if ((n.salt_100g || 0) > 1.2) pts.push('Trop salé');
  if ((n['energy-kcal_100g'] || 0) > 400) pts.push('Très calorique');
  return pts;
}

export async function lookupBarcode(barcode: string): Promise<ScannedProduct> {
  const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'NutriScan/1.0 (jeremyswcge@gmail.com)' }
  });
  if (!response.ok) throw new Error('Erreur réseau lors de la recherche du produit');
  const data = await response.json();
  if (data.status === 0 || !data.product) throw new Error('Produit introuvable dans la base de données Open Food Facts');
  const p: OFFProduct = data.product;
  const n = p.nutriments || {};
  const healthScore = calculateHealthScore(p);
  return {
    barcode,
    name: p.product_name_fr || p.product_name || 'Produit inconnu',
    brand: p.brands?.split(',')[0]?.trim(),
    imageUrl: p.image_front_url || p.image_url,
    calories: Math.round(n['energy-kcal_100g'] || 0),
    protein: Math.round((n.proteins_100g || 0) * 10) / 10,
    carbs: Math.round((n.carbohydrates_100g || 0) * 10) / 10,
    fat: Math.round((n.fat_100g || 0) * 10) / 10,
    fiber: n.fiber_100g !== undefined ? Math.round(n.fiber_100g * 10) / 10 : undefined,
    sugar: n.sugars_100g !== undefined ? Math.round(n.sugars_100g * 10) / 10 : undefined,
    salt: n.salt_100g !== undefined ? Math.round(n.salt_100g * 10) / 10 : undefined,
    nutriscore: p.nutriscore_grade?.toUpperCase(),
    novaGroup: p.nova_group,
    ingredients: p.ingredients_text_fr || p.ingredients_text,
    healthScore,
    healthLabel: getHealthLabel(healthScore),
    healthColor: getHealthColor(healthScore),
    positivePoints: getPositivePoints(n),
    negativePoints: getNegativePoints(n),
  };
}
