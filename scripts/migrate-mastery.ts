/**
 * Add Mastery Column Migration
 *
 * Adds current_level_mastery_percentage column for progressive learning system
 *
 * Usage:
 *   npm run migrate:mastery
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
  console.log('🔄 Adding mastery percentage column...\n');

  const sql = neon(DATABASE_URL!);

  try {
    // Test connection
    console.log('📡 Testing database connection...');
    await sql`SELECT 1`;
    console.log('✅ Database connection successful\n');

    // Read migration file
    const migrationPath = join(__dirname, '..', 'src', 'services', 'database', 'migrations', 'add_mastery_column.sql');
    console.log(`📖 Reading migration file: ${migrationPath}`);
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log(`📝 Executing migration SQL...\n`);

    // Split SQL into statements
    const statements: string[] = [];
    let currentStatement = '';

    for (const line of migrationSQL.split('\n')) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('--')) {
        continue;
      }

      currentStatement += line + '\n';

      // Check for statement end
      if (trimmed.endsWith(';')) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    }

    console.log(`   Found ${statements.length} statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const statementType = statement.match(/^(CREATE|INSERT|ALTER|DROP|UPDATE|SELECT)/i)?.[0] || 'SQL';

      console.log(`   [${i + 1}/${statements.length}] Executing ${statementType}...`);

      try {
        await sql(statement);
        console.log(`   ✅ Success`);
      } catch (error: any) {
        // Ignore "already exists" errors for idempotency
        if (error.message?.includes('already exists') || error.message?.includes('duplicate column')) {
          console.log(`   ⏭️  Already exists, skipping`);
        } else {
          console.error(`   ❌ Failed: ${error.message}`);
          throw error;
        }
      }
    }

    console.log('\n✅ All SQL statements executed successfully');

    // Verify column was added
    console.log('\n🔍 Verifying mastery column...');
    const columns = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name = 'current_level_mastery_percentage'
    `;

    if (columns.length > 0) {
      console.log(`   ✅ Column 'current_level_mastery_percentage' exists`);
      console.log(`      Type: ${columns[0].data_type}`);
      console.log(`      Default: ${columns[0].column_default}`);
    } else {
      console.error('   ❌ Column was not created');
    }

    // Check user counts
    const userCounts = await sql`
      SELECT
        COUNT(*) as total_users,
        COUNT(current_level_mastery_percentage) as users_with_mastery,
        AVG(current_level_mastery_percentage) as avg_mastery
      FROM users
    `;

    console.log('\n📊 User mastery stats:');
    console.log(`   Total users: ${userCounts[0].total_users}`);
    console.log(`   Users with mastery data: ${userCounts[0].users_with_mastery}`);
    console.log(`   Average mastery: ${parseFloat(userCounts[0].avg_mastery || '0').toFixed(1)}%`);

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
runMigration();
