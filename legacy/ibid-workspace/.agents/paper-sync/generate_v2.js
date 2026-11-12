const fs = require('fs');
const path = require('path');

const ICONS_DIR = '/Users/alexsantos/Projects/SavvyJar/public/icons';

function getSvgContent(iconName) {
  try {
    const content = fs.readFileSync(path.join(ICONS_DIR, `${iconName}.svg`), 'utf8');
    // Extract inner content of <svg>
    const inner = content.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
    return inner ? inner[1].trim() : '';
  } catch (e) {
    console.error(`Missing icon: ${iconName}`);
    return '';
  }
}

function buildSvg(iconName, width, height, color) {
  const inner = getSvgContent(iconName);
  return `<div style="width:${width}px; height:${height}px; flex-shrink:0;">
    <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:100%;">
      <g style="color: ${color}; fill: currentColor;">
        ${inner}
      </g>
    </svg>
  </div>`;
}

// Replicate the exact Sidenav from the screenshot
function generateSidenav() {
  const html = `
<div style="width:280px; height:100%; min-height:800px; display:flex; flex-direction:column; background-color:#F1EFE8; padding:24px 16px 16px 16px; box-sizing:border-box; border-right:1px solid #E5E3DC; border-radius: 0 16px 16px 0;">

  <div style="display:flex; flex-direction:column; gap:24px; margin-bottom:24px;">
    
    <div style="display:flex; align-items:flex-end; gap:10px;">
      ${buildSvg('savvyjar', 66, 66, 'var(--color-text)')}
    </div>
    
    <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-radius:12px; background:rgba(0,0,0,0.04);">
      <div style="display:flex; align-items:center; gap:12px;">
        ${buildSvg('add', 24, 24, 'var(--color-text)')}
        <div style="display:flex; flex-direction:column;">
          <span style="font-family:Inter, sans-serif; font-size:14px; font-weight:600; color:var(--color-text);">Criar Conta</span>
          <span style="font-family:Inter, sans-serif; font-size:14px; font-weight:600; color:var(--color-text);">Importar Extrato</span>
        </div>
      </div>
      <div style="background:#fff; border-radius:8px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border:1px solid #E5E3DC;">
        ${buildSvg('chevron-left', 16, 16, 'var(--color-text)')}
      </div>
    </div>
  </div>

  <div style="display:flex; flex-direction:column; gap:8px; padding-bottom:24px; margin-bottom:8px; border-bottom:1px solid #E5E3DC;">
    <div style="display:flex; align-items:center; justify-content:space-between; padding:12px; border-radius:8px; border:1px solid #E5E3DC; background:#fff;">
      <span style="font-family:Inter, sans-serif; font-size:14px; font-weight:500; color:var(--color-text);">Mês Atual</span>
      ${buildSvg('chevron-down', 16, 16, '#8A8A85')}
    </div>
    <div style="display:flex; align-items:center; justify-content:space-between; padding:12px; border-radius:8px; border:1px solid #E5E3DC; background:#fff;">
      <span style="font-family:Inter, sans-serif; font-size:14px; font-weight:500; color:var(--color-text);">28/07/2026 – 28/08/2026</span>
      ${buildSvg('interest-rate-calendar', 20, 20, 'var(--color-text)')}
    </div>
  </div>

  <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
    <div style="display:flex; align-items:center; gap:12px; padding:12px; border-radius:12px; background:rgba(0,0,0,0.06);">
      ${buildSvg('grid', 34, 34, 'var(--color-text)')}
      <span style="font-family:Inter, sans-serif; font-size:16px; font-weight:600; color:var(--color-text); flex:1;">Categorias</span>
      ${buildSvg('chevron-down', 16, 16, '#8A8A85')}
    </div>
    
    <div style="display:flex; align-items:center; gap:12px; padding:12px; border-radius:12px;">
      ${buildSvg('piggy-bank', 34, 34, 'var(--color-text)')}
      <span style="font-family:Inter, sans-serif; font-size:16px; font-weight:600; color:var(--color-text);">Orçamento</span>
    </div>
    
    <div style="display:flex; align-items:center; gap:12px; padding:12px; border-radius:12px;">
      ${buildSvg('movements', 34, 34, 'var(--color-text)')}
      <span style="font-family:Inter, sans-serif; font-size:16px; font-weight:600; color:var(--color-text);">Movimentos</span>
    </div>
  </div>

  <div style="display:flex; flex-direction:column; gap:4px; padding-top:24px; border-top:1px solid #E5E3DC;">
    <div style="display:flex; align-items:center; gap:12px; padding:12px; border-radius:12px;">
      <span style="width:34px; height:34px;"></span>
      <span style="font-family:Inter, sans-serif; font-size:14px; font-weight:600; color:var(--color-text);">Gerir Categorias</span>
    </div>
    
    <div style="display:flex; align-items:center; gap:12px; padding:12px; border-radius:12px;">
      <span style="width:34px; height:34px;"></span>
      <span style="font-family:Inter, sans-serif; font-size:14px; font-weight:600; color:var(--color-text); flex:1;">Definições</span>
      ${buildSvg('chevron-down', 16, 16, '#8A8A85')}
    </div>
    
    <div style="display:flex; align-items:center; gap:12px; padding:12px; border-radius:12px;">
      <span style="width:34px; height:34px;"></span>
      <span style="font-family:Inter, sans-serif; font-size:14px; font-weight:600; color:var(--color-text);">Português (PT)</span>
    </div>
  </div>

</div>`;
  fs.writeFileSync(path.join(__dirname, 'sidenav_v2.html'), html);
  console.log('sidenav_v2.html written.');
}

