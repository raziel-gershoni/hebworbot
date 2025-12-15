# HebWorBot - Hebrew Learning Telegram Bot

A Telegram bot for Russian speakers learning Hebrew, powered by AI (Gemini) for intelligent level assessment and personalized vocabulary learning.

## Features

- **AI-Powered Level Assessment**: Gemini evaluates user's Hebrew proficiency (A1-C2 CEFR levels)
- **Personalized Vocabulary**: Daily word delivery based on user's level
- **Interactive Exercises**:
  - Multiple choice (Hebrew → Russian)
  - Reverse translation (Russian → Hebrew)
  - Flashcard review
- **Progress Tracking**: Adaptive learning system that tracks mastery
- **Serverless Architecture**: Deployed on Vercel with Neon PostgreSQL

## Tech Stack

- **Bot Framework**: [grammY](https://grammy.dev/) - Modern Telegram bot framework optimized for serverless
- **AI**: Google Gemini API with structured JSON outputs
- **Database**: Neon PostgreSQL (serverless with HTTP connections)
- **Runtime**: Node.js 20+ with TypeScript
- **Deployment**: Vercel Serverless Functions (webhooks)
- **Validation**: Zod for type-safe schemas

## Project Structure

```
hebworbot/
├── api/
│   └── webhook.ts                    # Vercel serverless function
├── src/
│   ├── bot/                          # Bot logic
│   │   ├── handlers/                 # Command and callback handlers
│   │   ├── conversations/            # Conversation flows
│   │   └── keyboards/                # Inline keyboards
│   ├── services/
│   │   ├── gemini/                   # Gemini AI integration
│   │   ├── database/                 # Neon PostgreSQL client
│   │   └── vocabulary/               # Vocabulary management
│   ├── types/                        # TypeScript types
│   └── utils/                        # Utilities
├── data/                             # Vocabulary data
└── scripts/                          # Setup and seed scripts
```

## Setup Instructions

### Prerequisites

1. **Node.js 20+** installed
2. **Telegram Bot Token** - Get from [@BotFather](https://t.me/BotFather)
3. **Gemini API Key** - Get from [Google AI Studio](https://aistudio.google.com/app/apikey)
4. **Neon PostgreSQL** - Create free account at [neon.tech](https://neon.tech)
5. **Vercel Account** - For deployment

### Installation

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill in your credentials:
```bash
cp .env.example .env.local
```

3. Update `.env.local` with:
   - `TELEGRAM_BOT_TOKEN` - Your Telegram bot token
   - `GEMINI_API_KEY` - Your Gemini API key
   - `DATABASE_URL` - Your Neon PostgreSQL connection string (use pooled connection ending with `-pooler`)
   - `GEMINI_MODEL` - Model to use (test both `gemini-2.5-flash` and `gemini-3.0`)

### Database Setup

1. Run database migrations:
```bash
npm run migrate
```

2. Prepare Hebrew vocabulary (download and format):
```bash
npm run prepare-vocabulary
```

3. Seed database with Gemini-translated words:
```bash
npm run seed-database
```

### Testing Gemini Models

Compare Gemini 2.5 Flash vs 3.0:
```bash
npm run test-gemini-models
```

This will test both models for:
- Translation quality (Hebrew → Russian)
- Assessment accuracy
- Response latency
- Structured output reliability

### Development

Run local development server:
```bash
npm run dev
```

Use [ngrok](https://ngrok.com/) to expose your local server for webhook testing:
```bash
ngrok http 3000
```

Then set the webhook (update WEBHOOK_URL in .env.local first):
```bash
npm run set-webhook
```

### Deployment

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy to Vercel:
```bash
vercel --prod
```

3. Set environment variables in Vercel dashboard
4. Set production webhook:
```bash
npm run set-webhook
```

## Bot Usage

1. Start the bot: `/start`
2. Complete level assessment (7 AI-generated questions)
3. Get your CEFR level assignment (A1-C2)
4. Receive daily Hebrew words with Russian translations
5. Practice with interactive exercises
6. Track your progress

## Database Schema

### Main Tables
- **users** - User profiles and current levels
- **vocabulary** - Hebrew words with Russian translations (10k words)
- **user_vocabulary** - Learning progress tracking
- **exercise_results** - Performance analytics
- **conversation_state** - Serverless session persistence

## Contributing

This is a personal learning project. Feel free to fork and adapt for your own use!

## License

MIT

## Resources

- [grammY Documentation](https://grammy.dev/)
- [Gemini API Structured Outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Neon Serverless Driver](https://github.com/neondatabase/serverless)
- [Teach Me Hebrew Frequency List](https://www.teachmehebrew.com/hebrew-frequency-list.html)

## TODO

See implementation plan at `.claude/plans/joyful-floating-walrus.md`
