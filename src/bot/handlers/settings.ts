/**
 * Settings Handler
 *
 * User preferences and settings
 */

import { Composer, InlineKeyboard } from 'grammy';
import type { BotContext } from '../../types/bot.js';
import { getUserById } from '../../services/database/models/user.js';
import { sql } from '../../services/database/client.js';
import { logger } from '../../utils/logger.js';

export const settingsHandler = new Composer<BotContext>();

/**
 * Settings callback - show settings menu
 */
settingsHandler.callbackQuery('settings', async (ctx) => {
  await ctx.answerCallbackQuery();

  if (!ctx.from) return;

  const userId = ctx.from.id;

  try {
    const user = await getUserById(userId);

    if (!user) {
      await ctx.editMessageText('Ошибка: пользователь не найден. Используйте /start');
      return;
    }

    const currentWordsCount = user.daily_words_count || 5;

    const settingsText = `
⚙️ **Настройки**

**Текущие настройки:**

📚 Слов за раз: **${currentWordsCount}**
🎓 Уровень: **${user.current_level || 'не определён'}**

━━━━━━━━━━━━━━━━

Вы можете изменить количество новых слов, которые получаете за один раз.
`;

    const keyboard = new InlineKeyboard()
      .text('📚 Изменить количество слов', 'settings_words')
      .row()
      .text('🎯 Пройти тест заново', 'retake_assessment')
      .row()
      .text('📚 Главное меню', 'main_menu');

    await ctx.editMessageText(settingsText, {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    });

  } catch (error: any) {
    logger.error('Error in settings handler:', error);
    await ctx.editMessageText('Произошла ошибка. Попробуйте позже.');
  }
});

/**
 * Words count settings
 */
settingsHandler.callbackQuery('settings_words', async (ctx) => {
  await ctx.answerCallbackQuery();

  if (!ctx.from) return;

  const userId = ctx.from.id;

  try {
    const user = await getUserById(userId);
    if (!user) return;

    const currentWordsCount = user.daily_words_count || 5;

    const keyboard = new InlineKeyboard()
      .text(currentWordsCount === 5 ? '✅ 5 слов' : '5 слов', 'set_words_5')
      .text(currentWordsCount === 7 ? '✅ 7 слов' : '7 слов', 'set_words_7')
      .text(currentWordsCount === 10 ? '✅ 10 слов' : '10 слов', 'set_words_10')
      .row()
      .text('◀️ Назад', 'settings');

    await ctx.editMessageText(
      `📚 **Количество слов за раз**\n\nВыберите, сколько новых слов вы хотите получать за один раз:\n\n• **5 слов** - быстрое изучение\n• **7 слов** - оптимально\n• **10 слов** - интенсивное обучение\n\nТекущая настройка: **${currentWordsCount} слов**`,
      {
        reply_markup: keyboard,
        parse_mode: 'Markdown',
      }
    );

  } catch (error: any) {
    logger.error('Error in settings_words:', error);
  }
});

/**
 * Set words count handlers
 */
settingsHandler.callbackQuery(/^set_words_(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();

  if (!ctx.from) return;

  const userId = ctx.from.id;
  const match = ctx.callbackQuery.data.match(/^set_words_(\d+)$/);
  if (!match) return;

  const wordsCount = parseInt(match[1]);

  try {
    // Update user settings
    await sql`
      UPDATE users
      SET daily_words_count = ${wordsCount}
      WHERE id = ${userId}
    `;

    await ctx.answerCallbackQuery({ text: `✅ Установлено: ${wordsCount} слов` });

    // Return to settings menu
    const user = await getUserById(userId);
    if (!user) return;

    const settingsText = `
⚙️ **Настройки**

**Текущие настройки:**

📚 Слов за раз: **${wordsCount}**
🎓 Уровень: **${user.current_level || 'не определён'}**

━━━━━━━━━━━━━━━━

Вы можете изменить количество новых слов, которые получаете за один раз.
`;

    const keyboard = new InlineKeyboard()
      .text('📚 Изменить количество слов', 'settings_words')
      .row()
      .text('🎯 Пройти тест заново', 'retake_assessment')
      .row()
      .text('📚 Главное меню', 'main_menu');

    await ctx.editMessageText(settingsText, {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    });

    logger.info(`User ${userId} set daily words count to ${wordsCount}`);

  } catch (error: any) {
    logger.error('Error setting words count:', error);
  }
});
