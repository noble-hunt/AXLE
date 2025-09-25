#!/bin/bash

# Kill any existing processes on ports 5000 and 5173
echo "🧹 Cleaning up existing processes..."
pkill -f "tsx server/index.ts" || true
pkill -f "vite --host" || true

# Wait a moment for processes to clean up
sleep 2

# Clear Vite cache
echo "🧹 Clearing Vite cache..."
rm -rf node_modules/.vite client/node_modules/.vite || true

echo "🚀 Starting development servers..."

# Start the server in background
echo "📡 Starting Express server on port 5000..."
NODE_ENV=development npx tsx server/index.ts &
SERVER_PID=$!

# Wait a moment for server to start
sleep 3

# Start the client dev server
echo "⚡ Starting Vite dev server on port 5173..."
npx vite --host 0.0.0.0 --port 5173 &
CLIENT_PID=$!

# Function to clean up background processes on exit
cleanup() {
    echo "🛑 Shutting down servers..."
    kill $SERVER_PID $CLIENT_PID 2>/dev/null || true
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup EXIT INT TERM

echo "✅ Both servers are starting..."
echo "📡 Server: http://localhost:5000"
echo "⚡ Client: http://localhost:5173"
echo "🔗 Preview: Your Replit preview will show the combined app"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for both processes
wait