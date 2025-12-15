/**
 * Bot Types
 *
 * TypeScript types for the Telegram bot
 */

import { Context, SessionFlavor } from 'grammy';
import { ConversationFlavor } from '@grammyjs/conversations';

/**
 * Session data stored in database
 */
export interface SessionData {
  userId: number;
  currentConversation?: string;
  assessmentData?: {
    questions: any[];
    answers: number[];
    currentQuestionIndex: number;
  };
  exerciseData?: {
    words: any[];
    currentWordIndex: number;
    correctCount: number;
    startTime: number;
  };
}

/**
 * Bot context with session and conversation support
 */
export type BotContext = Context & SessionFlavor<SessionData> & ConversationFlavor;
