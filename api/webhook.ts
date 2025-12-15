/**
 * Vercel Serverless Webhook Handler
 *
 * Main entry point for Telegram webhook requests
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bot } from '../src/bot/index.js';
import { startHandler } from '../src/bot/handlers/start.js';
import { assessmentHandler } from '../src/bot/handlers/level-assessment.js';
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

// Log when webhook is ready
logger.info('Webhook handler initialized');

// Vercel serverless function handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Handle the update with grammY
    await bot.handleUpdate(req.body);

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    logger.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
