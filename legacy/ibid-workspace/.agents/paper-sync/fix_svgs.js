const fs = require('fs');
const path = require('path');

const iconsDir = path.join('/Users/alexsantos/Projects/SavvyJar', 'public/icons');
const files = fs.readdirSync(iconsDir).filter(f => f.endsWith('.svg'));

let updated = 0;
files.forEach(file => {
  const filePath = path.join(iconsDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Remove existing width, height and viewBox from the root <svg> tag
  content = content.replace(/<svg([^>]+)>/, (match, attrs) => {
    let newAttrs = attrs
      .replace(/\bwidth\s*=\s*"[^"]*"/g, '')
      .replace(/\bheight\s*=\s*"[^"]*"/g, '')
      .replace(/\bviewBox\s*=\s*"[^"]*"/g, '');
    return `<svg width="100%" height="100%" viewBox="0 0 512 512"${newAttrs}>`;
  });

  fs.writeFileSync(filePath, content);
  updated++;
});
console.log(`Updated ${updated} SVG files`);
