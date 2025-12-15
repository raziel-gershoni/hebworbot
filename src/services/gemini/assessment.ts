/**
 * Gemini Assessment Service
 *
 * Generate and analyze Hebrew proficiency assessment questions
 */

import { generateStructured } from './client.js';
import {
  AssessmentQuestionsSchema,
  AssessmentQuestions,
  LevelAnalysisSchema,
  LevelAnalysis,
  AssessmentQuestion,
} from './schemas.js';
import { logger } from '../../utils/logger.js';

/**
 * Generate assessment questions to determine user's Hebrew level
 */
export async function generateAssessmentQuestions(
  isPremium: boolean = false
): Promise<AssessmentQuestions> {
  const prompt = `
You are an expert Hebrew language teacher for Russian speakers. Generate 9 multiple-choice assessment questions to determine a learner's Hebrew proficiency level (CEFR: A1-C2).

**Requirements:**
- Questions must be in RUSSIAN (the test-taker is a Russian speaker)
- Hebrew words/phrases should be shown in Hebrew script
- Include questions from different CEFR levels:
  * 2 A1 questions (basic greetings, simple words, numbers)
  * 1 A2 question (simple sentences, common verbs, everyday vocabulary)
  * 2 B1 questions (past tense, compound sentences, abstract concepts)
  * 2 B2 questions (idiomatic expressions, complex grammar, subjunctive)
  * 1 C1 question (advanced idioms, nuanced meanings, literary expressions)
  * 1 C2 question (rare vocabulary, sophisticated constructions, cultural references)

**Question Format:**
- Ask "Что означает на русском языке следующее слово/фраза на иврите: [Hebrew]?" (What does this Hebrew word/phrase mean in Russian?)
- Provide 4 plausible options in Russian (can be detailed for clarity)
- **CRITICAL**: This is a KNOWLEDGE TEST - provide NO hints, explanations, or tips
- Do NOT add ANY explanatory text in parentheses like "(дословно: ...)" or "(буквально: ...)"
- No literal translations, no contextual hints, no grammatical explanations
- Test pure knowledge - user must know the answer, not guess from hints
- Ensure distractors (wrong answers) are realistic but clearly incorrect
- Mark the correct answer index (0-3)

**Examples:**

A1 Question:
Hebrew: שלום
Russian question: "Что означает на русском языке следующее слово на иврите: שלום?"
Options: ["Мир/Привет", "Спасибо", "Пожалуйста", "До свидания"]
Correct: 0

A2 Question:
Hebrew: אני אוהב לקרוא ספרים
Russian question: "Что означает на русском языке следующая фраза на иврите: אני אוהב לקרוא ספרים?"
Options: ["Я люблю читать книги", "Я люблю писать письма", "Я люблю смотреть фильмы", "Я люблю слушать музыку"]
Correct: 0

B2 Idiom Question (CORRECT - no hints):
Hebrew: על קצה המזלג
Russian question: "Что означает на русском языке следующая фраза на иврите: על קצה המזלג?"
Options: ["Вкратце, в двух словах", "С большим трудом", "На скорую руку", "В последний момент"]
Correct: 0

WRONG examples (DO NOT do this - contains hints):
❌ "Вкратце (дословно: на кончике вилки)"  ← No literal translations!
❌ "Мир (приветствие)"  ← No contextual hints!
❌ "Читать (глагол)"  ← No grammatical explanations!

Generate 9 such questions now (2×A1, 1×A2, 2×B1, 2×B2, 1×C1, 1×C2).

Return the response in this exact JSON format:
{
  "questions": [
    {
      "hebrew": "שלום",
      "russian": "Что означает...",
      "options": ["Мир/Привет", "Спасибо", "Пожалуйста", "До свидания"],
      "correctIndex": 0,
      "level": "A1"
    },
    ...
  ]
}
`;

  logger.info('Generating assessment questions with Gemini');

  const result = await generateStructured(prompt, AssessmentQuestionsSchema, undefined, isPremium);

  logger.info(`Generated ${result.questions.length} assessment questions`);

  return result;
}

/**
 * Analyze user's assessment answers and assign a CEFR level
 */
export async function analyzeAssessmentResults(
  questions: AssessmentQuestion[],
  userAnswers: number[],
  isPremium: boolean = false
): Promise<LevelAnalysis> {
  // Build analysis prompt
  const questionAnalysis = questions
    .map((q, i) => {
      const isCorrect = userAnswers[i] === q.correctIndex;
      return `
Вопрос ${i + 1} (Уровень: ${q.level}):
Иврит: ${q.hebrew}
Вопрос: ${q.russian}
Правильный ответ: ${q.options[q.correctIndex]}
Ответ пользователя: ${q.options[userAnswers[i]]}
Результат: ${isCorrect ? 'ПРАВИЛЬНО ✓' : 'НЕПРАВИЛЬНО ✗'}
`;
    })
    .join('\n');

  // Calculate score by level
  const scoresByLevel: Record<string, { correct: number; total: number }> = {};

  questions.forEach((q, i) => {
    if (!scoresByLevel[q.level]) {
      scoresByLevel[q.level] = { correct: 0, total: 0 };
    }

    scoresByLevel[q.level].total++;

    if (userAnswers[i] === q.correctIndex) {
      scoresByLevel[q.level].correct++;
    }
  });

  const levelScores = Object.entries(scoresByLevel)
    .map(([level, { correct, total }]) => `${level}: ${correct}/${total} правильно`)
    .join(', ');

  const prompt = `
Вы - эксперт по оценке уровня владения ивритом для русскоязычных учеников.

Проанализируйте результаты теста и определите уровень владения ивритом по шкале CEFR (A1, A2, B1, B2, C1, C2).

**Результаты теста:**

${questionAnalysis}

**Итоги по уровням:**
${levelScores}

**Правила определения уровня:**

1. **A1** - Ученик правильно ответил на большинство вопросов A1, но затрудняется с A2
2. **A2** - Ученик уверенно отвечает на A1, правильно отвечает на большинство A2, но затрудняется с B1
3. **B1** - Ученик уверенно отвечает на A1-A2, правильно отвечает на большинство B1
4. **B2** - Ученик уверенно отвечает на A1-B1, правильно отвечает на B2
5. **C1-C2** - Ученик отвечает правильно на все или почти все вопросы

**Определите:**
1. Назначенный уровень (A1-C2)
2. Обоснование (почему именно этот уровень)
3. Сильные стороны ученика (2-3 пункта на русском языке)
4. Рекомендации для изучения (2-3 пункта на русском языке)

Отвечайте на РУССКОМ языке.

Return the response in this exact JSON format:
{
  "level": "A2",
  "reasoning": "Объяснение...",
  "strengths": ["Сильная сторона 1", "Сильная сторона 2"],
  "recommendations": ["Рекомендация 1", "Рекомендация 2"]
}
`;

  logger.info('Analyzing assessment results with Gemini');

  const result = await generateStructured(prompt, LevelAnalysisSchema, undefined, isPremium);

  logger.info(`Assigned level: ${result.level}`);

  return result;
}
