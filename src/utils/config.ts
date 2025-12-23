/**
 * Configuration and Environment Variables
 *
 * Centralized configuration management for the bot
 */

export const config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
    modelPremium: process.env.GEMINI_MODEL_PREMIUM || 'gemini-3-pro-preview',
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
  webhook: {
    url: process.env.WEBHOOK_URL || '',
  },
  env: process.env.NODE_ENV || 'development',
} as const;

/**
 * Validate that all required environment variables are set
 */
export function validateConfig(): void {
  const required = [
    { key: 'TELEGRAM_BOT_TOKEN', value: config.telegram.botToken },
    { key: 'GEMINI_API_KEY', value: config.gemini.apiKey },
    { key: 'DATABASE_URL', value: config.database.url },
  ];

  const missing = required.filter(({ value }) => !value);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.map(m => m.key).join(', ')}\n` +
      'Please check your .env.local file or environment configuration.'
    );
  }
}

/**
 * Get Gemini model name for a user (based on premium status)
 */
export function getGeminiModelForUser(isPremium: boolean): string {
  return isPremium ? config.gemini.modelPremium : config.gemini.model;
}

/**
 * Learning System Configuration
 *
 * Progressive mixed-level learning thresholds
 */
export const LEARNING_CONFIG = {
  // Mastery thresholds for word distribution changes
  PREVIEW_THRESHOLD: 50,      // Start showing 15% next level at 50% mastery
  GRADUAL_THRESHOLD: 65,      // Increase to 30% next level at 65% mastery
  BALANCED_THRESHOLD: 80,     // Increase to 50% next level at 80% mastery (balanced)
  ADVANCED_THRESHOLD: 90,     // Increase to 70% next level at 90% mastery
  AUTO_ADVANCE_THRESHOLD: 95, // Auto-advance to next level at 95% mastery

  // Word status promotion thresholds
  LEARNING_TO_REVIEWING: 3,   // 3 correct answers to move from learning to reviewing
  REVIEWING_TO_MASTERED: 8,   // 8 correct answers to move from reviewing to mastered
} as const;
