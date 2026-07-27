#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
echo "=== Google Drive MCP Server Setup ==="
echo ""

if [ ! -f "$DIR/data/credentials.json" ]; then
  echo "ERROR: credentials.json not found at $DIR/data/credentials.json"
  exit 1
fi

CLIENT_ID=$(grep -o '"client_id": *"[^"]*"' "$DIR/data/credentials.json" | head -1 | cut -d'"' -f4)
CLIENT_SECRET=$(grep -o '"client_secret": *"[^"]*"' "$DIR/data/credentials.json" | head -1 | cut -d'"' -f4)

if [ "$CLIENT_ID" = "YOUR_CLIENT_ID.apps.googleusercontent.com" ] || [ "$CLIENT_ID" = "YOUR_CLIENT_ID" ]; then
  echo "First-time setup: you need Google Cloud credentials."
  echo ""
  echo "Steps:"
  echo "  1. Go to https://console.cloud.google.com/"
  echo "  2. Create a new project (or select existing)"
  echo "  3. Go to APIs & Services > Library"
  echo "     - Search for 'Google Drive API'"
  echo "     - Click Enable"
  echo "  4. Go to APIs & Services > Credentials"
  echo "     - Click 'Create Credentials' > 'OAuth client ID'"
  echo "     - Application type: 'Desktop app'"
  echo "     - Name: 'MCP Drive'"
  echo "     - Click Create"
  echo "  5. Click the download button (JSON) next to your new client"
  echo "  6. Save the downloaded file over:"
  echo "     $DIR/data/credentials.json"
  echo ""
  echo "Then run this script again."
  exit 1
fi

echo "Running OAuth authorization..."
node "$DIR/dist/index.js" 2>/dev/null &
SERVER_PID=$!
sleep 1

echo ""
echo "If a browser didn't open automatically, visit:"
echo "  http://localhost:3336/oauth/callback"
echo ""
echo "After authorizing, the server will save your token."
echo "You can then kill this process (Ctrl+C) and use the MCP server normally."
echo ""
wait $SERVER_PID 2>/dev/null || true
