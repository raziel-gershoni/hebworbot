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
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    modelPremium: process.env.GEMINI_MODEL_PREMIUM || 'gemini-3.0',
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
