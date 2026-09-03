import express from "express";
import path from "path";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { jsonrepair } from "jsonrepair";
import rateLimit from "express-rate-limit";

const Type = {
  OBJECT: "object",
  STRING: "string",
  ARRAY: "array",
  INTEGER: "integer",
  NUMBER: "number",
  BOOLEAN: "boolean",
} as const;

// Lazy-loaded AI clients
let openaiClient: OpenAI | null = null;
let lastApiKey: string | null = null;
let geminiClient: GoogleGenAI | null = null;

const DEEPSEEK_MODEL = "deepseek-chat";
const GEMINI_MODEL = "gemini-3.6-flash";

function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return geminiClient;
}

function getDeepSeekClient(): any {
  const gemini = getGeminiClient();
  const dsKey = process.env.DEEPSEEK_API_KEY;

  if (dsKey && (!openaiClient || dsKey !== lastApiKey)) {
    lastApiKey = dsKey;
    openaiClient = new OpenAI({
      apiKey: dsKey,
      baseURL: "https://api.deepseek.com/v1"
    });
  }

  return {
    models: {
      generateContent: async (args: any) => {
        // Option 1: Gemini via @google/genai SDK
        if (gemini) {
          try {
            let formattedContents: any = args.contents;
            if (typeof args.contents === "string") {
              formattedContents = args.contents;
            } else if (Array.isArray(args.contents)) {
              formattedContents = args.contents.map((m: any) => {
                if (typeof m === "string") return { role: "user", parts: [{ text: m }] };
                const role = (m.role === "assistant" || m.role === "model") ? "model" : "user";
                const text = m.parts ? (m.parts[0]?.text || "") : (m.content || m.text || "");
                return { role, parts: [{ text }] };
              });
            }

            const configObj: any = {};
            if (args.config?.systemInstruction) {
              configObj.systemInstruction = args.config.systemInstruction;
            }
            if (args.config?.responseMimeType) {
              configObj.responseMimeType = args.config.responseMimeType;
            }
            if (args.config?.responseSchema) {
              configObj.responseSchema = args.config.responseSchema;
            }

            const res = await gemini.models.generateContent({
              model: GEMINI_MODEL,
              contents: formattedContents,
              config: configObj,
            });

            return {
              text: res.text || ""
            };
          } catch (geminiError: any) {
            console.error("Gemini API call failed, attempting DeepSeek fallback:", geminiError.message || geminiError);
            if (!openaiClient) throw geminiError;
          }
        }

        // Option 2: DeepSeek via OpenAI SDK
        if (openaiClient) {
          let messages: any[] = [];
          let systemInstruction = "";
          
          if (args.config && args.config.systemInstruction) {
            systemInstruction = args.config.systemInstruction;
          }

          if (args.config && args.config.responseSchema) {
            const schemaStr = JSON.stringify(args.config.responseSchema);
            systemInstruction += `\n\nCRITICAL JSON SCHEMA REQUIREMENT:
You MUST return a JSON object conforming strictly to the following JSON Schema structure:
${schemaStr}

Ensure you output ONLY a valid stringified JSON object containing exactly the requested keys. Avoid wrapping JSON keys in custom types or lists unless explicitly requested. Do not output anything other than this JSON.`;
          }

          if (systemInstruction) {
            messages.push({ role: "system", content: systemInstruction });
          }

          if (typeof args.contents === "string") {
            messages.push({ role: "user", content: args.contents });
          } else if (Array.isArray(args.contents)) {
            for (const msg of args.contents) {
              const role = (msg.role === 'model' || msg.role === 'assistant') ? 'assistant' : 'user';
              const content = msg.parts ? msg.parts[0]?.text : (msg.content || msg.text);
              messages.push({ role, content });
            }
          }
          
          let response_format: any;
          if (args.config && (args.config.responseMimeType === "application/json" || args.config.responseSchema)) {
            response_format = { type: "json_object" };
          }

          const res = await openaiClient.chat.completions.create({
            model: DEEPSEEK_MODEL,
            messages,
            response_format,
          });

          return {
            text: res.choices[0].message.content
          };
        }

        throw new Error("No AI provider API key is configured or available.");
      },

      generateContentStream: async (args: any) => {
        // Option 1: Gemini via @google/genai SDK
        if (gemini) {
          try {
            let formattedContents: any = args.contents;
            if (typeof args.contents === "string") {
              formattedContents = args.contents;
            } else if (Array.isArray(args.contents)) {
              formattedContents = args.contents.map((m: any) => {
                if (typeof m === "string") return { role: "user", parts: [{ text: m }] };
                const role = (m.role === "assistant" || m.role === "model") ? "model" : "user";
                const text = m.parts ? (m.parts[0]?.text || "") : (m.content || m.text || "");
                return { role, parts: [{ text }] };
              });
            }

            const configObj: any = {};
            if (args.config?.systemInstruction) {
              configObj.systemInstruction = args.config.systemInstruction;
            }

            const responseStream = await gemini.models.generateContentStream({
              model: GEMINI_MODEL,
              contents: formattedContents,
              config: configObj,
            });

            async function* geminiStreamGenerator() {
              for await (const chunk of responseStream) {
                yield { text: chunk.text || "" };
              }
            }
            return geminiStreamGenerator();
          } catch (geminiError: any) {
            console.error("Gemini stream failed, attempting DeepSeek fallback:", geminiError.message || geminiError);
            if (!openaiClient) throw geminiError;
          }
        }

        // Option 2: DeepSeek via OpenAI SDK
        if (openaiClient) {
          let messages: any[] = [];
          if (args.config && args.config.systemInstruction) {
            messages.push({ role: "system", content: args.config.systemInstruction });
          }
          if (Array.isArray(args.contents)) {
            for (const msg of args.contents) {
              const role = (msg.role === 'model' || msg.role === 'assistant') ? 'assistant' : 'user';
              const content = msg.parts ? msg.parts[0]?.text : (msg.content || msg.text);
              messages.push({ role, content });
            }
          } else if (typeof args.contents === "string") {
            messages.push({ role: "user", content: args.contents });
          }
          
          const stream = await openaiClient.chat.completions.create({
            model: DEEPSEEK_MODEL,
            messages,
            stream: true
          });

          async function* dsStreamGenerator() {
            for await (const chunk of stream) {
              const text = chunk.choices[0]?.delta?.content || "";
              yield { text };
            }
          }
          return dsStreamGenerator();
        }

        throw new Error("No AI provider API key is configured or available.");
      }
    }
  };
}

function parseJsonSafe(text: string): any {
  let cleaned = text.trim();
  
  // Remove <think>...</think> block if present
  const thinkStart = cleaned.indexOf("<think>");
  const thinkEnd = cleaned.indexOf("</think>");
  if (thinkStart !== -1 && thinkEnd !== -1 && thinkEnd > thinkStart) {
    cleaned = cleaned.substring(0, thinkStart) + cleaned.substring(thinkEnd + 8);
    cleaned = cleaned.trim();
  }

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Attempt jsonrepair
    try {
      const repaired = jsonrepair(cleaned);
      return JSON.parse(repaired);
