/**
 * Exercises Handler
 *
 * Interactive exercises for vocabulary practice
 * - Multiple Choice: Hebrew → Russian
 * - Multiple Choice: Russian → Hebrew
 * - Flashcard Review
 */

import { Composer, InlineKeyboard } from 'grammy';
import type { BotContext } from '../../types/bot.js';
import { getUserById } from '../../services/database/models/user.js';
import { sql } from '../../services/database/client.js';
import { logger } from '../../utils/logger.js';

export const exercisesHandler = new Composer<BotContext>();

const EXERCISE_SET_SIZE = 5; // Number of questions per exercise session

/**
 * Get words for exercises (words user is currently learning)
 */
async function getWordsForExercise(userId: number, level: string, count: number = EXERCISE_SET_SIZE) {
  const words = await sql`
    SELECT v.*, uv.status, uv.review_count
    FROM vocabulary v
    JOIN user_vocabulary uv ON v.id = uv.vocabulary_id
    WHERE uv.user_id = ${userId}
      AND v.cefr_level = ${level}
      AND uv.status IN ('learning', 'reviewing')
    ORDER BY uv.review_count ASC, RANDOM()
    LIMIT ${count}
  `;

  return words;
}

/**
 * Get distractor options (wrong answers) for multiple choice
 */
async function getDistractors(correctWord: any, language: 'hebrew' | 'russian', count: number = 3) {
  let distractors;

  if (language === 'hebrew') {
    distractors = await sql`
      SELECT hebrew_word as option
      FROM vocabulary
      WHERE cefr_level = ${correctWord.cefr_level}
        AND id != ${correctWord.id}
      ORDER BY RANDOM()
      LIMIT ${count}
    `;
  } else {
    distractors = await sql`
      SELECT russian_translation as option
      FROM vocabulary
      WHERE cefr_level = ${correctWord.cefr_level}
        AND id != ${correctWord.id}
      ORDER BY RANDOM()
      LIMIT ${count}
    `;
  }

  return distractors.map(d => d.option);
}

/**
 * Shuffle array
 */
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Record exercise result
 */
async function recordExerciseResult(
  userId: number,
  vocabularyId: number,
  exerciseType: string,
  correct: boolean,
  responseTimeMs: number
) {
  await sql`
    INSERT INTO exercise_results (
      user_id,
      vocabulary_id,
      exercise_type,
      correct,
      attempt_time,
      response_time_ms
    )
    VALUES (
      ${userId},
      ${vocabularyId},
      ${exerciseType},
      ${correct},
      NOW(),
      ${responseTimeMs}
    )
  `;

  // Update word status based on performance
  if (correct) {
    await sql`
      UPDATE user_vocabulary
      SET review_count = review_count + 1
      WHERE user_id = ${userId} AND vocabulary_id = ${vocabularyId}
    `;

    // Check if word should be promoted
    const result = await sql`
      SELECT review_count, status FROM user_vocabulary
      WHERE user_id = ${userId} AND vocabulary_id = ${vocabularyId}
    `;

    if (result.length > 0) {
      const { review_count, status } = result[0];

      // Promote: learning (3 correct) → reviewing (5 correct) → mastered
      if (status === 'learning' && review_count >= 3) {
        await sql`
          UPDATE user_vocabulary
          SET status = 'reviewing'
          WHERE user_id = ${userId} AND vocabulary_id = ${vocabularyId}
        `;
      } else if (status === 'reviewing' && review_count >= 8) {
        await sql`
          UPDATE user_vocabulary
          SET status = 'mastered', mastered_at = NOW()
          WHERE user_id = ${userId} AND vocabulary_id = ${vocabularyId}
        `;
      }
    }
  }
}

/**
 * Exercise type selection
 */
exercisesHandler.callbackQuery(['start_exercises', 'exercises'], async (ctx) => {
  await ctx.answerCallbackQuery();

  if (!ctx.from) return;

  const keyboard = new InlineKeyboard()
    .text('🔤 Иврит → Русский', 'exercise_he_ru')
    .row()
    .text('🔤 Русский → Иврит', 'exercise_ru_he')
    .row()
    .text('🎴 Флэшкарты', 'exercise_flashcards')
    .row()
    .text('📚 Главное меню', 'main_menu');

  await ctx.editMessageText(
    `✏️ **Упражнения**\n\nВыберите тип упражнения:\n\n🔤 **Иврит → Русский** - угадайте перевод с иврита на русский\n🔤 **Русский → Иврит** - угадайте перевод с русского на иврит\n🎴 **Флэшкарты** - быстрое повторение с самопроверкой`,
    {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    }
  );
});

/**
 * Start Hebrew → Russian exercise
 */
exercisesHandler.callbackQuery('exercise_he_ru', async (ctx) => {
  await ctx.answerCallbackQuery();

  if (!ctx.from) return;
  const userId = ctx.from.id;

  try {
    const user = await getUserById(userId);
    if (!user || !user.current_level) {
      await ctx.editMessageText('Сначала пройдите тест. Используйте /start');
      return;
    }

    const words = await getWordsForExercise(userId, user.current_level);

    if (words.length === 0) {
      await ctx.editMessageText(
        'У вас нет слов для упражнений. Сначала изучите новые слова!',
        {
          reply_markup: new InlineKeyboard()
            .text('📚 Новые слова', 'daily_words')
            .text('📚 Меню', 'main_menu'),
        }
      );
      return;
    }

    // Store exercise state
    await sql`
      INSERT INTO conversation_state (user_id, conversation_key, state_data)
      VALUES (
        ${userId},
        'exercise_he_ru',
        ${JSON.stringify({
          words: words.map(w => ({ id: w.id, hebrew_word: w.hebrew_word, russian_translation: w.russian_translation, cefr_level: w.cefr_level })),
          currentIndex: 0,
          correctCount: 0,
          startTime: Date.now(),
        })}
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        conversation_key = 'exercise_he_ru',
        state_data = ${JSON.stringify({
          words: words.map(w => ({ id: w.id, hebrew_word: w.hebrew_word, russian_translation: w.russian_translation, cefr_level: w.cefr_level })),
          currentIndex: 0,
          correctCount: 0,
          startTime: Date.now(),
        })},
        updated_at = NOW()
    `;

    await showHebrewToRussianQuestion(ctx, userId, 0);

  } catch (error: any) {
    logger.error('Error starting he_ru exercise:', error);
    await ctx.editMessageText('Ошибка. Попробуйте позже.');
  }
});

