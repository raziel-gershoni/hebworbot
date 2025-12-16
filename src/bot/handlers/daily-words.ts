/*
 * Daily Words Handler
 *
 * Deliver new Hebrew words to users based on their level
 */

import { Composer, InlineKeyboard } from 'grammy';
import type { BotContext } from '../../types/bot.js';
import { getUserById } from '../../services/database/models/user.js';
import { sql } from '../../services/database/client.js';
import { logger } from '../../utils/logger.js';
import { LEARNING_CONFIG } from '../../utils/config.js';

export const dailyWordsHandler = new Composer<BotContext>();

/*
 * CEFR level progression order
 */
const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

/*
 * Get next CEFR level
 */
export function getNextLevel(currentLevel: string): string | null {
  const currentIndex = LEVEL_ORDER.indexOf(currentLevel as any);
  if (currentIndex === -1 || currentIndex === LEVEL_ORDER.length - 1) {
    return null; // Invalid level or already at max
  }
  return LEVEL_ORDER[currentIndex + 1];
}

/*
 * Calculate user's mastery percentage at current level
 */
export async function calculateLevelMastery(userId: number, level: string): Promise<number> {
  // Count mastered words at this level
  const masteredCount = await sql`
    SELECT COUNT(*) as count
    FROM user_vocabulary uv
    JOIN vocabulary v ON uv.vocabulary_id = v.id
    WHERE uv.user_id = ${userId}
      AND v.cefr_level = ${level}
      AND uv.status = 'mastered'
  `;

  // Count total words at this level
  const totalCount = await sql`
    SELECT COUNT(*) as count
    FROM vocabulary
    WHERE cefr_level = ${level}
  `;

  const mastered = parseInt(masteredCount[0].count as string);
  const total = parseInt(totalCount[0].count as string);

  return total > 0 ? Math.round((mastered / total) * 100) : 0;
}

/*
 * Get word distribution based on mastery percentage
 */
export function getWordDistribution(masteryPercentage: number): {
  currentLevel: number;
  nextLevel: number;
} {
  if (masteryPercentage < LEARNING_CONFIG.PREVIEW_THRESHOLD) {
    return { currentLevel: 1.0, nextLevel: 0.0 };   // 100% current
  } else if (masteryPercentage < LEARNING_CONFIG.GRADUAL_THRESHOLD) {
    return { currentLevel: 0.85, nextLevel: 0.15 }; // 85/15 split
  } else if (masteryPercentage < LEARNING_CONFIG.BALANCED_THRESHOLD) {
    return { currentLevel: 0.7, nextLevel: 0.3 };   // 70/30 split
  } else if (masteryPercentage < LEARNING_CONFIG.ADVANCED_THRESHOLD) {
    return { currentLevel: 0.5, nextLevel: 0.5 };   // 50/50 split
  } else {
    return { currentLevel: 0.3, nextLevel: 0.7 };   // 30/70 split (90-95% range)
  }
}

/*
 * Fetch words at a specific level that user hasn't learned yet
 */
