/**
 * Bot Instance
 *
 * Initialize grammY bot with session management and handlers
 */

import { Bot, session } from 'grammy';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import type { BotContext } from '../types/bot.js';

// Validate configuration
if (!config.telegram.botToken) {
  throw new Error('TELEGRAM_BOT_TOKEN is not set');
}

/**
 * Create bot instance
 */
export const bot = new Bot<BotContext>(config.telegram.botToken);

/**
 * Session middleware
 * For serverless, we use a simple in-memory session (conversation state is stored in DB)
 */
bot.use(
  session({
    initial: () => ({
      userId: 0,
    }),
  })
);

/**
 * Error handler
 */
bot.catch((err) => {
  logger.error('Bot error:', {
    error: err.error,
    ctx: err.ctx.update,
  });
});

/**
 * Log all updates in development
 */
if (config.env === 'development') {
  bot.use((ctx, next) => {
    logger.debug('Update received:', {
      updateId: ctx.update.update_id,
      from: ctx.from?.id,
      message: ctx.message?.text || ctx.callbackQuery?.data,
    });
    return next();
  });
}

logger.info('Bot initialized');