/**
 * Show Hebrew → Russian question
 */
async function showHebrewToRussianQuestion(ctx: BotContext, userId: number, questionIndex: number) {
  const stateResult = await sql`
    SELECT state_data FROM conversation_state
    WHERE user_id = ${userId} AND conversation_key = 'exercise_he_ru'
  `;

  if (stateResult.length === 0) {
    await ctx.editMessageText('Ошибка: состояние не найдено. Начните заново.');
    return;
  }

  const state = stateResult[0].state_data as any;
  const word = state.words[questionIndex];

  if (!word) {
    // Exercise complete
    await showExerciseResults(ctx, userId, state, 'exercise_he_ru');
    return;
  }

  // Get distractors
  const distractors = await getDistractors(word, 'russian');
  const options = shuffle([word.russian_translation, ...distractors]);
  const correctIndex = options.indexOf(word.russian_translation);

  // Store question state
  state.currentQuestion = {
    correctIndex,
    options,
    questionTime: Date.now(),
  };

  await sql`
    UPDATE conversation_state
    SET state_data = ${JSON.stringify(state)}, updated_at = NOW()
    WHERE user_id = ${userId} AND conversation_key = 'exercise_he_ru'
  `;

  // Create keyboard
  const keyboard = new InlineKeyboard();
  options.forEach((option, index) => {
    keyboard.text(`${index + 1}`, `heру_answer_${questionIndex}_${index}`);
    if (index % 2 === 1) keyboard.row();
  });

  const optionsText = options.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n');

  await ctx.editMessageText(
    `🔤 **Иврит → Русский** (${questionIndex + 1}/${state.words.length})\n\nЧто означает:\n\n**${word.hebrew_word}**\n\n${optionsText}`,
    {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    }
  );
}

/**
 * Handle Hebrew → Russian answer
 */
exercisesHandler.callbackQuery(/^heру_answer_(\d+)_(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();

  if (!ctx.from) return;
  const userId = ctx.from.id;

  const match = ctx.callbackQuery.data.match(/^heру_answer_(\d+)_(\d+)$/);
  if (!match) return;

  const questionIndex = parseInt(match[1]);
  const answerIndex = parseInt(match[2]);

  try {
    const stateResult = await sql`
      SELECT state_data FROM conversation_state
      WHERE user_id = ${userId} AND conversation_key = 'exercise_he_ru'
    `;

    if (stateResult.length === 0) return;

    const state = stateResult[0].state_data as any;
    const word = state.words[questionIndex];
    const isCorrect = answerIndex === state.currentQuestion.correctIndex;
    const responseTime = Date.now() - state.currentQuestion.questionTime;

    // Record result
    await recordExerciseResult(userId, word.id, 'mcq_he_ru', isCorrect, responseTime);

    if (isCorrect) {
      state.correctCount++;
    }

    state.currentIndex = questionIndex + 1;

    await sql`
      UPDATE conversation_state
      SET state_data = ${JSON.stringify(state)}, updated_at = NOW()
      WHERE user_id = ${userId} AND conversation_key = 'exercise_he_ru'
    `;

    // Show feedback
    const feedback = isCorrect
      ? '✅ Правильно!'
      : `❌ Неправильно. Правильный ответ: ${word.russian_translation}`;

    await ctx.answerCallbackQuery({ text: feedback });

    // Next question
    await showHebrewToRussianQuestion(ctx, userId, questionIndex + 1);

  } catch (error: any) {
    logger.error('Error handling he_ru answer:', error);
  }
});

/**
 * Show exercise results
 */
async function showExerciseResults(ctx: BotContext, userId: number, state: any, exerciseType: string) {
  const { correctCount, words, startTime } = state;
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  const percentage = Math.round((correctCount / words.length) * 100);

  let emoji = '🎉';
  let message = 'Отлично!';

  if (percentage < 50) {
    emoji = '💪';
    message = 'Продолжайте практиковаться!';
  } else if (percentage < 80) {
    emoji = '👍';
    message = 'Хорошо!';
  }

  await sql`
    DELETE FROM conversation_state
    WHERE user_id = ${userId} AND conversation_key = ${exerciseType}
  `;

  const keyboard = new InlineKeyboard()
    .text('🔄 Ещё раз', exerciseType === 'exercise_he_ru' ? 'exercise_he_ru' : 'exercise_ru_he')
    .row()
    .text('✏️ Другое упражнение', 'exercises')
    .text('📚 Меню', 'main_menu');

  await ctx.editMessageText(
    `${emoji} **Упражнение завершено!**\n\n${message}\n\n📊 **Результаты:**\n• Правильных ответов: ${correctCount}/${words.length} (${percentage}%)\n• Время: ${totalTime}с\n\nПродолжайте учиться!`,
    {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    }
  );
}
