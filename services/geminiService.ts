
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";

// Initialize the Google GenAI SDK with the API key from environment variables
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates smart suggestions for text spans to annotate using Gemini.
 */
export const getSmartSuggestions = async (text: string): Promise<any[]> => {
  if (!text || text.trim().length < 10) return [];

  try {
    // Generate content using the recommended model for basic text tasks
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the following text and suggest 3 key spans (entities, concepts, or important phrases) to annotate.
      Text: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              label: { type: Type.STRING },
              reason: { type: Type.STRING }
            },
            required: ["text", "label"]
          }
        }
      }
    });

    // Directly access the .text property (not as a method)
    const jsonStr = response.text?.trim() || '[]';
    // Cast JSON.parse result to any[] to avoid 'unknown' type errors during mapping
    const suggestions = JSON.parse(jsonStr) as any[];
    
    // Map suggestions back to their character offsets in the original content
    return suggestions.map((s: any) => {
      const start = text.indexOf(s.text);
      if (start === -1) return null;
      return {
        ...s,
        start,
        end: start + s.text.length
      };
    }).filter(Boolean);
  } catch (error) {
    console.error("Gemini suggestion error:", error);
    return [];
  }
};

/**
 * Generates audio data for text-to-speech using Gemini 2.5 series.
 */
export const getTextToSpeech = async (text: string): Promise<string | undefined> => {
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read this paragraph clearly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    // Extract raw audio data from candidates using the established response structure
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("TTS generation error:", error);
    return undefined;
  }
};

// Audio Decoding Utilities
export function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
