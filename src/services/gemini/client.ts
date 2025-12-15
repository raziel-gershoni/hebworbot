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
 * Generate content with structured JSON output
 * Uses plain JSON mode without schema validation (Gemini's schema format is too restrictive)
 */
export async function generateStructured<T>(
  prompt: string,
  schema: ZodSchema<T>,
  modelName?: string,
  isPremium: boolean = false
): Promise<T> {
  const model = getModel(modelName, isPremium);

  const startTime = Date.now();

  try {
    logger.debug(`Gemini request: ${prompt.substring(0, 100)}...`);

    // Use JSON mode without schema enforcement
    // Gemini will generate JSON, we validate with Zod after
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        // Don't use responseSchema - it's too restrictive
      },
    });

    const responseTime = Date.now() - startTime;
    logger.debug(`Gemini response time: ${responseTime}ms`);

    const text = result.response.text();

    logger.debug('Raw Gemini response:', text.substring(0, 500));

    const parsed = JSON.parse(text);

    // Validate with Zod (this catches any schema issues)
    const validated = schema.parse(parsed);

    logger.info('Gemini structured output validated successfully');
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
