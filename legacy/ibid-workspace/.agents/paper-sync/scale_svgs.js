const fs = require('fs');
const path = require('path');
const svgPathBboxLib = require('svg-path-bbox'); 
const svgPathBbox = svgPathBboxLib.svgPathBbox || svgPathBboxLib.default || svgPathBboxLib;

const iconsDir = path.join('/Users/alexsantos/Projects/SavvyJar', 'public/icons');
const files = fs.readdirSync(iconsDir).filter(f => f.endsWith('.svg'));

let updated = 0;
files.forEach(file => {
  const filePath = path.join(iconsDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Find all <path d="..."> and <polygon points="..."> to compute bbox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  const pathRegex = /<path[^>]*d="([^"]+)"/g;
  let match;
  while ((match = pathRegex.exec(content)) !== null) {
    try {
      const bbox = svgPathBbox(match[1]);
      if (bbox[0] < minX) minX = bbox[0];
      if (bbox[1] < minY) minY = bbox[1];
      if (bbox[2] > maxX) maxX = bbox[2];
      if (bbox[3] > maxY) maxY = bbox[3];
    } catch (e) {
      console.log(`Error parsing path in ${file}`);
    }
  }

  // If there are other shapes like circle, rect, we ignore for now, assuming icons are mostly paths.
  
  if (minX === Infinity) {
    console.log(`No paths found in ${file}, skipping scaling.`);
    return;
  }

  const currentWidth = maxX - minX;
  const currentHeight = maxY - minY;
  
  if (currentWidth <= 0 || currentHeight <= 0) return;

  const targetSize = 512;
  const padding = 0; // if we want some padding
  const availableSize = targetSize - (padding * 2);

  const scale = availableSize / Math.max(currentWidth, currentHeight);
  const scaledWidth = currentWidth * scale;
  const scaledHeight = currentHeight * scale;
  
  const tx = padding + (availableSize - scaledWidth) / 2 - (minX * scale);
  const ty = padding + (availableSize - scaledHeight) / 2 - (minY * scale);
  
  // Extract inner content
  let innerMatch = content.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  if (!innerMatch) return;
  
  // We should remove any existing <g transform="..."> we might have added previously, 
  // but since we extract everything, if we nest it again, it's fine. 
  // Better yet, just wrap the whole thing.
  
  let innerContent = innerMatch[1];
  
  let newSvg = `<svg width="100%" height="100%" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <g transform="matrix(${scale}, 0, 0, ${scale}, ${tx}, ${ty})">
    ${innerContent.trim()}
  </g>
</svg>`;

  fs.writeFileSync(filePath, newSvg);
  updated++;
});
console.log(`Updated and scaled ${updated} SVG files`);
