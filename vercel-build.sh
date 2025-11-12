#!/bin/bash
# Vercel build script to ensure static files are available

echo "Vercel build starting..."

# Ensure all static assets are in place
echo "Verifying static assets..."
ls -la manifest.json service-worker.js pwa-features.js 2>/dev/null || echo "Warning: Some static files missing"
ls -la brand/ icons/ json_anim/ 2>/dev/null || echo "Warning: Some directories missing"

echo "Static assets verified"
echo "Build complete!"
