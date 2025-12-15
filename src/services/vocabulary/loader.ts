/**
 * Vocabulary Loader
 *
 * Load and manage Hebrew word frequency lists
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface RawHebrewWord {
  word: string;
  frequency_rank: number;
  cefr_level?: string; // Optional: assigned from frequency list
}

// Cache for loaded vocabulary
let cachedVocabulary: RawHebrewWord[] | null = null;

/**
 * Load vocabulary from JSON file
 */
function loadVocabularyFromFile(): RawHebrewWord[] {
  if (cachedVocabulary) {
    return cachedVocabulary;
  }

  const dataPath = join(__dirname, '../../../data/hebrew-frequency-5k.json');
  const content = readFileSync(dataPath, 'utf-8');
  const words = JSON.parse(content);

  cachedVocabulary = words;
  return words;
}

/**
 * Fallback vocabulary (legacy - kept for reference)
 */
export const LEGACY_STARTER_VOCABULARY: RawHebrewWord[] = [
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

  // Additional A1 vocabulary - Colors, Numbers, Basic Nouns
  { word: 'אדום', frequency_rank: 81 },
  { word: 'כחול', frequency_rank: 82 },
  { word: 'ירוק', frequency_rank: 83 },
  { word: 'צהוב', frequency_rank: 84 },
  { word: 'לבן', frequency_rank: 85 },
  { word: 'שחור', frequency_rank: 86 },
  { word: 'אחד', frequency_rank: 87 },
  { word: 'שניים', frequency_rank: 88 },
  { word: 'שלוש', frequency_rank: 89 },
  { word: 'ארבע', frequency_rank: 90 },
  { word: 'חמש', frequency_rank: 91 },
  { word: 'שש', frequency_rank: 92 },
  { word: 'שבע', frequency_rank: 93 },
  { word: 'שמונה', frequency_rank: 94 },
  { word: 'תשע', frequency_rank: 95 },
  { word: 'עשר', frequency_rank: 96 },
  { word: 'אבא', frequency_rank: 97 },
  { word: 'אמא', frequency_rank: 98 },
  { word: 'אח', frequency_rank: 99 },
  { word: 'אחות', frequency_rank: 100 },
  { word: 'בן', frequency_rank: 101 },
  { word: 'בת', frequency_rank: 102 },
  { word: 'סבא', frequency_rank: 103 },
  { word: 'סבתא', frequency_rank: 104 },
  { word: 'דוד', frequency_rank: 105 },
  { word: 'דודה', frequency_rank: 106 },
  { word: 'ראש', frequency_rank: 107 },
  { word: 'יד', frequency_rank: 108 },
  { word: 'רגל', frequency_rank: 109 },
  { word: 'עין', frequency_rank: 110 },
  { word: 'אוזן', frequency_rank: 111 },
  { word: 'אף', frequency_rank: 112 },
  { word: 'פה', frequency_rank: 113 },
  { word: 'שן', frequency_rank: 114 },
  { word: 'לב', frequency_rank: 115 },
  { word: 'גוף', frequency_rank: 116 },
  { word: 'שולחן', frequency_rank: 117 },
  { word: 'כסא', frequency_rank: 118 },
  { word: 'דלת', frequency_rank: 119 },
  { word: 'חלון', frequency_rank: 120 },

  // Additional A2 vocabulary - Common verbs and adjectives
  { word: 'טוב', frequency_rank: 121 },
  { word: 'רע', frequency_rank: 122 },
  { word: 'גדול', frequency_rank: 123 },
  { word: 'קטן', frequency_rank: 124 },
  { word: 'חדש', frequency_rank: 125 },
  { word: 'ישן', frequency_rank: 126 },
  { word: 'יפה', frequency_rank: 127 },
  { word: 'מכוער', frequency_rank: 128 },
  { word: 'חם', frequency_rank: 129 },
  { word: 'קר', frequency_rank: 130 },
  { word: 'ארוך', frequency_rank: 131 },
  { word: 'קצר', frequency_rank: 132 },
  { word: 'רחב', frequency_rank: 133 },
  { word: 'צר', frequency_rank: 134 },
  { word: 'גבוה', frequency_rank: 135 },
  { word: 'נמוך', frequency_rank: 136 },
  { word: 'עושה', frequency_rank: 137 },
  { word: 'נותן', frequency_rank: 138 },
  { word: 'לוקח', frequency_rank: 139 },
  { word: 'שואל', frequency_rank: 140 },
  { word: 'עונה', frequency_rank: 141 },
  { word: 'פותח', frequency_rank: 142 },
  { word: 'סוגר', frequency_rank: 143 },
  { word: 'מתחיל', frequency_rank: 144 },
  { word: 'מסיים', frequency_rank: 145 },
  { word: 'שם', frequency_rank: 146 },
  { word: 'פה', frequency_rank: 147 },
  { word: 'עכשיו', frequency_rank: 148 },
  { word: 'אתמול', frequency_rank: 149 },
  { word: 'מחר', frequency_rank: 150 },
  { word: 'היום', frequency_rank: 151 },
  { word: 'בוקר', frequency_rank: 152 },
  { word: 'צהריים', frequency_rank: 153 },
  { word: 'ערב', frequency_rank: 154 },
  { word: 'לילה', frequency_rank: 155 },
  { word: 'שבת', frequency_rank: 156 },
  { word: 'יום ראשון', frequency_rank: 157 },
  { word: 'יום שני', frequency_rank: 158 },
  { word: 'יום שלישי', frequency_rank: 159 },
  { word: 'יום רביעי', frequency_rank: 160 },

  // Additional B1 vocabulary - Abstract concepts, professions
  { word: 'מורה', frequency_rank: 161 },
  { word: 'תלמיד', frequency_rank: 162 },
  { word: 'רופא', frequency_rank: 163 },
  { word: 'אחות', frequency_rank: 164 },
  { word: 'שוטר', frequency_rank: 165 },
  { word: 'חייל', frequency_rank: 166 },
  { word: 'נהג', frequency_rank: 167 },
  { word: 'טבח', frequency_rank: 168 },
  { word: 'מלצר', frequency_rank: 169 },
  { word: 'מנהל', frequency_rank: 170 },
  { word: 'בעיה', frequency_rank: 171 },
  { word: 'פתרון', frequency_rank: 172 },
  { word: 'שאלה', frequency_rank: 173 },
  { word: 'תשובה', frequency_rank: 174 },
  { word: 'רעיון', frequency_rank: 175 },
  { word: 'מחשבה', frequency_rank: 176 },
  { word: 'תקווה', frequency_rank: 177 },
  { word: 'פחד', frequency_rank: 178 },
  { word: 'שמחה', frequency_rank: 179 },
  { word: 'עצב', frequency_rank: 180 },
  { word: 'כעס', frequency_rank: 181 },
  { word: 'אהבה', frequency_rank: 182 },
  { word: 'שנאה', frequency_rank: 183 },
  { word: 'חלום', frequency_rank: 184 },
  { word: 'מציאות', frequency_rank: 185 },
  { word: 'עבר', frequency_rank: 186 },
  { word: 'הווה', frequency_rank: 187 },
  { word: 'עתיד', frequency_rank: 188 },
  { word: 'סיבה', frequency_rank: 189 },
  { word: 'תוצאה', frequency_rank: 190 },
  { word: 'התחלה', frequency_rank: 191 },
  { word: 'סוף', frequency_rank: 192 },
  { word: 'אמצע', frequency_rank: 193 },
  { word: 'חוץ', frequency_rank: 194 },
  { word: 'פנים', frequency_rank: 195 },
  { word: 'למעלה', frequency_rank: 196 },
  { word: 'למטה', frequency_rank: 197 },
  { word: 'ימין', frequency_rank: 198 },
  { word: 'שמאל', frequency_rank: 199 },
  { word: 'קדימה', frequency_rank: 200 },

  // Additional B2 vocabulary - Complex concepts
  { word: 'מערכת', frequency_rank: 201 },
  { word: 'תהליך', frequency_rank: 202 },
  { word: 'פיתוח', frequency_rank: 203 },
  { word: 'שינוי', frequency_rank: 204 },
  { word: 'התקדמות', frequency_rank: 205 },
  { word: 'ירידה', frequency_rank: 206 },
  { word: 'עלייה', frequency_rank: 207 },
  { word: 'משבר', frequency_rank: 208 },
  { word: 'הצלחה', frequency_rank: 209 },
  { word: 'כישלון', frequency_rank: 210 },
  { word: 'ניסיון', frequency_rank: 211 },
  { word: 'ניסוי', frequency_rank: 212 },
  { word: 'מחקר', frequency_rank: 213 },
  { word: 'גילוי', frequency_rank: 214 },
  { word: 'המצאה', frequency_rank: 215 },
  { word: 'יצירה', frequency_rank: 216 },
  { word: 'השראה', frequency_rank: 217 },
  { word: 'דמיון', frequency_rank: 218 },
  { word: 'מנהיגות', frequency_rank: 219 },
  { word: 'אחריות', frequency_rank: 220 },
  { word: 'חופש', frequency_rank: 221 },
  { word: 'שוויון', frequency_rank: 222 },
  { word: 'צדק', frequency_rank: 223 },
  { word: 'שלום', frequency_rank: 224 },
  { word: 'מלחמה', frequency_rank: 225 },
  { word: 'ויכוח', frequency_rank: 226 },
  { word: 'הסכם', frequency_rank: 227 },
  { word: 'חוזה', frequency_rank: 228 },
  { word: 'חוק', frequency_rank: 229 },
  { word: 'זכות', frequency_rank: 230 },
  { word: 'חובה', frequency_rank: 231 },
  { word: 'עונש', frequency_rank: 232 },
  { word: 'פרס', frequency_rank: 233 },
  { word: 'תחרות', frequency_rank: 234 },
  { word: 'שיתוף פעולה', frequency_rank: 235 },
  { word: 'קבוצה', frequency_rank: 236 },
  { word: 'ארגון', frequency_rank: 237 },
  { word: 'מוסד', frequency_rank: 238 },
  { word: 'מפלגה', frequency_rank: 239 },
  { word: 'בחירות', frequency_rank: 240 },
];

/**
 * Load Hebrew words from frequency list
 */
export function loadVocabulary(): RawHebrewWord[] {
  return loadVocabularyFromFile();
}

/**
 * Get a batch of words for processing
 */
export function getBatch(words: RawHebrewWord[], batchSize: number, offset: number): RawHebrewWord[] {
  return words.slice(offset, offset + batchSize);
}
