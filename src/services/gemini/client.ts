/**
 * Gemini API Client
 *
 * Handles communication with Google's Gemini API for:
 * - Level assessment
 * - Translation generation
 * - CEFR level assignment
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ZodSchema } from 'zod';
import { config } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

/**
 * Model cache to avoid recreating model instances
 */
const modelCache: Map<string, GenerativeModel> = new Map();

/**
 * Get a Gemini model instance
 */
export function getModel(modelName?: string, isPremium: boolean = false): GenerativeModel {
  const name = modelName || (isPremium ? config.gemini.modelPremium : config.gemini.model);

  if (modelCache.has(name)) {
    return modelCache.get(name)!;
  }

  const model = genAI.getGenerativeModel({
    model: name,
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    },
  });

  modelCache.set(name, model);
  return model;
}

/**
 * Clean JSON schema for Gemini API
 * Removes $schema, $ref, definitions that Gemini doesn't support
 */
function cleanSchemaForGemini(schema: any): any {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }

  // Remove Gemini-incompatible properties
  const { $schema, $ref, definitions, ...cleaned } = schema;

  // If there are definitions, we need to inline them
  if (definitions && $ref) {
    // This is a reference - inline the definition
    const refName = $ref.split('/').pop();
    if (refName && definitions[refName]) {
      return cleanSchemaForGemini(definitions[refName]);
    }
  }

  // Recursively clean nested schemas
  const result: any = {};
  for (const [key, value] of Object.entries(cleaned)) {
    if (typeof value === 'object' && value !== null) {
      result[key] = cleanSchemaForGemini(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Generate content with structured JSON output
 */
export async function generateStructured<T>(
  prompt: string,
  schema: ZodSchema<T>,
  modelName?: string,
  isPremium: boolean = false
): Promise<T> {
  const model = getModel(modelName, isPremium);
  const rawSchema = zodToJsonSchema(schema, 'schema');

  // Clean schema for Gemini API compatibility
  const cleanedSchema = cleanSchemaForGemini(rawSchema);

  const startTime = Date.now();

  try {
    logger.debug(`Gemini request: ${prompt.substring(0, 100)}...`);

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: cleanedSchema as any,
      },
    });

    const responseTime = Date.now() - startTime;
    logger.debug(`Gemini response time: ${responseTime}ms`);

    const text = result.response.text();
    const parsed = JSON.parse(text);

    // Validate with Zod
    const validated = schema.parse(parsed);

    return validated;
  } catch (error: any) {
    logger.error('Gemini API error:', {
      message: error.message,
      prompt: prompt.substring(0, 200),
    });
    throw new Error(`Gemini API failed: ${error.message}`);
  }
}

/**
 * Generate content without structured output (free-form text)
 */
export async function generateText(
  prompt: string,
  modelName?: string,
  isPremium: boolean = false
): Promise<string> {
  const model = getModel(modelName, isPremium);

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error: any) {
    logger.error('Gemini API error:', error);
    throw new Error(`Gemini API failed: ${error.message}`);
  }
}

/**
 * Test model performance and quality
 */
export async function testModel(modelName: string) {
  logger.info(`Testing Gemini model: ${modelName}`);

  const testPrompt = 'Translate these Hebrew words to Russian: שלום (shalom), ספר (sefer), בית (bayit)';

  const startTime = Date.now();

  try {
    const result = await generateText(testPrompt, modelName);
    const responseTime = Date.now() - startTime;

    logger.info(`Model ${modelName} test successful`, {
      responseTime,
      response: result.substring(0, 200),
    });

    return {
      model: modelName,
      responseTime,
      success: true,
      response: result,
    };
  } catch (error: any) {
    logger.error(`Model ${modelName} test failed:`, error);

    return {
      model: modelName,
      responseTime: -1,
      success: false,
      error: error.message,
    };
  }
}
