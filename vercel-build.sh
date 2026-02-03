#!/bin/bash
# Vercel build script - copies static files to public/ directory

echo "Vercel build starting..."

# Create public directory
echo "Creating public directory..."
mkdir -p public

# Copy main HTML file
echo "Copying index.html..."
cp index.html public/

# Copy PWA files
echo "Copying PWA files..."
cp manifest.json public/ 2>/dev/null || echo "Warning: manifest.json not found"
cp service-worker.js public/ 2>/dev/null || echo "Warning: service-worker.js not found"
cp pwa-features.js public/ 2>/dev/null || echo "Warning: pwa-features.js not found"
cp offline.html public/ 2>/dev/null || echo "Warning: offline.html not found"

# Copy asset directories
echo "Copying brand assets..."
cp -r brand public/ 2>/dev/null || echo "Warning: brand/ directory not found"

echo "Copying icons..."
cp -r icons public/ 2>/dev/null || echo "Warning: icons/ directory not found"

echo "Copying Lottie animations..."
cp -r json_anim public/ 2>/dev/null || echo "Warning: json_anim/ directory not found"

# Verify copied files
echo "Verifying public directory contents..."
ls -la public/

echo "Build complete! Static assets ready in public/"
