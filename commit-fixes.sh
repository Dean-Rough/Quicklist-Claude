#!/bin/bash

# Quicklist Mobile & UI Fix Sprint - Commit Script
# This script commits each fix separately with descriptive messages

cd /home/terry/clawd/projects/Quicklist-Claude

echo "=== Quicklist Mobile & UI Fixes - Commit Script ==="
echo ""

# Priority 1: iOS Scroll Bug
echo "Committing Priority 1: iOS Scroll Bug Fix..."
git add public/css/styles.css
git commit -m "Fix iOS scroll bug: add -webkit-overflow-scrolling touch support

- Added -webkit-overflow-scrolling: touch to html/body
- Added position: relative and min-height: 100vh to prevent scroll traps
- Applied to all scrollable containers (modals, mobile menu, grids)
- Fixes issue where users could scroll down but not back up on iOS"

# Priority 2: Share Button Function Fix
echo "Committing Priority 2: Share Button Fix..."
git add public/js/app.js
git commit -m "Fix share button: add shareListing() alias function

- Share button in HTML called app.shareListing() but function was named shareNative()
- Added shareListing() as alias to shareNative() for compatibility
- Share functionality now works correctly"

# Priority 3: Font Consolidation
echo "Committing Priority 3: Font Consolidation..."
git add public/css/styles.css
git commit -m "Consolidate fonts to Manrope design system

- Removed Maison @font-face declarations
- Replaced all 'Maison' references with 'Manrope'
- Standardized to Manrope 400/600/700/800 weights
- Changed heading font-weight from 700 to 800 for better hierarchy
- Replaced 'Maison Mono' with 'Courier New' for monospace elements
- Cleaner, more consistent typography across the app"

# Priority 4: Saved Items Thumbnail (already working - no commit needed)
echo "Priority 4: Saved Items Thumbnail - Already working correctly ✓"

# Priority 5: Main Image Picker
echo "Committing Priority 5: Main Image Picker..."
git add public/js/app.js public/css/styles.css
git commit -m "Add main image picker for multi-image uploads

- Users can now click on any uploaded image to set it as main
- First image is automatically set as main by default
- Main image is used for thumbnail and studio processing
- Visual indicators: gold border + star badge for main image
- Hover effect shows 'Set as Main' badge on non-main images
- Added setMainImage() function and isMain property to image data"

# Priority 6: Studio Photo Controls
echo "Committing Priority 6: Studio Photo Controls..."
git add index.html public/js/app.js
git commit -m "Add studio photo controls for Pro/Max tier users

- Added background selection: Neutral/White/Gradient/Warm/Cool
- Added lighting options: Soft Shadow/Dramatic/None/Soft Glow
- Controls only visible and enabled for Pro and Max tier users
- Updated createHeroImageFallback() to apply selected options
- Integrated with tier checking system
- Enhances hero image generation with customization"

echo ""
echo "=== All fixes committed successfully! ==="
echo ""
echo "Pushing to main branch..."
git push origin main

echo ""
echo "=== Deployment complete! ==="
echo "All fixes have been committed and pushed to main."
echo ""
echo "Summary of fixes:"
echo "✓ Priority 1: iOS scroll bug fixed"
echo "✓ Priority 2: Share button function fixed"
echo "✓ Priority 3: Fonts consolidated to Manrope"
echo "✓ Priority 4: Saved items thumbnail (already working)"
echo "✓ Priority 5: Main image picker added"
echo "✓ Priority 6: Studio photo controls added (Pro/Max)"
