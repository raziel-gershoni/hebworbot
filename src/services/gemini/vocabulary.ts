/**
 * Gemini Vocabulary Service
 *
 * Translate Hebrew words to Russian and assign CEFR levels
 */

import { generateStructured } from './client.js';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';

/**
 * Schema for vocabulary translation result
 */
export const VocabularyItemSchema = z.object({
  hebrew_word: z.string(),
  russian_translation: z.string(),
  cefr_level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  part_of_speech: z.string(),
  example_sentence_hebrew: z.string(),
  example_sentence_russian: z.string(),
});

export const VocabularyBatchSchema = z.object({
  vocabulary: z.array(VocabularyItemSchema),
});

export type VocabularyItem = z.infer<typeof VocabularyItemSchema>;
export type VocabularyBatch = z.infer<typeof VocabularyBatchSchema>;

/**
 * Process a batch of Hebrew words with Gemini
 */
export async function translateAndLevelWords(
  hebrewWords: string[],
  isPremium: boolean = false
): Promise<VocabularyItem[]> {
  const wordsList = hebrewWords.map((w, i) => `${i + 1}. ${w}`).join('\n');

  const prompt = `
You are an expert Hebrew-Russian language teacher. Translate the following Hebrew words to Russian and assign CEFR proficiency levels (A1-C2).

**Hebrew words to translate:**
${wordsList}

**For each word, provide:**
1. **Hebrew word** (as given)
2. **Russian translation** (the most common meaning)
3. **CEFR level** (A1, A2, B1, B2, C1, C2) based on:
   - Word frequency and commonality
   - Complexity for Russian speakers learning Hebrew
   - Typical textbook/course appearance level
4. **Part of speech** (noun, verb, adjective, pronoun, adverb, etc.)
5. **Example sentence in Hebrew** (simple, natural usage)
6. **Example sentence in Russian** (translation of the Hebrew example)

**CEFR Level Guidelines:**
- **A1**: Basic greetings, pronouns, common nouns (hello, yes, no, I, you, house, water)
- **A2**: Common verbs, everyday vocabulary (love, want, work, study, family, food)
- **B1**: More complex vocabulary, abstract concepts (time, place, people, thing, government)
- **B2**: Advanced vocabulary, professional terms (politics, economy, culture, technology)
- **C1**: Sophisticated vocabulary, literary terms (philosophy, abstract concepts)
- **C2**: Rare, specialized vocabulary (academic, literary, technical jargon)

**CRITICAL RULES FOR CEFR LEVEL:**
- YOU MUST assign EXACTLY ONE of these levels: A1, A2, B1, B2, C1, or C2
- NEVER use "N/A", "Unknown", "uncertain", or any other value
- If unsure about a rare word, assign C2 (advanced/specialized)
- If the word is a particle, preposition, or function word, assign based on usage frequency:
  * Very common (ב, ל, של, את) → A1
  * Common function words → A2
  * Less common → B1
- ALWAYS make your best judgment - every word must have a valid CEFR level

**IMPORTANT**:
- Provide accurate, commonly-used Russian translations
- Keep example sentences natural and simple
- Be consistent with CEFR level assignments
- Remember: EVERY word MUST have a valid CEFR level (A1, A2, B1, B2, C1, or C2)

Return the response in this exact JSON format:
{
  "vocabulary": [
    {
      "hebrew_word": "שלום",
      "russian_translation": "Привет, Мир, Шалом",
      "cefr_level": "A1",
      "part_of_speech": "существительное",
      "example_sentence_hebrew": "שלום, מה שלומך?",
      "example_sentence_russian": "Привет, как дела?"
    },
    ...
  ]
}
`;

  logger.info(`Translating ${hebrewWords.length} Hebrew words with Gemini`);

  const result = await generateStructured(prompt, VocabularyBatchSchema, undefined, isPremium);

  logger.info(`Successfully translated ${result.vocabulary.length} words`);

  return result.vocabulary;
}
