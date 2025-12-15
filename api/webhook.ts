/**
 * Vercel Serverless Webhook Handler
 *
 * Main entry point for Telegram webhook requests
 */

import { webhookCallback } from 'grammy';
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

// Export the webhook callback for Vercel
export default webhookCallback(bot, 'std/http');