// Replicate the exact Header from the screenshot
function generateHeader() {
  const html = `
<div style="width:800px; padding:16px; display:flex; flex-direction:column; background:rgba(241, 239, 232, 0.95); backdrop-filter:blur(10px); gap:16px;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start;">
    <div style="display:flex; align-items:flex-end; gap:8px;">
      <div style="background:#fff; border-radius:12px; width:46px; height:46px; display:flex; align-items:center; justify-content:center; border:1px solid #E5E3DC;">
        ${buildSvg('chevron-right', 20, 20, 'var(--color-text)')}
      </div>
      <div style="background:#fff; border-radius:12px; width:46px; height:46px; display:flex; align-items:center; justify-content:center; border:1px solid #E5E3DC;">
        ${buildSvg('add', 24, 24, 'var(--color-text)')}
      </div>
      <div style="margin-left:8px;">
        ${buildSvg('savvyjar', 66, 66, 'var(--color-text)')}
      </div>
    </div>

    <div style="display:flex; flex-direction:column; gap:8px;">
      <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 16px; border-radius:8px; border:1px solid #E5E3DC; background:#fff; width:220px;">
        <span style="font-family:Inter, sans-serif; font-size:14px; font-weight:500; color:var(--color-text);">Mês Atual</span>
        ${buildSvg('chevron-down', 16, 16, '#8A8A85')}
      </div>
      <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 16px; border-radius:8px; border:1px solid #E5E3DC; background:#fff; width:220px;">
        <span style="font-family:Inter, sans-serif; font-size:14px; font-weight:500; color:var(--color-text);">28/07/2026 – 28/08/2026</span>
        ${buildSvg('interest-rate-calendar', 20, 20, 'var(--color-text)')}
      </div>
    </div>
  </div>

  <div style="display:flex; flex-direction:column; align-items:center; margin-top:-30px;">
    <div style="width:400px; height:10px; background:#FBEAF0; border-radius:16px 16px 0 0; margin-bottom:-5px;"></div>
    <div style="width:420px; height:10px; background:#E1F5EE; border-radius:16px 16px 0 0; margin-bottom:-5px;"></div>
    <div style="width:440px; background:#FAEEDA; border:1px solid #EF9F27; border-radius:16px; padding:16px; display:flex; align-items:center; gap:16px; box-shadow:0 12px 24px rgba(0,0,0,0.05); z-index:2;">
      <div style="width:40px; height:40px; background:#EF9F27; border-radius:50%; display:flex; align-items:center; justify-content:center;">
        ${buildSvg('list-bulleted', 24, 24, '#fff')}
      </div>
      <div style="display:flex; flex-direction:column; flex:1;">
        <span style="font-family:Inter, sans-serif; font-size:16px; font-weight:600; color:#633806;">Tens 1645 movimentos por rever</span>
        <span style="font-family:Inter, sans-serif; font-size:14px; font-weight:400; color:#633806;">Confirma a categoria antes de fechares ...</span>
      </div>
      <div style="width:28px; height:28px; background:rgba(0,0,0,0.05); border-radius:50%; display:flex; align-items:center; justify-content:center;">
        ${buildSvg('close', 16, 16, '#633806')}
      </div>
    </div>
    
    <div style="display:flex; gap:6px; margin-top:12px;">
      <div style="width:24px; height:6px; background:#F0997B; border-radius:3px;"></div>
      <div style="width:6px; height:6px; background:#E5E3DC; border-radius:3px;"></div>
      <div style="width:6px; height:6px; background:#E5E3DC; border-radius:3px;"></div>
      <div style="width:6px; height:6px; background:#E5E3DC; border-radius:3px;"></div>
      <div style="width:6px; height:6px; background:#E5E3DC; border-radius:3px;"></div>
    </div>
  </div>
</div>`;
  fs.writeFileSync(path.join(__dirname, 'header_v2.html'), html);
  console.log('header_v2.html written.');
}

generateSidenav();
generateHeader();
