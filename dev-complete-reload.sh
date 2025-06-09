#!/bin/bash

echo "Starting complete rebuild and reload..."

# Create a timestamp file to verify build
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
echo "Build timestamp: $TIMESTAMP" > build-verification.txt

# --- API Key Setup ---
echo "Setting up API key..."

# Set the development API key from environment variable
# For development, set OPENAI_API_KEY in your environment or .env file
# OPENAI_API_KEY will be loaded from .env file below if present

# Try to load from .env file first (can override the default if present)
if [ -f ".env" ]; then
    echo "Loading environment variables from .env file..."
    export $(grep -v '^#' .env | xargs)
fi

# Update data.json with the API key
if [ ! -z "$OPENAI_API_KEY" ]; then
    echo "Updating API key in data.json..."
    # Create a temporary Node.js script to update the JSON
    node -e "
const fs = require('fs');

try {
    // Read existing data.json
    const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
    
    // Update the OpenAI API key
    data.openAiApiKey = process.env.OPENAI_API_KEY || '$OPENAI_API_KEY';
    
    // Write back to data.json
    fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
    
    console.log('API key updated successfully in data.json');
} catch (error) {
    console.error('Error updating API key:', error.message);
    console.log('You may need to set it manually in Obsidian settings');
}
" OPENAI_API_KEY="$OPENAI_API_KEY"
else
    echo "No API key provided, skipping API key setup"
fi

# --- Build Steps (Updated) ---
echo "Running TypeScript check..."
npx tsc --noEmit # Check for type errors first (as per plan)
if [ $? -ne 0 ]; then
  echo "TypeScript check failed! Aborting build."
  exit 1
fi

echo "Building plugin for development..."
node esbuild.config.mjs
if [ $? -ne 0 ]; then
  echo "esbuild failed! Aborting build."
  exit 1
fi
# --- End Build Steps ---

# Copy the built JS and CSS
echo "Copying files..."
cp build/main.js .
cp src/styles/chat.css ./styles.css

echo "Build complete, preparing to restart Obsidian..."

# Force quit Obsidian
echo "Closing Obsidian..."
osascript -e 'tell application "Obsidian" to quit'
sleep 5

# Clear caches (optional but can help with stubborn issues)
echo "Clearing plugin caches..."
find /Users/philipsfeng/Library/Application\ Support/obsidian/plugins/notechat -name ".hot-update.*" -delete 2>/dev/null

# Restart Obsidian
echo "Restarting Obsidian..."
open -a Obsidian

echo "Waiting for Obsidian to start..."
sleep 10

echo "Done! Rebuild completed at $TIMESTAMP with API key configured"
echo "Please check build-verification.txt to confirm this was the last build run." 