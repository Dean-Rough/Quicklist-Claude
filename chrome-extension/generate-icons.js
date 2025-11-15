#!/usr/bin/env node

/**
 * Generate Chrome Extension icons from QuickList SVG logo
 * Requires: sharp (npm install sharp --save-dev)
 */

const fs = require('fs');
const path = require('path');

// Try to load sharp
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Sharp not installed. Run: npm install sharp --save-dev');
  process.exit(1);
}

const sizes = [16, 32, 48, 128];
const sourceSvg = path.join(__dirname, '../brand/SVG/QL-Light.svg');
const outputDir = path.join(__dirname, 'icons');

async function generateIcons() {
  console.log('Reading SVG from:', sourceSvg);
  const svgContent = fs.readFileSync(sourceSvg, 'utf8');

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}.png`);

    await sharp(Buffer.from(svgContent))
      .resize(size, size, {
        fit: 'contain',
        background: { r: 79, g: 70, b: 229, alpha: 1 },
      })
      .png()
      .toFile(outputPath);

    console.log(`✓ Created icon-${size}.png`);
  }
}

generateIcons().catch(console.error);
