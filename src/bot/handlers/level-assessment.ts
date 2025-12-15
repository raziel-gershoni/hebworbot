/**
 * Level Assessment Handler
 *
 * Handle Hebrew proficiency level assessment flow
 */

import { Composer, InlineKeyboard } from 'grammy';
import type { BotContext } from '../../types/bot.js';
import { generateAssessmentQuestions, analyzeAssessmentResults } from '../../services/gemini/assessment.js';
import { updateUserAssessment, getUserById } from '../../services/database/models/user.js';
import { sql } from '../../services/database/client.js';
import { createMainMenuKeyboard, MAIN_MENU_TEXT } from '../keyboards/main-menu.js';
import { logger } from '../../utils/logger.js';

export const assessmentHandler = new Composer<BotContext>();

/**
 * Start assessment callback
 */
assessmentHandler.callbackQuery('start_assessment', async (ctx) => {
  await ctx.answerCallbackQuery();

  if (!ctx.from) return;

  const userId = ctx.from.id;

  try {
    await ctx.editMessageText(
      '⏳ Генерирую вопросы для оценки уровня...\n\nЭто займёт несколько секунд.',
      { parse_mode: 'Markdown' }
    );

    // Get user to check premium status
    const user = await getUserById(userId);
    const isPremium = user?.is_premium || false;

    // Generate questions with Gemini
    const assessment = await generateAssessmentQuestions(isPremium);

    // Store assessment in database
    await sql`
      INSERT INTO conversation_state (user_id, conversation_key, state_data)
      VALUES (
        ${userId},
        'assessment',
        ${JSON.stringify({
          questions: assessment.questions,
          answers: [],
          currentIndex: 0,
        })}
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        conversation_key = 'assessment',
        state_data = ${JSON.stringify({
          questions: assessment.questions,
          answers: [],
          currentIndex: 0,
        })},
        updated_at = NOW()
    `;

    // Show first question
    await showAssessmentQuestion(ctx, userId, 0);
  } catch (error: any) {
    logger.error('Error starting assessment:', error);
    await ctx.editMessageText(
      '❌ Произошла ошибка при генерации вопросов. Пожалуйста, попробуйте позже.'
    );
  }
});

/**
 * Shuffle array and return shuffled array with mapping
 */
function shuffleOptions(options: string[], correctIndex: number): { shuffled: string[], newCorrectIndex: number } {
  const indices = options.map((_, i) => i);

  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const shuffled = indices.map(i => options[i]);
  const newCorrectIndex = indices.indexOf(correctIndex);

  return { shuffled, newCorrectIndex };
}

/**
 * Show a specific assessment question
 */
async function showAssessmentQuestion(ctx: BotContext, userId: number, questionIndex: number) {
  // Get assessment state
  const stateResult = await sql`
    SELECT state_data FROM conversation_state
    WHERE user_id = ${userId} AND conversation_key = 'assessment'
  `;

  if (stateResult.length === 0) {
    await ctx.reply('Ошибка: не найдено состояние теста. Начните заново с /start');
    return;
  }

  const state = stateResult[0].state_data as any;
  const question = state.questions[questionIndex];

  if (!question) {
    // All questions answered, analyze results
    await analyzeAndShowResults(ctx, userId, state);
    return;
  }

  // Shuffle options for this question
  const { shuffled, newCorrectIndex } = shuffleOptions(question.options, question.correctIndex);

  // Store shuffled state for answer validation
  if (!state.shuffledQuestions) {
    state.shuffledQuestions = {};
  }
  state.shuffledQuestions[questionIndex] = {
    options: shuffled,
    correctIndex: newCorrectIndex
  };

  // Update state in database
  await sql`
    UPDATE conversation_state
    SET state_data = ${JSON.stringify(state)},
        updated_at = NOW()
    WHERE user_id = ${userId} AND conversation_key = 'assessment'
  `;

  // Create keyboard with shuffled answer options
  const keyboard = new InlineKeyboard();

  shuffled.forEach((option: string, index: number) => {
    keyboard.text(option, `answer_${questionIndex}_${index}`).row();
  });

  const questionText = `
**Вопрос ${questionIndex + 1} из ${state.questions.length}**

${question.russian}

**${question.hebrew}**
`;

  if (ctx.callbackQuery) {
    await ctx.editMessageText(questionText, {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    });
  } else {
    await ctx.reply(questionText, {
      reply_markup: keyboard,
      parse_mode: 'Markdown',
    });
  }
}

