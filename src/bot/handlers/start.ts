/**
 * /start Command Handler
 *
 * Handle user onboarding and initial setup
 */

import { Composer } from 'grammy';
import type { BotContext } from '../../types/bot.js';
import { getOrCreateUser, hasCompletedAssessment } from '../../services/database/models/user.js';
import { createMainMenuKeyboard, MAIN_MENU_TEXT } from '../keyboards/main-menu.js';
import { InlineKeyboard } from 'grammy';
import { logger } from '../../utils/logger.js';

export const startHandler = new Composer<BotContext>();

/**
 * /start command
 */
startHandler.command('start', async (ctx) => {
  logger.info('Start command received', {
    from: ctx.from?.id,
    chat: ctx.chat?.id,
  });

  if (!ctx.from) {
    logger.warn('No from user in context');
    return;
  }

  const userId = ctx.from.id;
  const username = ctx.from.username;
  const firstName = ctx.from.first_name;
  const languageCode = ctx.from.language_code;

  logger.info(`User ${userId} started the bot`);

  try {
    // Get or create user in database
    const user = await getOrCreateUser({
      id: userId,
      telegram_username: username,
      first_name: firstName,
      language_code: languageCode,
    });

    // Check if user has completed assessment
    const completed = await hasCompletedAssessment(userId);

    if (!completed) {
      // New user or hasn't completed assessment
      const keyboard = new InlineKeyboard().text(
        '🎯 Начать тест',
        'start_assessment'
      );

      await ctx.reply(
        `Здравствуйте, ${firstName}! 👋

Добро пожаловать в бот для изучения иврита!

Я помогу вам:
• Определить ваш текущий уровень владения ивритом
• Изучать новые слова с переводом на русский
• Практиковаться с интерактивными упражнениями
• Отслеживать ваш прогресс

Для начала давайте определим ваш уровень владения ивритом. Это займёт около 2-3 минут.`,
        {
          reply_markup: keyboard,
          parse_mode: 'Markdown',
        }
      );
    } else {
      // Existing user with completed assessment
      await ctx.reply(
        `С возвращением, ${firstName}! 👋

Ваш текущий уровень: **${user.current_level}**

Чем займёмся сегодня?`,
        {
          reply_markup: createMainMenuKeyboard(),
          parse_mode: 'Markdown',
        }
      );
    }
  } catch (error: any) {
    logger.error('Error in /start handler:', error);
    await ctx.reply(
      'Произошла ошибка. Пожалуйста, попробуйте позже.',
      { parse_mode: 'Markdown' }
    );
  }
});

/**
 * Main menu callback
 */
startHandler.callbackQuery('main_menu', async (ctx) => {
  await ctx.answerCallbackQuery();

  await ctx.editMessageText(MAIN_MENU_TEXT, {
    reply_markup: createMainMenuKeyboard(),
    parse_mode: 'Markdown',
  });
});
