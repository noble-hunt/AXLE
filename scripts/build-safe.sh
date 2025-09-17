#!/bin/bash
# scripts/build-safe.sh - Safe build with leak detection

echo "🔨 Building application..."
vite build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "🔍 Checking for secret leaks..."
node scripts/leak-check.cjs

if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully with no leaks detected"
else
    echo "❌ Build aborted due to security issues"
    exit 1
fi