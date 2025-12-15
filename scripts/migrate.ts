/**
 * Database Migration Script
 *
 * Runs the initial database schema migration on Neon PostgreSQL
 *
 * Usage:
 *   npm run migrate
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is not set');
  console.error('Please set it in your .env.local file or environment');
  process.exit(1);
}

async function runMigration() {
  console.log('🔄 Starting database migration...\n');

  const sql = neon(DATABASE_URL!);

  try {
    // Test connection
    console.log('📡 Testing database connection...');
    await sql`SELECT 1`;
    console.log('✅ Database connection successful\n');

    // Read migration file
    const migrationPath = join(__dirname, '..', 'src', 'services', 'database', 'migrations', 'init.sql');
    console.log(`📖 Reading migration file: ${migrationPath}`);
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log(`📝 Executing migration SQL...\n`);

    // Split SQL into statements, handling special cases like FUNCTION definitions
    const statements: string[] = [];
    let currentStatement = '';
    let inFunction = false;

    for (const line of migrationSQL.split('\n')) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('--')) {
        continue;
      }

      // Track if we're inside a function definition
      if (trimmed.includes('CREATE OR REPLACE FUNCTION') || trimmed.includes('CREATE FUNCTION')) {
        inFunction = true;
      }

      currentStatement += line + '\n';

      // Check for statement end
      if (trimmed.endsWith(';')) {
        // For functions, wait for the language specification
        if (inFunction && (trimmed.includes("LANGUAGE 'plpgsql'") || trimmed.includes('LANGUAGE plpgsql'))) {
          inFunction = false;
          statements.push(currentStatement.trim());
          currentStatement = '';
        } else if (!inFunction) {
          statements.push(currentStatement.trim());
          currentStatement = '';
        }
      }
    }

    console.log(`   Found ${statements.length} statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const statementType = statement.match(/^(CREATE|INSERT|ALTER|DROP|SELECT)/i)?.[0] || 'SQL';

      console.log(`   [${i + 1}/${statements.length}] Executing ${statementType}...`);

      try {
        await sql(statement);
      } catch (error: any) {
        // Ignore "already exists" errors for idempotency
        if (error.message?.includes('already exists')) {
          console.log(`   ⏭️  Already exists, skipping`);
        } else {
          console.error(`   ❌ Failed: ${error.message}`);
          throw error;
        }
      }
    }

    console.log('\n✅ All SQL statements executed successfully');

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Database schema created:');
    console.log('   • users');
    console.log('   • vocabulary');
    console.log('   • user_vocabulary');
    console.log('   • exercise_results');
    console.log('   • conversation_state');

    // Verify tables were created
    console.log('\n🔍 Verifying tables...');
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    console.log(`   Found ${tables.length} tables:`);
    tables.forEach((table: any) => {
      console.log(`   • ${table.table_name}`);
    });

    console.log('\n✅ Database is ready for use!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
runMigration();
