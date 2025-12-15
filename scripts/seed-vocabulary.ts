/**
 * Vocabulary Seeding Script
 *
 * Process Hebrew words with Gemini and seed the database
 */

import { loadVocabulary, getBatch } from '../src/services/vocabulary/loader.js';
import { translateAndLevelWords } from '../src/services/gemini/vocabulary.js';
import { sql } from '../src/services/database/client.js';
import { logger } from '../src/utils/logger.js';

const BATCH_SIZE = 20; // Process 20 words at a time
const DELAY_BETWEEN_BATCHES = 5000; // 5 seconds delay to respect rate limits

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Insert vocabulary items into database
 */
async function insertVocabulary(items: any[]) {
  for (const item of items) {
    try {
      await sql`
        INSERT INTO vocabulary (
          hebrew_word,
          russian_translation,
          frequency_rank,
          cefr_level,
          part_of_speech,
          example_sentence_hebrew,
          example_sentence_russian
        )
        VALUES (
          ${item.hebrew_word},
          ${item.russian_translation},
          ${item.frequency_rank},
          ${item.cefr_level},
          ${item.part_of_speech},
          ${item.example_sentence_hebrew},
          ${item.example_sentence_russian}
        )
        ON CONFLICT (hebrew_word) DO UPDATE SET
          russian_translation = EXCLUDED.russian_translation,
          cefr_level = EXCLUDED.cefr_level,
          part_of_speech = EXCLUDED.part_of_speech,
          example_sentence_hebrew = EXCLUDED.example_sentence_hebrew,
          example_sentence_russian = EXCLUDED.example_sentence_russian
      `;

      logger.info(`Inserted: ${item.hebrew_word} (${item.cefr_level})`);
    } catch (error: any) {
      logger.error(`Failed to insert ${item.hebrew_word}:`, error.message);
    }
  }
}

/**
 * Check which words already exist in database
 */
async function getExistingWords(): Promise<Set<string>> {
  const result = await sql`SELECT hebrew_word FROM vocabulary`;
  return new Set(result.map(row => row.hebrew_word));
}

/**
 * Main seeding function
 */
async function seedVocabulary() {
  try {
    logger.info('=== Starting Vocabulary Seeding ===');

    // Load Hebrew words
    const allWords = loadVocabulary();
    logger.info(`Loaded ${allWords.length} Hebrew words from frequency list`);

    // Check which words already exist
    const existingWords = await getExistingWords();
    logger.info(`Found ${existingWords.size} words already in database`);

    // Filter to only unprocessed words
    const wordsToProcess = allWords.filter(w => !existingWords.has(w.word));

    if (wordsToProcess.length === 0) {
      logger.info('✅ All words already processed! Nothing to do.');
      return;
    }

    logger.info(`📝 Need to process ${wordsToProcess.length} new words`);
    logger.info(`⏭️  Skipping ${allWords.length - wordsToProcess.length} already-processed words\n`);

    // Process in batches
    const totalBatches = Math.ceil(wordsToProcess.length / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const offset = batchIndex * BATCH_SIZE;
      const batch = getBatch(wordsToProcess, BATCH_SIZE, offset);

      logger.info(`\n=== Processing Batch ${batchIndex + 1}/${totalBatches} ===`);
      logger.info(`Words ${offset + 1}-${offset + batch.length} of ${wordsToProcess.length} remaining`);
      logger.info(`Hebrew words: ${batch.map(w => w.word).join(', ')}`);

      try {
        // Translate with Gemini
        const hebrewWords = batch.map(w => w.word);
        const translated = await translateAndLevelWords(hebrewWords);

        // Combine with frequency ranks
        const vocabularyItems = translated.map((item, index) => ({
          ...item,
          frequency_rank: batch[index].frequency_rank,
        }));

        // Insert into database
        await insertVocabulary(vocabularyItems);

        logger.info(`✅ Batch ${batchIndex + 1} completed successfully`);

        // Show overall progress
        const processedSoFar = existingWords.size + (batchIndex + 1) * BATCH_SIZE;
        const totalProgress = Math.min(processedSoFar, existingWords.size + wordsToProcess.length);
        logger.info(`📊 Overall progress: ${totalProgress}/${allWords.length} words (${Math.round(totalProgress / allWords.length * 100)}%)`);

        // Wait before next batch (except for last batch)
        if (batchIndex < totalBatches - 1) {
          logger.info(`Waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...`);
          await sleep(DELAY_BETWEEN_BATCHES);
        }
      } catch (error: any) {
        logger.error(`❌ Batch ${batchIndex + 1} failed:`, error.message);
        logger.warn(`You can re-run the script to resume from here. Already-processed words will be skipped.`);

        // Continue with next batch despite errors
        if (batchIndex < totalBatches - 1) {
          logger.info('Continuing with next batch after error...');
          await sleep(DELAY_BETWEEN_BATCHES);
        }
      }
    }

    logger.info('\n=== Vocabulary Seeding Complete ===');

    // Show summary
    const result = await sql`SELECT cefr_level, COUNT(*) as count FROM vocabulary GROUP BY cefr_level ORDER BY cefr_level`;
    logger.info('\nVocabulary Summary:');
    result.forEach(row => {
      logger.info(`  ${row.cefr_level}: ${row.count} words`);
    });

    const total = await sql`SELECT COUNT(*) as total FROM vocabulary`;
    logger.info(`\nTotal words in database: ${total[0].total}`);

  } catch (error: any) {
    logger.error('Fatal error during seeding:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedVocabulary()
    .then(() => {
      logger.info('Seeding script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Seeding script failed:', error);
      process.exit(1);
    });
}

export { seedVocabulary };
