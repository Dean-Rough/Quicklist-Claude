#!/usr/bin/env node

/**
 * Generate placeholder PWA icons
 * This creates simple PNG placeholders - replace with branded icons later
 */

const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '../public/icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create a simple SVG icon template
function createSVGIcon(size) {
  const gradient = `
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#059669;stop-opacity:1" />
      </linearGradient>
    </defs>
  `;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  ${gradient}
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#grad)"/>
  <text 
    x="50%" 
    y="50%" 
    font-family="Arial, sans-serif" 
    font-size="${size * 0.5}" 
    font-weight="bold" 
    fill="white" 
    text-anchor="middle" 
    dominant-baseline="middle"
  >Q</text>
</svg>`;
}

// Generate icons
sizes.forEach((size) => {
  const svgContent = createSVGIcon(size);
  const filename = `icon-${size}x${size}.png`;
  const svgFilename = `icon-${size}x${size}.svg`;

  // Save SVG version
  const svgPath = path.join(iconsDir, svgFilename);
  fs.writeFileSync(svgPath, svgContent);
  console.log(`✓ Created ${svgFilename}`);
});

// Also create the older format icons referenced in the HTML
const legacySizes = [
  { size: 16, name: 'icon-16.png' },
  { size: 32, name: 'icon-32.png' },
  { size: 144, name: 'icon-144.png' },
  { size: 152, name: 'icon-152.png' },
];

legacySizes.forEach(({ size, name }) => {
  const svgContent = createSVGIcon(size);
  const svgName = name.replace('.png', '.svg');
  const svgPath = path.join(iconsDir, svgName);
  fs.writeFileSync(svgPath, svgContent);
  console.log(`✓ Created ${svgName}`);
});

console.log('\n✨ PWA icons generated successfully!');
console.log('📝 Note: These are SVG placeholders. Replace with branded PNG icons later.');
console.log(
  '💡 Tip: Use https://realfavicongenerator.net/ or https://www.pwabuilder.com/ to generate production icons'
);
