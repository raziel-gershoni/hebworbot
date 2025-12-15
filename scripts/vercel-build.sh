#!/bin/bash
# Vercel Build Script - Runs on every deployment

echo "🔨 Building TypeScript..."
npm run build

echo ""
echo "🗄️  Running database migration..."
npm run migrate

echo ""
echo "✅ Build complete!"
