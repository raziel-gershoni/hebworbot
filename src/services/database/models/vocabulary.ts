/**
 * Vocabulary Model - CRUD operations for Hebrew-Russian word pairs
 */

import { sql } from '../client.js';

export interface VocabularyWord {
  id: number;
  hebrew_word: string;
  russian_translation: string;
  frequency_rank: number;
  cefr_level: string;
  part_of_speech?: string;
  example_sentence_hebrew?: string;
  example_sentence_russian?: string;
  created_at: Date;
}

export type NewVocabularyWord = Omit<VocabularyWord, 'id' | 'created_at'>;

/**
 * Create a new vocabulary word
 */
export async function createVocabularyWord(word: NewVocabularyWord): Promise<VocabularyWord> {
  const result = await sql`
    INSERT INTO vocabulary (
      hebrew_word,
      russian_translation,
      frequency_rank,
      cefr_level,
      part_of_speech,
      example_sentence_hebrew,
      example_sentence_russian
    ) VALUES (
      ${word.hebrew_word},
      ${word.russian_translation},
      ${word.frequency_rank},
      ${word.cefr_level},
      ${word.part_of_speech || null},
      ${word.example_sentence_hebrew || null},
      ${word.example_sentence_russian || null}
    )
    ON CONFLICT (hebrew_word) DO NOTHING
    RETURNING *
  `;

  return result[0] as VocabularyWord;
}

/**
 * Batch insert vocabulary words (for seeding)
 * Note: Inserts one by one to avoid complex SQL templating issues
 */
export async function batchCreateVocabulary(words: NewVocabularyWord[]): Promise<number> {
  if (words.length === 0) return 0;

  let insertedCount = 0;

  for (const word of words) {
    try {
      await createVocabularyWord(word);
      insertedCount++;
    } catch (error) {
      // Silently skip duplicates
      continue;
    }
  }

  return insertedCount;
}

/**
 * Get words by CEFR level, excluding already learned words for a user
 */
export async function getWordsForUser(
  userId: number | bigint,
  level: string,
  limit: number = 10
): Promise<VocabularyWord[]> {
  const result = await sql`
    SELECT v.*
    FROM vocabulary v
    WHERE v.cefr_level = ${level}
      AND v.id NOT IN (
        SELECT vocabulary_id
        FROM user_vocabulary
        WHERE user_id = ${userId}
      )
    ORDER BY v.frequency_rank ASC
    LIMIT ${limit}
  `;

  return result as VocabularyWord[];
}

/**
 * Get random words from same level (for exercise distractors)
 */
export async function getRandomWordsFromLevel(
  level: string,
  excludeIds: number[],
  limit: number = 3
): Promise<VocabularyWord[]> {
  const result = await sql`
    SELECT *
    FROM vocabulary
    WHERE cefr_level = ${level}
      AND id != ALL(${excludeIds})
    ORDER BY RANDOM()
    LIMIT ${limit}
  `;

  return result as VocabularyWord[];
}

/**
 * Get vocabulary word by ID
 */
export async function getVocabularyById(id: number): Promise<VocabularyWord | null> {
  const result = await sql`
    SELECT * FROM vocabulary WHERE id = ${id}
  `;

  return result.length > 0 ? (result[0] as VocabularyWord) : null;
}

/**
 * Search vocabulary by Hebrew word
 */
export async function searchByHebrewWord(hebrewWord: string): Promise<VocabularyWord | null> {
  const result = await sql`
    SELECT * FROM vocabulary WHERE hebrew_word = ${hebrewWord}
  `;

  return result.length > 0 ? (result[0] as VocabularyWord) : null;
}

/**
 * Get count of words by level
 */
export async function getWordCountByLevel(level: string): Promise<number> {
  const result = await sql`
    SELECT COUNT(*) as count
    FROM vocabulary
    WHERE cefr_level = ${level}
  `;

  return Number(result[0]?.count || 0);
}

/**
 * Get total vocabulary count
 */
export async function getTotalVocabularyCount(): Promise<number> {
  const result = await sql`
    SELECT COUNT(*) as count FROM vocabulary
  `;

  return Number(result[0]?.count || 0);
}
