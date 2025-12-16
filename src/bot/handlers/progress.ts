/*
 * Progress Handler
 *
 * Display user's learning progress and statistics
 */

import { Composer, InlineKeyboard } from 'grammy';
import type { BotContext } from '../../types/bot.js';
import { getUserById } from '../../services/database/models/user.js';
import { sql } from '../../services/database/client.js';
import { logger } from '../../utils/logger.js';
import { calculateLevelMastery, getNextLevel } from './daily-words.js';
import { LEARNING_CONFIG } from '../../utils/config.js';

export const progressHandler = new Composer<BotContext>();

/*
 * Progress callback - show user statistics
 */
progressHandler.callbackQuery('progress', async (ctx) => {
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

    // Get word statistics
    const wordStats = await sql`
      SELECT
        status,
        COUNT(*) as count
      FROM user_vocabulary
      WHERE user_id = ${userId}
      GROUP BY status
    `;

    const statsMap: Record<string, number> = {};
    wordStats.forEach(row => {
      statsMap[row.status] = parseInt(row.count as string);
    });

    const learning = statsMap['learning'] || 0;
    const reviewing = statsMap['reviewing'] || 0;
    const mastered = statsMap['mastered'] || 0;
    const totalWords = learning + reviewing + mastered;

    // Get exercise statistics
    const exerciseStats = await sql`
      SELECT
        exercise_type,
        COUNT(*) as total,
        SUM(CASE WHEN correct THEN 1 ELSE 0 END) as correct_count
      FROM exercise_results
      WHERE user_id = ${userId}
      GROUP BY exercise_type
    `;

    let totalExercises = 0;
    let totalCorrect = 0;
    const exerciseBreakdown: string[] = [];

    exerciseStats.forEach(row => {
      const total = parseInt(row.total as string);
      const correct = parseInt(row.correct_count as string);
      totalExercises += total;
      totalCorrect += correct;

      const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
      const typeName = row.exercise_type === 'mcq_he_ru' ? 'Иврит→Русский' :
                       row.exercise_type === 'mcq_ru_he' ? 'Русский→Иврит' :
                       'Флэшкарты';

      exerciseBreakdown.push(`  • ${typeName}: ${correct}/${total} (${percentage}%)`);
    });

    const overallAccuracy = totalExercises > 0 ? Math.round((totalCorrect / totalExercises) * 100) : 0;

    // Get recent activity (last 7 days)
    const recentActivity = await sql`
      SELECT
        DATE(attempt_time) as date,
        COUNT(*) as count
      FROM exercise_results
      WHERE user_id = ${userId}
        AND attempt_time >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(attempt_time)
      ORDER BY date DESC
      LIMIT 7
    `;

    const activeDays = recentActivity.length;
    const recentExercises = recentActivity.reduce((sum, row) => sum + parseInt(row.count as string), 0);

    // Calculate current level mastery
    const masteryPercentage = await calculateLevelMastery(userId, user.current_level);
    const masteryBar = '█'.repeat(Math.floor(masteryPercentage / 10)) + '░'.repeat(10 - Math.floor(masteryPercentage / 10));
    const nextLevel = getNextLevel(user.current_level);

    // Build mastery info
    let masteryInfo = `*Освоение уровня ${user.current_level}:* ${masteryPercentage}%\n[${masteryBar}]\n`;
    if (masteryPercentage >= LEARNING_CONFIG.PREVIEW_THRESHOLD && nextLevel) {
      masteryInfo += `\n🔓 *Открыт предпросмотр уровня ${nextLevel}!*\n`;
    }
    if (masteryPercentage >= LEARNING_CONFIG.ADVANCED_THRESHOLD && nextLevel) {
      masteryInfo += `🎯 *Скоро повышение до ${nextLevel}!*\n`;
    }
    if (masteryPercentage >= LEARNING_CONFIG.AUTO_ADVANCE_THRESHOLD && nextLevel) {
      masteryInfo += `✨ *Готовы к ${nextLevel}!* Автоматическое повышение при следующем изучении слов.\n`;
    }

    // Build progress message
    const progressText = `
📊 *Ваш прогресс*

*Текущий уровень:* ${user.current_level}
${masteryInfo}

━━━━━━━━━━━━━━━━
*📚 Словарный запас* (${totalWords} слов)

🟡 Изучаю: ${learning}
🔵 Повторяю: ${reviewing}
🟢 Освоил(а): ${mastered}

${totalWords > 0 ? `📈 Прогресс: ${Math.round((mastered / totalWords) * 100)}% освоено` : ''}

━━━━━━━━━━━━━━━━
*✏️ Упражнения* (${totalExercises} попыток)

Точность: *${overallAccuracy}%*

${exerciseBreakdown.length > 0 ? exerciseBreakdown.join('\n') : '  _Пока нет данных_'}

━━━━━━━━━━━━━━━━
*📅 Активность (7 дней)*

• Активных дней: ${activeDays}
• Всего упражнений: ${recentExercises}
${activeDays > 0 ? `• В среднем: ${Math.round(recentExercises / activeDays)} в день` : ''}

${totalWords === 0 ? '\n💡 _Начните с изучения новых слов!_' : ''}
${totalWords > 0 && totalExercises === 0 ? '\n💡 _Попробуйте упражнения для закрепления!_' : ''}
`;

    const keyboard = new InlineKeyboard()
      .text('📚 Новые слова', 'daily_words')
      .text('✏️ Упражнения', 'exercises')
      .row()
      .text('🎯 Пройти тест заново', 'retake_assessment')
      .row()
      .text('📚 Главное меню', 'main_menu');

    await ctx.editMessageText(progressText, {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    });

    logger.info(`Displayed progress for user ${userId}`);

  } catch (error: any) {
    logger.error('Error in progress handler:', error);
    await ctx.editMessageText(
      'Произошла ошибка. Пожалуйста, попробуйте позже.',
      { parse_mode: 'Markdown' }
    );
  }
});
