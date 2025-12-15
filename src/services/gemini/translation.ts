/**
 * Gemini Translation Service
 *
 * Generate Russian translations for Hebrew words
 */

import { generateStructured } from './client.js';
import { TranslationBatchSchema, TranslationBatch } from './schemas.js';
import { logger } from '../../utils/logger.js';

/**
 * Translate a batch of Hebrew words to Russian
 */
export async function translateHebrewWords(
  hebrewWords: string[],
  isPremium: boolean = false
): Promise<TranslationBatch> {
  if (hebrewWords.length === 0) {
    return { translations: [] };
  }

  const wordList = hebrewWords.map((word, i) => `${i + 1}. ${word}`).join('\n');

  const prompt = `
Вы - эксперт-переводчик иврита на русский язык для изучающих иврит.

Переведите следующие слова на иврите на русский язык. Для каждого слова предоставьте:

1. **Основной перевод** - наиболее распространённое значение слова
2. **Альтернативные переводы** - другие возможные значения (если есть)
3. **Часть речи** - существительное, глагол, прилагательное и т.д.
4. **Пример предложения на иврите** (по возможности, простое предложение)
5. **Перевод примера на русский**

**Слова на иврите:**

${wordList}

**Важно:**
- Переводы должны быть точными и подходящими для изучающих иврит
- Примеры предложений должны быть простыми и естественными
- Если слово многозначное, укажите 2-3 наиболее частых значения в альтернативных переводах

Отвечайте в формате JSON.
`;

  logger.info(`Translating ${hebrewWords.length} Hebrew words`);

  const result = await generateStructured(prompt, TranslationBatchSchema, undefined, isPremium);

  logger.info(`Translated ${result.translations.length} words`);

  return result;
}

/**
 * Translate a single Hebrew word to Russian
 */
export async function translateSingleWord(
  hebrewWord: string,
  isPremium: boolean = false
): Promise<string> {
  const result = await translateHebrewWords([hebrewWord], isPremium);

  if (result.translations.length === 0) {
    throw new Error('Translation failed');
  }

  return result.translations[0].russian;
}
