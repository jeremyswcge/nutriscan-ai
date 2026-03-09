import { GoogleGenAI, Type } from "@google/genai";
import { NutritionAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeFoodImage(base64Image: string): Promise<NutritionAnalysis> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Analyze this food image and provide nutritional information. 
  Be as accurate as possible. If multiple items are present, provide the total nutritional value.
  Return the response in JSON format.`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name of the food" },
          calories: { type: Type.NUMBER, description: "Total calories" },
          protein: { type: Type.NUMBER, description: "Protein in grams" },
          carbs: { type: Type.NUMBER, description: "Carbohydrates in grams" },
          fat: { type: Type.NUMBER, description: "Fat in grams" },
          confidence: { type: Type.NUMBER, description: "Confidence score 0-1" },
          description: { type: Type.STRING, description: "Brief description of the food" },
        },
        required: ["name", "calories", "protein", "carbs", "fat", "confidence", "description"],
      },
    },
  });

  const result = JSON.parse(response.text || "{}");
  return result as NutritionAnalysis;
}
