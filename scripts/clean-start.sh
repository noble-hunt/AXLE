#!/bin/bash
# scripts/clean-start.sh
# Kill stale processes and start fresh

echo "[CLEAN] Killing stale processes..."
pkill -f "dev-server.pid" || true
pkill -f "tsx server/index.ts" || true

sleep 1

echo "[CLEAN] Starting server..."
npm run dev
