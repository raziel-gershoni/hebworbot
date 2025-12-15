/**
 * Neon PostgreSQL Serverless Client
 *
 * This client uses Neon's HTTP-based driver optimized for serverless environments.
 * It automatically handles connection pooling via HTTP without TCP overhead.
 *
 * IMPORTANT: Use the pooled connection string ending with `-pooler` in DATABASE_URL
 */

import { neon } from '@neondatabase/serverless';

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL environment variable is not set. ' +
    'Please add it to your .env.local file or Vercel environment variables.'
  );
}

// Validate that we're using a pooled connection
if (!DATABASE_URL.includes('-pooler')) {
  console.warn(
    'WARNING: DATABASE_URL should use a pooled connection (ending with -pooler) ' +
    'for optimal serverless performance. Current URL does not include -pooler.'
  );
}

/**
 * Neon SQL client
 *
 * Usage:
 * ```typescript
 * const result = await sql`SELECT * FROM users WHERE id = ${userId}`;
 * ```
 *
 * The sql function automatically handles:
 * - Prepared statements (prevents SQL injection)
 * - Connection pooling via HTTP
 * - Automatic reconnection
 */
export const sql = neon(DATABASE_URL);

/**
 * Health check function to verify database connectivity
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

/**
 * Execute raw SQL (use sparingly, prefer the sql template literal)
 */
export async function executeSql(query: string, params: any[] = []) {
  return sql(query, params);
}
