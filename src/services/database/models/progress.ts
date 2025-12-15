/**
 * Progress Model - Track user learning progress and exercise results
 */

import { sql } from '../client.js';

export interface UserVocabulary {
  id: number;
  user_id: bigint;
  vocabulary_id: number;
  status: 'learning' | 'reviewing' | 'mastered';
  first_seen_at: Date;
  mastered_at?: Date;
  review_count: number;
}

export interface ExerciseResult {
  id: number;
  user_id: bigint;
  vocabulary_id: number;
  exercise_type: 'mcq_he_ru' | 'mcq_ru_he' | 'flashcard';
  correct: boolean;
  attempt_time: Date;
  response_time_ms?: number;
}

/**
 * Mark words as being learned by user
 */
export async function markWordsAsLearning(
  userId: number | bigint,
  vocabularyIds: number[]
): Promise<void> {
  if (vocabularyIds.length === 0) return;

  await sql`
    INSERT INTO user_vocabulary (user_id, vocabulary_id, status)
    SELECT ${userId}, id, 'learning'
    FROM UNNEST(${vocabularyIds}::int[]) as id
    ON CONFLICT (user_id, vocabulary_id) DO NOTHING
  `;
}

/**
 * Get user's learning words (not yet mastered)
 */
export async function getUserLearningWords(
  userId: number | bigint,
  status?: 'learning' | 'reviewing' | 'mastered',
  limit: number = 10
): Promise<Array<UserVocabulary & { hebrew_word: string; russian_translation: string }>> {
  const statusFilter = status ? sql`AND uv.status = ${status}` : sql``;

  const result = await sql`
    SELECT uv.*, v.hebrew_word, v.russian_translation, v.cefr_level
    FROM user_vocabulary uv
    JOIN vocabulary v ON uv.vocabulary_id = v.id
    WHERE uv.user_id = ${userId}
      ${statusFilter}
    ORDER BY uv.first_seen_at DESC
    LIMIT ${limit}
  `;

  return result as any[];
}

/**
 * Record exercise result
 */
export async function recordExerciseResult(
  userId: number | bigint,
  vocabularyId: number,
  exerciseType: ExerciseResult['exercise_type'],
  correct: boolean,
  responseTimeMs?: number
): Promise<ExerciseResult> {
  const result = await sql`
    INSERT INTO exercise_results (
      user_id,
      vocabulary_id,
      exercise_type,
      correct,
      response_time_ms
    ) VALUES (
      ${userId},
      ${vocabularyId},
      ${exerciseType},
      ${correct},
      ${responseTimeMs || null}
    )
    RETURNING *
  `;

  return result[0] as ExerciseResult;
}

/**
 * Update word status based on performance
 * Algorithm:
 * - If accuracy >= 80% and 3+ attempts -> 'reviewing'
 * - If accuracy >= 90% and 5+ attempts -> 'mastered'
 */
export async function updateWordStatus(
  userId: number | bigint,
  vocabularyId: number
): Promise<void> {
  // Get exercise statistics for this word
  const stats = await sql`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN correct THEN 1 ELSE 0 END) as correct_count
    FROM exercise_results
    WHERE user_id = ${userId} AND vocabulary_id = ${vocabularyId}
  `;

  const total = Number(stats[0]?.total || 0);
  const correct = Number(stats[0]?.correct_count || 0);

  if (total === 0) return;

  const accuracy = correct / total;

  let newStatus: 'learning' | 'reviewing' | 'mastered' = 'learning';
  let masteredAt = null;

  if (accuracy >= 0.9 && total >= 5) {
    newStatus = 'mastered';
    masteredAt = new Date();
  } else if (accuracy >= 0.8 && total >= 3) {
    newStatus = 'reviewing';
  }

  await sql`
    UPDATE user_vocabulary
    SET
      status = ${newStatus},
      review_count = review_count + 1,
      mastered_at = ${masteredAt}
    WHERE user_id = ${userId} AND vocabulary_id = ${vocabularyId}
  `;
}

/**
 * Get exercise statistics for a user
 */
export async function getExerciseStats(userId: number | bigint) {
  const result = await sql`
    SELECT
      exercise_type,
      COUNT(*) as total_attempts,
      SUM(CASE WHEN correct THEN 1 ELSE 0 END) as correct_count,
      AVG(response_time_ms) as avg_response_time
    FROM exercise_results
    WHERE user_id = ${userId}
    GROUP BY exercise_type
  `;

  return result;
}

/**
 * Get words that need review (reviewing status, not practiced recently)
 */
export async function getWordsForReview(
  userId: number | bigint,
  limit: number = 10
): Promise<Array<UserVocabulary & { hebrew_word: string; russian_translation: string }>> {
  const result = await sql`
    SELECT uv.*, v.hebrew_word, v.russian_translation, v.cefr_level
    FROM user_vocabulary uv
    JOIN vocabulary v ON uv.vocabulary_id = v.id
    WHERE uv.user_id = ${userId}
      AND uv.status IN ('learning', 'reviewing')
      AND uv.vocabulary_id NOT IN (
        SELECT vocabulary_id
        FROM exercise_results
        WHERE user_id = ${userId}
          AND attempt_time > NOW() - INTERVAL '1 day'
      )
    ORDER BY uv.first_seen_at ASC
    LIMIT ${limit}
  `;

  return result as any[];
}

/**
 * Get recent exercise results for a word
 */
export async function getWordExerciseHistory(
  userId: number | bigint,
  vocabularyId: number,
  limit: number = 10
): Promise<ExerciseResult[]> {
  const result = await sql`
    SELECT *
    FROM exercise_results
    WHERE user_id = ${userId} AND vocabulary_id = ${vocabularyId}
    ORDER BY attempt_time DESC
    LIMIT ${limit}
  `;

  return result as ExerciseResult[];
}
