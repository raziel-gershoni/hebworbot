-- HebWorBot Database Schema
-- Neon PostgreSQL (Serverless)

-- Enable UUID extension for future use if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table: Store Telegram users and their learning progress
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,                          -- Telegram user ID
  telegram_username VARCHAR(255),                 -- Telegram username (optional)
  first_name VARCHAR(255),                        -- User's first name
  language_code VARCHAR(10),                      -- User's language code (should be 'ru')
  current_level VARCHAR(5) DEFAULT 'A1',          -- CEFR level: A1, A2, B1, B2, C1, C2
  assessment_completed BOOLEAN DEFAULT FALSE,     -- Has user completed initial assessment?
  daily_words_count INT DEFAULT 5,                -- Number of words to show daily (5-10)
  is_premium BOOLEAN DEFAULT FALSE,               -- Premium tier for better Gemini model
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Vocabulary table: Hebrew words with Russian translations
CREATE TABLE IF NOT EXISTS vocabulary (
  id SERIAL PRIMARY KEY,
  hebrew_word VARCHAR(255) NOT NULL UNIQUE,      -- Hebrew word (in Hebrew script)
  russian_translation TEXT NOT NULL,              -- Russian translation(s), can be multiple separated by ';'
  frequency_rank INT NOT NULL,                    -- From frequency list (1 = most common)
  cefr_level VARCHAR(5) NOT NULL,                 -- CEFR level: A1, A2, B1, B2, C1, C2
  part_of_speech VARCHAR(50),                     -- noun, verb, adjective, etc.
  example_sentence_hebrew TEXT,                   -- Optional example sentence in Hebrew
  example_sentence_russian TEXT,                  -- Optional example translation in Russian
  created_at TIMESTAMP DEFAULT NOW()
);

-- User vocabulary tracking: Which words each user has learned
CREATE TABLE IF NOT EXISTS user_vocabulary (
  id SERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  vocabulary_id INT REFERENCES vocabulary(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'learning',          -- learning, reviewing, mastered
  first_seen_at TIMESTAMP DEFAULT NOW(),
  mastered_at TIMESTAMP,                          -- When user mastered this word
  review_count INT DEFAULT 0,                     -- Number of times reviewed
  UNIQUE(user_id, vocabulary_id)                  -- Prevent duplicate entries
);

-- Exercise results: Track user performance on exercises
CREATE TABLE IF NOT EXISTS exercise_results (
  id SERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  vocabulary_id INT REFERENCES vocabulary(id) ON DELETE CASCADE,
  exercise_type VARCHAR(50) NOT NULL,             -- mcq_he_ru, mcq_ru_he, flashcard
  correct BOOLEAN NOT NULL,                       -- Was the answer correct?
  attempt_time TIMESTAMP DEFAULT NOW(),
  response_time_ms INT                            -- Time taken to respond in milliseconds
);

-- Conversation state: Store conversation state for serverless functions
CREATE TABLE IF NOT EXISTS conversation_state (
  user_id BIGINT PRIMARY KEY,
  conversation_key VARCHAR(100) NOT NULL,         -- e.g., 'assessment', 'exercise', 'daily_words'
  state_data JSONB NOT NULL,                      -- Serialized conversation state
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_vocabulary_level ON vocabulary(cefr_level);
CREATE INDEX IF NOT EXISTS idx_vocabulary_frequency ON vocabulary(frequency_rank);
CREATE INDEX IF NOT EXISTS idx_vocabulary_hebrew ON vocabulary(hebrew_word);
CREATE INDEX IF NOT EXISTS idx_user_vocabulary_status ON user_vocabulary(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_vocabulary_user ON user_vocabulary(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_results_user ON exercise_results(user_id, attempt_time DESC);
CREATE INDEX IF NOT EXISTS idx_exercise_results_vocabulary ON exercise_results(vocabulary_id);
CREATE INDEX IF NOT EXISTS idx_conversation_state_user ON conversation_state(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Create triggers for automatic updated_at updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_state_updated_at BEFORE UPDATE ON conversation_state
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add mastery tracking column for progressive learning (v2 migration)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS current_level_mastery_percentage INT DEFAULT 0;

-- Create index for performance (querying by level and mastery)
CREATE INDEX IF NOT EXISTS idx_users_level_mastery
ON users(current_level, current_level_mastery_percentage);

-- Calculate actual mastery for existing users (safe to run multiple times)
UPDATE users u
SET current_level_mastery_percentage = (
  SELECT COALESCE(
    ROUND(
      COUNT(CASE WHEN uv.status = 'mastered' THEN 1 END)::DECIMAL /
      NULLIF(COUNT(*), 0)::DECIMAL * 100
    ), 0)
  FROM user_vocabulary uv
  JOIN vocabulary v ON uv.vocabulary_id = v.id
  WHERE uv.user_id = u.id
    AND v.cefr_level = u.current_level
)
WHERE current_level_mastery_percentage = 0  -- Only update if not already set
  AND EXISTS (
    SELECT 1 FROM user_vocabulary WHERE user_id = u.id
  );  -- Only if user has learned words
