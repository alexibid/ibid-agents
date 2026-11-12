const fs = require('fs');
const { execSync } = require('child_process');

function inject(file, targetId) {
  const html = fs.readFileSync(file, 'utf8');
  const payload = {
    targetNodeId: targetId,
    mode: "insert-children",
    html: html
  };
  
  // Create a temporary JSON file to avoid bash escaping hell
  const tmpFile = file + '.json';
  fs.writeFileSync(tmpFile, JSON.stringify(payload));
  
  try {
    const { execFileSync } = require('child_process');
    execFileSync('agy', ['mcp', 'call', 'paper', 'write_html', fs.readFileSync(tmpFile, 'utf8')], { stdio: 'inherit' });
    console.log(`Successfully injected ${file} into ${targetId}`);
  } catch (e) {
    console.error(`Failed to inject ${file}:`, e.message);
  }
}

inject('/Users/alexsantos/.gemini/antigravity/brain/ee87aba9-ef5e-4493-9f1f-df6e599d9da3/scratch/header_v2.html', 'LBE-0');
inject('/Users/alexsantos/.gemini/antigravity/brain/ee87aba9-ef5e-4493-9f1f-df6e599d9da3/scratch/sidenav_v2.html', 'LBF-0');
