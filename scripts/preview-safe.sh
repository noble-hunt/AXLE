#!/bin/bash
# scripts/preview-safe.sh - Safe build and preview with leak detection

echo "🔨 Building application for preview..."
vite build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "🔍 Checking for secret leaks..."
node scripts/leak-check.cjs

if [ $? -ne 0 ]; then
    echo "❌ Preview aborted due to security issues"
    exit 1
fi

echo "🚀 Starting preview server..."
vite preview