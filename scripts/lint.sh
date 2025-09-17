#!/bin/bash
# scripts/lint.sh - Lint the client source code

echo "🔍 Linting client source code..."
eslint client/src --ext .ts,.tsx

if [ $? -eq 0 ]; then
    echo "✅ Lint passed"
else
    echo "❌ Lint failed"
    exit 1
fi