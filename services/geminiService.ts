
import { GoogleGenAI, Type } from "@google/genai";
import { ArtStyleConfig, ParticleShape } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateArtStyle = async (prompt: string): Promise<ArtStyleConfig> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Create a highly artistic visual particle system config based on: "${prompt}".
      The particles render a live webcam feed in 2D space. 
      Focus on aesthetic concepts: color palettes, geometric abstraction, movement fluid dynamics.
      Rules:
      - Use 'lighter' blending for neon/glow/cyber themes.
      - Use 'source-over' for paint/ink/minimalist themes.
      - 'density' (4-15): 4 is high detail, 15 is abstract.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
            particleSizeMin: { type: Type.NUMBER },
            particleSizeMax: { type: Type.NUMBER },
            density: { type: Type.NUMBER },
            speed: { type: Type.NUMBER },
            friction: { type: Type.NUMBER },
            shape: { type: Type.STRING, enum: ["circle", "square", "line", "cross"] },
            blendingMode: { type: Type.STRING, enum: ["source-over", "lighter"] },
            connectionDistance: { type: Type.NUMBER },
            trailEffect: { type: Type.NUMBER },
            noiseStrength: { type: Type.NUMBER },
            flowFieldStrength: { type: Type.NUMBER }
          },
          required: ["name", "colors", "density", "shape", "blendingMode"]
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      const shapeMap: any = { 'circle': ParticleShape.CIRCLE, 'square': ParticleShape.SQUARE, 'line': ParticleShape.LINE, 'cross': ParticleShape.CROSS };
      
      return {
        ...data,
        shape: shapeMap[data.shape] || ParticleShape.CIRCLE,
        blendingMode: data.blendingMode || 'source-over',
        flowFieldStrength: data.flowFieldStrength ?? 1,
        trailEffect: data.trailEffect ?? 0.2
      };
    }
    throw new Error("No response");
  } catch (error) {
    console.error("Style generation failed:", error);
    return {
      name: "Nebula Pulse",
      description: "Fallback ethereal style",
      colors: ["#6366f1", "#a855f7", "#ec4899"],
      particleSizeMin: 1,
      particleSizeMax: 6,
      density: 8,
      speed: 1.5,
      friction: 0.9,
      shape: ParticleShape.CIRCLE,
      blendingMode: 'lighter',
      connectionDistance: 30,
      trailEffect: 0.1,
      noiseStrength: 2,
      flowFieldStrength: 1
    };
  }
};
