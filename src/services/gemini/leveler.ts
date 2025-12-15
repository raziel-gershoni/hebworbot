/**
 * Gemini Leveler Service
 *
 * Assign CEFR levels to Hebrew words based on frequency and complexity
 */

import { generateStructured } from './client.js';
import { LevelAssignmentBatchSchema, LevelAssignmentBatch } from './schemas.js';
import { logger } from '../../utils/logger.js';

interface WordWithFrequency {
  hebrew: string;
  frequencyRank: number;
}

/**
 * Assign CEFR levels to a batch of Hebrew words
 */
export async function assignCEFRLevels(
  words: WordWithFrequency[],
  isPremium: boolean = false
): Promise<LevelAssignmentBatch> {
  if (words.length === 0) {
    return { assignments: [] };
  }

  const wordList = words
    .map((w, i) => `${i + 1}. ${w.hebrew} (частотность: ${w.frequencyRank})`)
    .join('\n');

  const prompt = `
Вы - эксперт по методике преподавания иврита для русскоязычных учеников.

Назначьте уровень CEFR (A1, A2, B1, B2, C1, C2) для каждого из следующих слов на иврите, учитывая:

1. **Частотность использования** (чем меньше номер, тем чаще слово используется)
2. **Сложность для русскоязычных учеников** (учитывая отличия грамматики и структуры)
3. **Типичное появление в учебниках** иврита по уровням

**Рекомендации по уровням:**

- **A1** (самые базовые): частотность 1-500
  - Приветствия (שלום, תודה)
  - Числа (אחד, שניים, שלוש)
  - Базовые существительные (בית, משפחה, אוכל)
  - Простые глаголы (להיות, לאכול, ללכת)

- **A2** (базовые): частотность 500-1500
  - Повседневная лексика
  - Простые глаголы действия
  - Распространённые прилагательные

- **B1** (средние): частотность 1500-3500
  - Более сложные глаголы
  - Абстрактные понятия
  - Профессиональная лексика

- **B2** (продвинутые): частотность 3500-6000
  - Идиомы и устойчивые выражения
  - Формальный язык
  - Специализированная лексика

- **C1** (высокие): частотность 6000-10000
  - Сложная лексика
  - Редко используемые слова
  - Литературный язык

- **C2** (профессиональные): частотность 10000+
  - Очень редкие слова
  - Архаизмы
  - Высокоспециализированная терминология

**Слова для классификации:**

${wordList}

Для каждого слова укажите:
1. Само слово
2. Назначенный уровень CEFR
3. Краткое обоснование (почему именно этот уровень)

Отвечайте в формате JSON.
`;

  logger.info(`Assigning CEFR levels to ${words.length} words`);

  const result = await generateStructured(prompt, LevelAssignmentBatchSchema, undefined, isPremium);

  logger.info(`Assigned levels to ${result.assignments.length} words`);

  return result;
}
