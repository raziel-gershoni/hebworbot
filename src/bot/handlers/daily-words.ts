/**
 * Daily Words Handler
 *
 * Deliver new Hebrew words to users based on their level
 */

import { Composer, InlineKeyboard } from 'grammy';
import type { BotContext } from '../../types/bot.js';
import { getUserById } from '../../services/database/models/user.js';
import { sql } from '../../services/database/client.js';
import { logger } from '../../utils/logger.js';

export const dailyWordsHandler = new Composer<BotContext>();

/**
 * Get new words for user at their level
 */
async function getNewWordsForUser(userId: number, level: string, count: number = 5) {
  // Get words at user's level that they haven't learned yet
  const words = await sql`
    SELECT v.*
    FROM vocabulary v
    WHERE v.cefr_level = ${level}
      AND NOT EXISTS (
        SELECT 1 FROM user_vocabulary uv
        WHERE uv.user_id = ${userId}
          AND uv.vocabulary_id = v.id
      )
    ORDER BY v.frequency_rank ASC
    LIMIT ${count}
  `;

  return words;
}

/**
 * Mark words as being learned by user
 */
async function markWordsAsLearning(userId: number, vocabularyIds: number[]) {
  for (const vocabId of vocabularyIds) {
    await sql`
      INSERT INTO user_vocabulary (user_id, vocabulary_id, status, first_seen_at)
      VALUES (${userId}, ${vocabId}, 'learning', NOW())
      ON CONFLICT (user_id, vocabulary_id) DO NOTHING
    `;
  }
}

/**
 * Daily words callback - main entry point
 */
dailyWordsHandler.callbackQuery('daily_words', async (ctx) => {
  await ctx.answerCallbackQuery();

  if (!ctx.from) return;

  const userId = ctx.from.id;

  try {
    // Get user
    const user = await getUserById(userId);

    if (!user || !user.current_level) {
      await ctx.editMessageText(
        'Сначала пройдите тест для определения уровня. Используйте /start',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Get new words
    const wordsCount = user.daily_words_count || 5;
    const newWords = await getNewWordsForUser(userId, user.current_level, wordsCount);

    if (newWords.length === 0) {
      // Check if user is ready for level up
      const masteredWords = await sql`
        SELECT COUNT(*) as count
        FROM user_vocabulary uv
        JOIN vocabulary v ON uv.vocabulary_id = v.id
        WHERE uv.user_id = ${userId}
          AND v.cefr_level = ${user.current_level}
          AND uv.status = 'mastered'
      `;

      const totalLevelWords = await sql`
        SELECT COUNT(*) as count
        FROM vocabulary
        WHERE cefr_level = ${user.current_level}
      `;

      const mastered = parseInt(masteredWords[0].count as string);
      const total = parseInt(totalLevelWords[0].count as string);
      const masteredPercentage = total > 0 ? Math.round((mastered / total) * 100) : 0;

      const levelOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      const currentLevelIndex = levelOrder.indexOf(user.current_level);
      const hasNextLevel = currentLevelIndex < levelOrder.length - 1;

      let message = `🎉 Отлично! Вы уже изучили все доступные слова уровня **${user.current_level}**!\n\n`;

      if (masteredPercentage >= 70 && hasNextLevel) {
        message += `💪 Вы освоили **${masteredPercentage}%** слов этого уровня!\n\n`;
        message += `Готовы перейти на следующий уровень? Пройдите тест заново, чтобы узнать свой новый уровень!`;

        await ctx.editMessageText(message, {
          reply_markup: new InlineKeyboard()
            .text('🎯 Пройти тест заново', 'retake_assessment')
            .row()
            .text('✏️ Повторить слова', 'exercises')
            .text('📚 Меню', 'main_menu'),
          parse_mode: 'Markdown',
        });
      } else {
        message += `Повторите изученные слова для закрепления.`;

        await ctx.editMessageText(message, {
          reply_markup: new InlineKeyboard()
            .text('✏️ Упражнения', 'exercises')
            .text('📚 Главное меню', 'main_menu'),
          parse_mode: 'Markdown',
        });
      }
      return;
    }

    // Mark as learning
    await markWordsAsLearning(userId, newWords.map(w => w.id));

    // Display words
    const wordsText = newWords.map((word, index) => {
      return `**${index + 1}. ${word.hebrew_word}**\n💭 ${word.russian_translation}\n📖 ${word.example_sentence_hebrew}\n   _${word.example_sentence_russian}_`;
    }).join('\n\n');

    const messageText = `
📚 **Новые слова для изучения** (Уровень: ${user.current_level})

${wordsText}

Изучите эти слова, а затем проверьте себя с помощью упражнений!
`;

    const keyboard = new InlineKeyboard()
      .text('✏️ Начать упражнения', 'start_exercises')
      .row()
      .text('📖 Ещё слова', 'daily_words')
      .text('📚 Главное меню', 'main_menu');

    await ctx.editMessageText(messageText, {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    });

    logger.info(`Delivered ${newWords.length} words to user ${userId} (level: ${user.current_level})`);

  } catch (error: any) {
    logger.error('Error in daily words handler:', error);
    await ctx.editMessageText(
      'Произошла ошибка. Пожалуйста, попробуйте позже.',
      { parse_mode: 'Markdown' }
    );
  }
});