async function fetchWordsAtLevel(
  userId: number,
  level: string,
  count: number
): Promise<any[]> {
  if (count <= 0) return [];

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

/*
 * Get progressive words (mixed levels based on mastery)
 */
async function getProgressiveWords(
  userId: number,
  currentLevel: string,
  count: number = 5
): Promise<any[]> {
  // 1. Calculate current level mastery
  const mastery = await calculateLevelMastery(userId, currentLevel);

  // 2. Determine word distribution based on mastery
  const distribution = getWordDistribution(mastery);

  // 3. Calculate counts for each level
  const currentLevelCount = Math.round(count * distribution.currentLevel);
  const nextLevelCount = count - currentLevelCount;

  // 4. Fetch words from both levels
  const currentLevelWords = await fetchWordsAtLevel(
    userId,
    currentLevel,
    currentLevelCount
  );

  const nextLevel = getNextLevel(currentLevel);
  const nextLevelWords = nextLevel && nextLevelCount > 0
    ? await fetchWordsAtLevel(userId, nextLevel, nextLevelCount)
    : [];

  // 5. Merge and return
  return [...currentLevelWords, ...nextLevelWords];
}

/*
 * Check if user should be auto-advanced to next level
 */
async function checkAndAdvanceLevel(
  userId: number,
  currentLevel: string
): Promise<{ advanced: boolean; newLevel?: string; mastery?: number }> {
  const mastery = await calculateLevelMastery(userId, currentLevel);

  // Automatic advancement at threshold
  if (mastery >= LEARNING_CONFIG.AUTO_ADVANCE_THRESHOLD) {
    const nextLevel = getNextLevel(currentLevel);

    if (nextLevel) {
      // Update user level and reset mastery
      await sql`
        UPDATE users
        SET current_level = ${nextLevel},
            current_level_mastery_percentage = 0
        WHERE id = ${userId}
      `;

      return { advanced: true, newLevel: nextLevel, mastery };
    }
  }

  return { advanced: false, mastery };
}

/*
 * Get new words for user at their level (uses progressive selection)
 */
async function getNewWordsForUser(userId: number, level: string, count: number = 5) {
  // Use progressive word selection (mixed levels based on mastery)
  return getProgressiveWords(userId, level, count);
}

/*
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

/*
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

    // Check for auto-advancement
    const advancementResult = await checkAndAdvanceLevel(userId, user.current_level);

    if (advancementResult.advanced) {
      // User has been auto-advanced!
      const message = `
🎉 *Поздравляем!*

Вы освоили *${advancementResult.mastery}%* уровня *${user.current_level}*!

🚀 *Вы автоматически переведены на уровень ${advancementResult.newLevel}!*

Продолжайте в том же духе! Теперь вы будете изучать слова уровня ${advancementResult.newLevel}.
`;

      await ctx.editMessageText(message, {
        reply_markup: new InlineKeyboard()
          .text('📖 Начать изучение', 'daily_words')
          .row()
          .text('📊 Мой прогресс', 'progress')
          .text('📚 Главное меню', 'main_menu'),
        parse_mode: 'Markdown',
      });

      logger.info(`User ${userId} auto-advanced from ${user.current_level} to ${advancementResult.newLevel}`);
      return;
    }

    // Get current mastery for progress display
    const currentMastery = advancementResult.mastery || 0;

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

      let message = `🎉 Отлично! Вы уже изучили все доступные слова уровня *${user.current_level}*!\n\n`;

      if (masteredPercentage >= 70 && hasNextLevel) {
        message += `💪 Вы освоили *${masteredPercentage}%* слов этого уровня!\n\n`;
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
      const levelBadge = word.cefr_level !== user.current_level ? ` [${word.cefr_level}]` : '';
      return `*${index + 1}.*\n*${word.hebrew_word}*${levelBadge}\n💭 ${word.russian_translation}\n📖 ${word.example_sentence_hebrew}\n   _${word.example_sentence_russian}_`;
    }).join('\n\n');

    // Build mastery progress info
    const masteryBar = '█'.repeat(Math.floor(currentMastery / 10)) + '░'.repeat(10 - Math.floor(currentMastery / 10));
    const nextLevel = getNextLevel(user.current_level);
    const showNextLevelPreview = currentMastery >= LEARNING_CONFIG.PREVIEW_THRESHOLD && nextLevel;

    let progressInfo = `📊 Прогресс уровня ${user.current_level}: ${currentMastery}%\n[${masteryBar}]\n`;
    if (showNextLevelPreview) {
      progressInfo += `\n🔓 *Открыт предпросмотр уровня ${nextLevel}!*\n`;
    }
    if (currentMastery >= LEARNING_CONFIG.ADVANCED_THRESHOLD) {
      progressInfo += `\n🎯 *Скоро повышение!* Ещё немного и вы перейдёте на ${nextLevel}!\n`;
    }

    const messageText = `
📚 *Новые слова для изучения* (Уровень: ${user.current_level})

${progressInfo}
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
