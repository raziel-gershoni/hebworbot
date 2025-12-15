/**
 * Set Telegram Webhook Script
 *
 * Configure Telegram to send updates to your Vercel webhook URL
 *
 * Usage:
 *   npm run set-webhook
 */

import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Bot } from 'grammy';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (!BOT_TOKEN) {
  console.error('❌ ERROR: TELEGRAM_BOT_TOKEN environment variable is not set');
  process.exit(1);
}

if (!WEBHOOK_URL) {
  console.error('❌ ERROR: WEBHOOK_URL environment variable is not set');
  process.exit(1);
}

async function setWebhook() {
  console.log('🔗 Setting up Telegram webhook...\n');

  const bot = new Bot(BOT_TOKEN!);

  try {
    // Delete any existing webhook first
    console.log('🗑️  Deleting any existing webhook...');
    await bot.api.deleteWebhook();
    console.log('✅ Existing webhook deleted\n');

    // Set new webhook
    console.log(`📡 Setting webhook to: ${WEBHOOK_URL}`);
    await bot.api.setWebhook(WEBHOOK_URL!, {
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    });

    console.log('✅ Webhook set successfully!\n');

    // Get webhook info to verify
    console.log('🔍 Verifying webhook info...');
    const info = await bot.api.getWebhookInfo();

    console.log('\n📊 Webhook Info:');
    console.log(`   URL: ${info.url}`);
    console.log(`   Pending updates: ${info.pending_update_count}`);
    console.log(`   Last error date: ${info.last_error_date || 'None'}`);
    console.log(`   Last error message: ${info.last_error_message || 'None'}`);
    console.log(`   Max connections: ${info.max_connections || 'Default'}`);
    console.log(`   Allowed updates: ${info.allowed_updates?.join(', ') || 'All'}`);

    if (info.url === WEBHOOK_URL) {
      console.log('\n✅ Webhook is active and correctly configured!');
      console.log('\n🎉 Your bot is ready to receive messages!');
      console.log(`\n💡 Test it by sending /start to your bot on Telegram`);
    } else {
      console.log('\n⚠️  Warning: Webhook URL doesn not match expected URL');
      console.log(`   Expected: ${WEBHOOK_URL}`);
      console.log(`   Actual: ${info.url}`);
    }
  } catch (error: any) {
    console.error('\n❌ Error setting webhook:', error.message);

    if (error.message.includes('HTTPS')) {
      console.error('\n💡 Tip: Telegram requires HTTPS for webhooks.');
      console.error('   Make sure your WEBHOOK_URL starts with https://');
    }

    if (error.message.includes('getaddrinfo')) {
      console.error('\n💡 Tip: The webhook URL might be unreachable.');
      console.error('   Make sure your Vercel deployment is live and accessible.');
    }

    process.exit(1);
  }
}

// Run
setWebhook();
