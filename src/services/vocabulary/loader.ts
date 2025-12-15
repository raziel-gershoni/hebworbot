/**
 * Vocabulary Loader
 *
 * Load and manage Hebrew word frequency lists
 */

export interface RawHebrewWord {
  word: string;
  frequency_rank: number;
}

/**
 * Basic Hebrew vocabulary starter list (most common words)
 * This will be expanded with a larger frequency list
 */
export const STARTER_VOCABULARY: RawHebrewWord[] = [
  // A1 Level - Basic greetings and common words
  { word: 'שלום', frequency_rank: 1 },
  { word: 'תודה', frequency_rank: 2 },
  { word: 'בבקשה', frequency_rank: 3 },
  { word: 'כן', frequency_rank: 4 },
  { word: 'לא', frequency_rank: 5 },
  { word: 'בוקר', frequency_rank: 6 },
  { word: 'ערב', frequency_rank: 7 },
  { word: 'לילה', frequency_rank: 8 },
  { word: 'יום', frequency_rank: 9 },
  { word: 'שבוע', frequency_rank: 10 },
  { word: 'חודש', frequency_rank: 11 },
  { word: 'שנה', frequency_rank: 12 },
  { word: 'מה', frequency_rank: 13 },
  { word: 'מי', frequency_rank: 14 },
  { word: 'איפה', frequency_rank: 15 },
  { word: 'מתי', frequency_rank: 16 },
  { word: 'למה', frequency_rank: 17 },
  { word: 'איך', frequency_rank: 18 },
  { word: 'כמה', frequency_rank: 19 },
  { word: 'אני', frequency_rank: 20 },
  { word: 'אתה', frequency_rank: 21 },
  { word: 'את', frequency_rank: 22 },
  { word: 'הוא', frequency_rank: 23 },
  { word: 'היא', frequency_rank: 24 },
  { word: 'אנחנו', frequency_rank: 25 },
  { word: 'אתם', frequency_rank: 26 },
  { word: 'הם', frequency_rank: 27 },
  { word: 'בית', frequency_rank: 28 },
  { word: 'ספר', frequency_rank: 29 },
  { word: 'מים', frequency_rank: 30 },

  // A2 Level - Common verbs and nouns
  { word: 'אוהב', frequency_rank: 31 },
  { word: 'רוצה', frequency_rank: 32 },
  { word: 'יכול', frequency_rank: 33 },
  { word: 'צריך', frequency_rank: 34 },
  { word: 'עובד', frequency_rank: 35 },
  { word: 'לומד', frequency_rank: 36 },
  { word: 'גר', frequency_rank: 37 },
  { word: 'הולך', frequency_rank: 38 },
  { word: 'בא', frequency_rank: 39 },
  { word: 'יושב', frequency_rank: 40 },
  { word: 'אוכל', frequency_rank: 41 },
  { word: 'שותה', frequency_rank: 42 },
  { word: 'קורא', frequency_rank: 43 },
  { word: 'כותב', frequency_rank: 44 },
  { word: 'מדבר', frequency_rank: 45 },
  { word: 'שומע', frequency_rank: 46 },
  { word: 'רואה', frequency_rank: 47 },
  { word: 'יודע', frequency_rank: 48 },
  { word: 'חושב', frequency_rank: 49 },
  { word: 'מרגיש', frequency_rank: 50 },

  // B1 Level - More complex vocabulary
  { word: 'משפחה', frequency_rank: 51 },
  { word: 'חבר', frequency_rank: 52 },
  { word: 'עבודה', frequency_rank: 53 },
  { word: 'בית ספר', frequency_rank: 54 },
  { word: 'אוכל', frequency_rank: 55 },
  { word: 'כסף', frequency_rank: 56 },
  { word: 'זמן', frequency_rank: 57 },
  { word: 'עיר', frequency_rank: 58 },
  { word: 'ארץ', frequency_rank: 59 },
  { word: 'עולם', frequency_rank: 60 },
  { word: 'אנשים', frequency_rank: 61 },
  { word: 'ילד', frequency_rank: 62 },
  { word: 'איש', frequency_rank: 63 },
  { word: 'אישה', frequency_rank: 64 },
  { word: 'דבר', frequency_rank: 65 },
  { word: 'מקום', frequency_rank: 66 },
  { word: 'פעם', frequency_rank: 67 },
  { word: 'שעה', frequency_rank: 68 },
  { word: 'דקה', frequency_rank: 69 },
  { word: 'שניה', frequency_rank: 70 },

  // B2 Level - Advanced vocabulary
  { word: 'ממשלה', frequency_rank: 71 },
  { word: 'חברה', frequency_rank: 72 },
  { word: 'כלכלה', frequency_rank: 73 },
  { word: 'פוליטיקה', frequency_rank: 74 },
  { word: 'תרבות', frequency_rank: 75 },
  { word: 'היסטוריה', frequency_rank: 76 },
  { word: 'מדע', frequency_rank: 77 },
  { word: 'טכנולוגיה', frequency_rank: 78 },
  { word: 'אומנות', frequency_rank: 79 },
  { word: 'ספרות', frequency_rank: 80 },
];

/**
 * Load Hebrew words from frequency list
 */
export function loadVocabulary(): RawHebrewWord[] {
  // For now, return starter vocabulary
  // TODO: Load from external file or API
  return STARTER_VOCABULARY;
}

/**
 * Get a batch of words for processing
 */
export function getBatch(words: RawHebrewWord[], batchSize: number, offset: number): RawHebrewWord[] {
  return words.slice(offset, offset + batchSize);
}
