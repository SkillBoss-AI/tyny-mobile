#!/usr/bin/env node
/**
 * generate-assets.js
 *
 * Regenerates app icons and splash screens from assets/images/logo.svg.
 *
 * Requirements:
 *   npm install -g sharp-cli
 *   OR: brew install imagemagick  (then use `convert` command)
 *
 * Usage:
 *   node scripts/generate-assets.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ASSETS = path.join(__dirname, '..', 'assets', 'images');
const SVG = path.join(ASSETS, 'logo.svg');

// Check tools
let tool = null;
try { execSync('which convert', { stdio: 'ignore' }); tool = 'convert'; } catch {}
try { execSync('which sharp', { stdio: 'ignore' }); tool = 'sharp'; } catch {}
try { execSync('which rsvg-convert', { stdio: 'ignore' }); tool = 'rsvg'; } catch {}

if (!tool) {
  console.error('No image conversion tool found. Install one of:');
  console.error('  brew install imagemagick   (macOS)');
  console.error('  apt-get install librsvg2-bin   (Linux)');
  process.exit(1);
}

const ICON_SIZES = [
  { file: 'icon.png',          size: 1024, bg: '#000000' },
  { file: 'adaptive-icon.png', size: 1024, bg: '#1b4d2e' },
  { file: 'splash.png',        size: 1284, height: 2778, bg: '#000000' },
  { file: 'favicon.png',       size: 32,   bg: '#000000' },
];

for (const { file, size, height, bg } of ICON_SIZES) {
  const out = path.join(ASSETS, file);
  const h = height || size;

  if (tool === 'convert') {
    // ImageMagick: place SVG centered on colored background
    const padding = Math.round(size * 0.15);
    const inner = size - padding * 2;
    execSync(
      `convert -size ${size}x${h} xc:"${bg}" ` +
      `\\( "${SVG}" -resize ${inner}x${inner} -background none \\) ` +
      `-gravity center -composite "${out}"`
    );
  } else if (tool === 'rsvg') {
    execSync(`rsvg-convert -w ${size} -h ${h} "${SVG}" -o "${out}"`);
  }

  console.log(`Generated ${file}`);
}

console.log('Done! All assets regenerated from logo.svg');
