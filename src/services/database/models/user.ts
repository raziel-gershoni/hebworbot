/**
 * User Model - CRUD operations for Telegram users
 */

import { sql } from '../client.js';

export interface User {
  id: bigint;
  telegram_username?: string;
  first_name: string;
  language_code?: string;
  current_level: string;
  assessment_completed: boolean;
  daily_words_count: number;
  is_premium: boolean;
  created_at: Date;
  updated_at: Date;
}

export type NewUser = {
  id: number | bigint;
  telegram_username?: string;
  first_name: string;
  language_code?: string;
};

/**
 * Create a new user
 */
export async function createUser(userData: NewUser): Promise<User> {
  const result = await sql`
    INSERT INTO users (id, telegram_username, first_name, language_code)
    VALUES (${userData.id}, ${userData.telegram_username || null}, ${userData.first_name}, ${userData.language_code || null})
    RETURNING *
  `;

  return result[0] as User;
}

/**
 * Get user by Telegram ID
 */
export async function getUserById(userId: number | bigint): Promise<User | null> {
  const result = await sql`
    SELECT * FROM users WHERE id = ${userId}
  `;

  return result.length > 0 ? (result[0] as User) : null;
}

/**
 * Update user's assessment completion status and level
 */
export async function updateUserAssessment(
  userId: number | bigint,
  level: string
): Promise<User> {
  const result = await sql`
    UPDATE users
    SET current_level = ${level},
        assessment_completed = TRUE,
        updated_at = NOW()
    WHERE id = ${userId}
    RETURNING *
  `;

  return result[0] as User;
}

/**
 * Update user's daily words count
 */
export async function updateDailyWordsCount(
  userId: number | bigint,
  count: number
): Promise<User> {
  const result = await sql`
    UPDATE users
    SET daily_words_count = ${count},
        updated_at = NOW()
    WHERE id = ${userId}
    RETURNING *
  `;

  return result[0] as User;
}

/**
 * Update user's premium status
 */
export async function updatePremiumStatus(
  userId: number | bigint,
  isPremium: boolean
): Promise<User> {
  const result = await sql`
    UPDATE users
    SET is_premium = ${isPremium},
        updated_at = NOW()
    WHERE id = ${userId}
    RETURNING *
  `;

  return result[0] as User;
}

/**
 * Get or create user (upsert)
 */
export async function getOrCreateUser(userData: NewUser): Promise<User> {
  // Try to get existing user first
  const existing = await getUserById(userData.id);

  if (existing) {
    return existing;
  }

  // Create new user if doesn't exist
  return createUser(userData);
}

/**
 * Check if user has completed assessment
 */
export async function hasCompletedAssessment(userId: number | bigint): Promise<boolean> {
  const user = await getUserById(userId);
  return user?.assessment_completed || false;
}

/**
 * Get user statistics
 */
export async function getUserStats(userId: number | bigint) {
  const result = await sql`
    SELECT
      u.current_level,
      COUNT(DISTINCT uv.id) FILTER (WHERE uv.status = 'mastered') as mastered_words,
      COUNT(DISTINCT uv.id) FILTER (WHERE uv.status = 'reviewing') as reviewing_words,
      COUNT(DISTINCT uv.id) FILTER (WHERE uv.status = 'learning') as learning_words,
      COUNT(er.id) FILTER (WHERE er.correct = TRUE) as correct_exercises,
      COUNT(er.id) as total_exercises
    FROM users u
    LEFT JOIN user_vocabulary uv ON u.id = uv.user_id
    LEFT JOIN exercise_results er ON u.id = er.user_id
    WHERE u.id = ${userId}
    GROUP BY u.id, u.current_level
  `;

  return result[0] || {
    current_level: 'A1',
    mastered_words: 0,
    reviewing_words: 0,
    learning_words: 0,
    correct_exercises: 0,
    total_exercises: 0,
  };
}
