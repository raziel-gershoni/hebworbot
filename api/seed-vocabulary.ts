/**
 * Vocabulary Seeding API Endpoint
 *
 * Protected endpoint to seed vocabulary database with Gemini translations
 * Call multiple times to process all batches
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loadVocabulary, getBatch } from '../src/services/vocabulary/loader.js';
import { translateAndLevelWords } from '../src/services/gemini/vocabulary.js';
import { sql } from '../src/services/database/client.js';
import { logger } from '../src/utils/logger.js';
import { config } from '../src/utils/config.js';

const BATCH_SIZE = 20;

/**
 * Check which words already exist in database
 */
async function getExistingWords(): Promise<Set<string>> {
  const result = await sql`SELECT hebrew_word FROM vocabulary`;
  return new Set(result.map(row => row.hebrew_word));
}

/**
 * Insert vocabulary items into database
 */
async function insertVocabulary(items: any[]) {
  const inserted = [];

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

      inserted.push(item.hebrew_word);
    } catch (error: any) {
      logger.error(`Failed to insert ${item.hebrew_word}:`, error.message);
    }
  }

  return inserted;
}

/**
 * Vercel API handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Security check
    const secret = req.query.secret as string;
    if (secret !== config.telegram.botToken.substring(0, 20)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    logger.info('Vocabulary seeding API called');

    // Load all words
    const allWords = loadVocabulary();

    // Check existing
    const existingWords = await getExistingWords();
    const wordsToProcess = allWords.filter(w => !existingWords.has(w.word));

    if (wordsToProcess.length === 0) {
      return res.status(200).json({
        status: 'complete',
        message: 'All words already processed',
        total: allWords.length,
        existing: existingWords.size,
        remaining: 0,
        progress: 100,
      });
    }

    // Get specific batch or process next batch
    const batchIndex = req.query.batch ? parseInt(req.query.batch as string) : 0;
    const totalBatches = Math.ceil(wordsToProcess.length / BATCH_SIZE);

    if (batchIndex >= totalBatches) {
      return res.status(400).json({
        error: 'Invalid batch index',
        totalBatches,
        requestedBatch: batchIndex,
      });
    }

    // Process batch
    const offset = batchIndex * BATCH_SIZE;
    const batch = getBatch(wordsToProcess, BATCH_SIZE, offset);

    logger.info(`Processing batch ${batchIndex + 1}/${totalBatches}, words: ${batch.map(w => w.word).join(', ')}`);

    // Translate with Gemini
    const hebrewWords = batch.map(w => w.word);
    const translated = await translateAndLevelWords(hebrewWords);

    // Combine with frequency ranks
    const vocabularyItems = translated.map((item, index) => ({
      ...item,
      frequency_rank: batch[index].frequency_rank,
    }));

    // Insert into database
    const inserted = await insertVocabulary(vocabularyItems);

    // Calculate progress
    const processedTotal = existingWords.size + ((batchIndex + 1) * BATCH_SIZE);
    const actualProcessed = Math.min(processedTotal, existingWords.size + wordsToProcess.length);
    const progress = Math.round((actualProcessed / allWords.length) * 100);

    logger.info(`Batch ${batchIndex + 1} complete. Progress: ${actualProcessed}/${allWords.length} (${progress}%)`);

    return res.status(200).json({
      status: 'success',
      batch: {
        index: batchIndex,
        total: totalBatches,
        processed: inserted.length,
        words: inserted,
      },
      progress: {
        total: allWords.length,
        existing: existingWords.size,
        remaining: wordsToProcess.length - ((batchIndex + 1) * BATCH_SIZE),
        percentage: progress,
      },
      nextBatch: batchIndex + 1 < totalBatches ? batchIndex + 1 : null,
      nextUrl: batchIndex + 1 < totalBatches
        ? `/api/seed-vocabulary?batch=${batchIndex + 1}&secret=${secret}`
        : null,
    });

  } catch (error: any) {
    logger.error('Vocabulary seeding API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}
