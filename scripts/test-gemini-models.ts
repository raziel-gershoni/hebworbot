/**
 * Test Gemini Models Script
 *
 * Compare Gemini 2.5 Flash vs 3.0 (or other models) for:
 * - Translation quality (Hebrew → Russian)
 * - Assessment generation quality
 * - Response latency
 * - Structured output reliability
 *
 * Usage:
 *   npm run test-gemini-models
 */

import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { testModel } from '../src/services/gemini/client.js';
import { translateHebrewWords } from '../src/services/gemini/translation.js';
import { generateAssessmentQuestions } from '../src/services/gemini/assessment.js';
import { assignCEFRLevels } from '../src/services/gemini/leveler.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const MODELS_TO_TEST = [
  'gemini-3-flash-preview',
  'gemini-3-pro-preview',
  'gemini-2.5-flash',  // Keep for comparison
];

async function testTranslationQuality(modelName: string) {
  console.log(`\n📝 Testing translation quality (${modelName})...`);

  const testWords = ['שלום', 'ספר', 'בית', 'אהבה', 'חופש'];

  const startTime = Date.now();

  try {
    const result = await translateHebrewWords(testWords, false);
    const responseTime = Date.now() - startTime;

    console.log(`✅ Translation test passed (${responseTime}ms)`);
    console.log('Sample translations:');
    result.translations.slice(0, 3).forEach(t => {
      console.log(`  ${t.hebrew} → ${t.russian} (${t.partOfSpeech})`);
    });

    return { success: true, responseTime, translations: result.translations.length };
  } catch (error: any) {
    console.log(`❌ Translation test failed: ${error.message}`);
    return { success: false, responseTime: -1, error: error.message };
  }
}

async function testAssessmentGeneration(modelName: string) {
  console.log(`\n❓ Testing assessment generation (${modelName})...`);

  const startTime = Date.now();

  try {
    const result = await generateAssessmentQuestions(false);
    const responseTime = Date.now() - startTime;

    console.log(`✅ Assessment test passed (${responseTime}ms)`);
    console.log(`Generated ${result.questions.length} questions`);
    console.log('Sample question:');
    const q = result.questions[0];
    console.log(`  Level: ${q.level}`);
    console.log(`  Hebrew: ${q.hebrew}`);
    console.log(`  Question: ${q.russian.substring(0, 60)}...`);

    return { success: true, responseTime, questionsCount: result.questions.length };
  } catch (error: any) {
    console.log(`❌ Assessment test failed: ${error.message}`);
    return { success: false, responseTime: -1, error: error.message };
  }
}

async function testLevelAssignment(modelName: string) {
  console.log(`\n🎯 Testing CEFR level assignment (${modelName})...`);

  const testWords = [
    { hebrew: 'שלום', frequencyRank: 1 },
    { hebrew: 'ספר', frequencyRank: 100 },
    { hebrew: 'אוניברסיטה', frequencyRank: 1000 },
  ];

  const startTime = Date.now();

  try {
    const result = await assignCEFRLevels(testWords, false);
    const responseTime = Date.now() - startTime;

    console.log(`✅ Level assignment test passed (${responseTime}ms)`);
    console.log('Assigned levels:');
    result.assignments.forEach(a => {
      console.log(`  ${a.word} → ${a.level} (${a.reasoning.substring(0, 50)}...)`);
    });

    return { success: true, responseTime, assignmentsCount: result.assignments.length };
  } catch (error: any) {
    console.log(`❌ Level assignment test failed: ${error.message}`);
    return { success: false, responseTime: -1, error: error.message };
  }
}

async function testModel_Comprehensive(modelName: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Testing Model: ${modelName}`);
  console.log('='.repeat(60));

  const results: any = {
    model: modelName,
    basicTest: null,
    translation: null,
    assessment: null,
    levelAssignment: null,
  };

  // 1. Basic connectivity test
  console.log('\n🔌 Basic connectivity test...');
  results.basicTest = await testModel(modelName);

  if (!results.basicTest.success) {
    console.log(`\n❌ Model ${modelName} is not available or failed basic test`);
    return results;
  }

  // 2. Translation quality test
  results.translation = await testTranslationQuality(modelName);

  // 3. Assessment generation test
  results.assessment = await testAssessmentGeneration(modelName);

  // 4. Level assignment test
  results.levelAssignment = await testLevelAssignment(modelName);

  return results;
}

async function runComparison() {
  console.log('\n🚀 Gemini Model Comparison Test\n');
  console.log('This script will test multiple Gemini models for:');
  console.log('  • Translation quality (Hebrew → Russian)');
  console.log('  • Assessment generation');
  console.log('  • CEFR level assignment');
  console.log('  • Response latency\n');

  const allResults: any[] = [];

  for (const model of MODELS_TO_TEST) {
    try {
      const results = await testModel_Comprehensive(model);
      allResults.push(results);

      // Wait 2 seconds between models to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      console.log(`\n❌ Failed to test model ${model}: ${error.message}`);
      allResults.push({
        model,
        error: error.message,
      });
    }
  }

  // Print comparison summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 COMPARISON SUMMARY');
  console.log('='.repeat(60));

  console.log('\n┌─────────────────────────┬──────────┬────────────────┐');
  console.log('│ Model                   │ Success  │ Avg Time (ms)  │');
  console.log('├─────────────────────────┼──────────┼────────────────┤');

  for (const result of allResults) {
    const success = result.basicTest?.success ? '✅' : '❌';
    const avgTime = result.translation?.responseTime
      ? Math.round(
          (result.translation.responseTime +
            result.assessment.responseTime +
            result.levelAssignment.responseTime) / 3
        )
      : 'N/A';

    console.log(
      `│ ${result.model.padEnd(23)} │ ${success}      │ ${String(avgTime).padEnd(14)} │`
    );
  }

  console.log('└─────────────────────────┴──────────┴────────────────┘');

  console.log('\n📌 RECOMMENDATIONS:\n');

  const successfulModels = allResults.filter(r => r.basicTest?.success);

  if (successfulModels.length === 0) {
    console.log('❌ No models passed the tests. Please check your Gemini API key and model names.');
    return;
  }

  // Find fastest model
  const fastest = successfulModels.reduce((prev, curr) => {
    const prevTime =
      (prev.translation?.responseTime || 0) +
      (prev.assessment?.responseTime || 0) +
      (prev.levelAssignment?.responseTime || 0);
    const currTime =
      (curr.translation?.responseTime || 0) +
      (curr.assessment?.responseTime || 0) +
      (curr.levelAssignment?.responseTime || 0);
    return currTime < prevTime ? curr : prev;
  });

  console.log(`🏆 Fastest model: ${fastest.model}`);
  console.log(`   Recommended for: Free tier users (faster responses)`);
  console.log(`   Set GEMINI_MODEL=${fastest.model}\n`);

  if (successfulModels.length > 1) {
    // Recommend second model as premium
    const premium = successfulModels.find(m => m.model !== fastest.model);
    if (premium) {
      console.log(`💎 Alternative model: ${premium.model}`);
      console.log(`   Recommended for: Premium users (if quality is higher)`);
      console.log(`   Set GEMINI_MODEL_PREMIUM=${premium.model}\n`);
    }
  }

  console.log('Note: Test translation quality manually to ensure accuracy!');
  console.log('The automated tests only verify that the API works correctly.\n');
}

// Run the comparison
runComparison().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
