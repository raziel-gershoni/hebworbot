/**
 * Vercel Serverless Webhook Handler
 *
 * Main entry point for Telegram webhook requests
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bot } from '../src/bot/index.js';
import { startHandler } from '../src/bot/handlers/start.js';
import { assessmentHandler } from '../src/bot/handlers/level-assessment.js';
import { dailyWordsHandler } from '../src/bot/handlers/daily-words.js';
import { exercisesHandler } from '../src/bot/handlers/exercises.js';
import { progressHandler } from '../src/bot/handlers/progress.js';
import { logger } from '../src/utils/logger.js';
import { validateConfig } from '../src/utils/config.js';

// Validate configuration on cold start
try {
  validateConfig();
  logger.info('Configuration validated successfully');
} catch (error: any) {
  logger.error('Configuration validation failed:', error);
  throw error;
}

// Register all handlers
bot.use(startHandler);
bot.use(assessmentHandler);
bot.use(dailyWordsHandler);
bot.use(exercisesHandler);
bot.use(progressHandler);

// Log when webhook is ready
logger.info('Webhook handler initialized');

// Initialize bot once (cached across invocations)
let botInitialized = false;

// Vercel serverless function handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    logger.info('Webhook received:', {
      method: req.method,
      hasBody: !!req.body,
      updateId: req.body?.update_id,
    });

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!req.body) {
      logger.error('No body in request');
      return res.status(400).json({ error: 'No body' });
    }

    // Initialize bot on first request (cached for subsequent requests)
    if (!botInitialized) {
      logger.info('Initializing bot...');
      await bot.init();
      botInitialized = true;
      logger.info('Bot initialized successfully');
    }

    // Handle the update with grammY
    await bot.handleUpdate(req.body);

    logger.info('Update handled successfully');
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    logger.error('Webhook error:', {
      message: error?.message,
      stack: error?.stack,
      error: error,
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
