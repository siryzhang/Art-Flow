import { GoogleGenAI, Type } from "@google/genai";
import { ArtStyleConfig, ParticleShape } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateArtStyle = async (prompt: string): Promise<ArtStyleConfig> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Create a visual art style configuration for a particle system based on this description: "${prompt}".
      The particles represent pixels from a webcam feed.
      Think about colors, chaos, geometry, and movement.
      For impressionist/Van Gogh styles, use high flowFieldStrength.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            colors: {
              type: Type.ARRAY,
              items: { type: Type.STRING, description: "Hex color codes" }
            },
            particleSizeMin: { type: Type.NUMBER, description: "Between 1 and 5" },
            particleSizeMax: { type: Type.NUMBER, description: "Between 2 and 20" },
            density: { type: Type.NUMBER, description: "Gap between particles. Low (4) is HD, High (15) is abstract. Range 4-20." },
            speed: { type: Type.NUMBER, description: "Movement multiplier 0-5" },
            friction: { type: Type.NUMBER, description: "0.5 to 0.99" },
            shape: { type: Type.STRING, enum: ["circle", "square", "line", "cross"] },
            connectionDistance: { type: Type.NUMBER, description: "Distance to draw lines between particles. 0 for none, max 100." },
            trailEffect: { type: Type.NUMBER, description: "Alpha for clearing canvas (0.1 = long trails, 0.9 = no trails)" },
            noiseStrength: { type: Type.NUMBER, description: "Random jitter amount 0-10" },
            flowFieldStrength: { type: Type.NUMBER, description: "0 to 5. How much particles follow image contours/gradients." }
          },
          required: ["name", "colors", "particleSizeMin", "particleSizeMax", "density", "speed", "shape"]
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text) as any;
      // Map string enum to typed enum
      const shapeMap: Record<string, ParticleShape> = {
        'circle': ParticleShape.CIRCLE,
        'square': ParticleShape.SQUARE,
        'line': ParticleShape.LINE,
        'cross': ParticleShape.CROSS
      };

      return {
        ...data,
        flowFieldStrength: data.flowFieldStrength || 0,
        shape: shapeMap[data.shape] || ParticleShape.CIRCLE
      };
    }
    throw new Error("No response text");
  } catch (error) {
    console.error("Failed to generate style:", error);
    // Fallback style
    return {
      name: "Error Glitch",
      description: "Fallback style due to AI error",
      colors: ["#ff0000", "#ffffff", "#000000"],
      particleSizeMin: 2,
      particleSizeMax: 10,
      density: 10,
      speed: 2,
      friction: 0.9,
      shape: ParticleShape.SQUARE,
      connectionDistance: 0,
      trailEffect: 0.5,
      noiseStrength: 5,
      flowFieldStrength: 0
    };
  }
};