/**
 * Handle answer callback
 */
assessmentHandler.callbackQuery(/^answer_(\d+)_(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();

  if (!ctx.from) return;

  const userId = ctx.from.id;
  const match = ctx.callbackQuery.data.match(/^answer_(\d+)_(\d+)$/);

  if (!match) return;

  const questionIndex = parseInt(match[1]);
  const answerIndex = parseInt(match[2]);

  try {
    // Get current state
    const stateResult = await sql`
      SELECT state_data FROM conversation_state
      WHERE user_id = ${userId} AND conversation_key = 'assessment'
    `;

    if (stateResult.length === 0) {
      await ctx.editMessageText('Ошибка: состояние теста не найдено. Начните заново с /start');
      return;
    }

    const state = stateResult[0].state_data as any;
    const question = state.questions[questionIndex];
    const shuffledQuestion = state.shuffledQuestions?.[questionIndex];

    let isCorrect: boolean;
    let originalAnswerIndex: number;

    if (shuffledQuestion) {
      // User selected from shuffled options
      // Check if correct using shuffled index
      isCorrect = answerIndex === shuffledQuestion.correctIndex;

      // Map shuffled answer back to original index for analysis
      const selectedOption = shuffledQuestion.options[answerIndex];
      originalAnswerIndex = question.options.indexOf(selectedOption);
    } else {
      // No shuffling (fallback)
      isCorrect = answerIndex === question.correctIndex;
      originalAnswerIndex = answerIndex;
    }

    // Record answer using original index for analysis
    state.answers[questionIndex] = originalAnswerIndex;

    // Update state
    await sql`
      UPDATE conversation_state
      SET state_data = ${JSON.stringify(state)},
          updated_at = NOW()
      WHERE user_id = ${userId} AND conversation_key = 'assessment'
    `;

    // Show brief feedback
    const correctAnswer = shuffledQuestion
      ? shuffledQuestion.options[shuffledQuestion.correctIndex]
      : question.options[question.correctIndex];

    const feedback = isCorrect
      ? '✅ Правильно!'
      : `❌ Неправильно. Правильный ответ: ${correctAnswer}`;

    await ctx.answerCallbackQuery({ text: feedback, show_alert: false });

    // Move to next question
    await showAssessmentQuestion(ctx, userId, questionIndex + 1);
  } catch (error: any) {
    logger.error('Error handling assessment answer:', error);
    await ctx.editMessageText('Произошла ошибка. Пожалуйста, начните тест заново.');
  }
});

/**
 * Analyze results and show to user
 */
async function analyzeAndShowResults(ctx: BotContext, userId: number, state: any) {
  try {
    await ctx.editMessageText(
      '⏳ Анализирую ваши ответы...\n\nЭто займёт несколько секунд.',
      { parse_mode: 'Markdown' }
    );

    // Get user to check premium status
    const user = await getUserById(userId);
    const isPremium = user?.is_premium || false;

    // Analyze with Gemini
    const analysis = await analyzeAssessmentResults(
      state.questions,
      state.answers,
      isPremium
    );

    // Update user level in database
    await updateUserAssessment(userId, analysis.level);

    // Clear assessment state
    await sql`
      DELETE FROM conversation_state
      WHERE user_id = ${userId} AND conversation_key = 'assessment'
    `;

    // Show results
    const resultText = `
🎉 **Тест завершён!**

**Ваш уровень: ${analysis.level}**

**Обоснование:**
${analysis.reasoning}

**Ваши сильные стороны:**
${analysis.strengths.map(s => `• ${s}`).join('\n')}

**Рекомендации:**
${analysis.recommendations.map(r => `• ${r}`).join('\n')}

Теперь вы можете начать изучение слов на вашем уровне!
`;

    await ctx.editMessageText(resultText, {
      reply_markup: createMainMenuKeyboard(),
      parse_mode: 'Markdown',
    });

    logger.info(`User ${userId} completed assessment with level: ${analysis.level}`);
  } catch (error: any) {
    logger.error('Error analyzing assessment results:', error);
    await ctx.editMessageText(
      '❌ Произошла ошибка при анализе результатов. Пожалуйста, попробуйте позже.'
    );
  }
}
