-- Add mastery tracking column to users table
-- This enables progressive mixed-level learning

-- Add the column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS current_level_mastery_percentage INT DEFAULT 0;

-- Create index for performance (querying by level and mastery)
CREATE INDEX IF NOT EXISTS idx_users_level_mastery
ON users(current_level, current_level_mastery_percentage);

-- Set all existing users to 0% mastery
UPDATE users
SET current_level_mastery_percentage = 0
WHERE current_level_mastery_percentage IS NULL;

-- Calculate actual mastery for existing users based on their current progress
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
WHERE current_level = current_level; -- Update all users
