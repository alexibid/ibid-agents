const fs = require('fs');
const path = require('path');

function getSvg(name) {
  const p = path.join('/Users/alexsantos/Projects/SavvyJar/public/icons', name + '.svg');
  if (!fs.existsSync(p)) return '';
  let content = fs.readFileSync(p, 'utf8');
  // strip width/height and add standard attributes
  content = content.replace(/width="[^"]+"/, '').replace(/height="[^"]+"/, '');
  content = content.replace('<svg', `<svg style="width:100%; height:100%; flex-shrink:0;"`);
  return content;
}

const headerHtml = `
<div style="width:390px; height:90px; display:flex; align-items:center; justify-content:space-between; padding:24px 16px; background:transparent; box-sizing:border-box;">
  <div style="display:flex; align-items:center; gap:8px;">
    <!-- Sidenav Toggle (nav) -->
    <button style="width:42px; height:42px; border-radius:12px; background:var(--color-surface,#fff); border:1px solid var(--color-border,#e5e3dc); display:flex; align-items:center; justify-content:center; cursor:pointer;">
      <div style="width:24px; height:24px;">${getSvg('chevron-right')}</div>
    </button>
    
    <!-- Add Button -->
    <button style="width:42px; height:42px; border-radius:12px; background:var(--color-text,#2c2c2a); border:none; display:flex; align-items:center; justify-content:center; cursor:pointer;">
      <div style="width:24px; height:24px; color:var(--color-surface,#fff); fill:currentColor;">${getSvg('add')}</div>
    </button>
    
    <!-- Logo (when !isSidenavOpen) -->
    <a style="display:block; width:42px; height:42px; margin-left:8px;">
      ${getSvg('savvyjar')}
    </a>
  </div>
  
  <div style="display:flex; align-items:center; gap:8px;">
    <!-- Date selector -->
    <div style="display:flex; align-items:center; justify-content:space-between; padding:9px 12px; border-radius:8px; border:1px solid var(--color-border,#e5e3dc); background:var(--color-surface,#fff); gap:6px;">
      <span style="font-family:var(--font-sans,sans-serif); font-size:12px; font-weight:500; color:var(--color-text,#2c2c2a); flex:1;">mês atual</span>
      <div style="width:12px; height:12px;">${getSvg('chevron-down')}</div>
    </div>
    <div style="display:flex; align-items:center; padding:9px 12px; border-radius:8px; border:1px solid var(--color-border,#e5e3dc); background:var(--color-surface,#fff); gap:6px;">
      <div style="width:14px; height:14px;">${getSvg('calendar')}</div>
      <span style="font-family:var(--font-ui,sans-serif); font-size:12px; font-weight:500; color:var(--color-text,#2c2c2a); white-space:nowrap;">1 ago – 31 ago</span>
    </div>
  </div>
</div>
`;

const sidenavHtml = `
<div style="width:280px; height:100%; display:flex; flex-direction:column; background:var(--color-bg, #F1EFE8); box-sizing:border-box; padding:104px 16px 16px 16px; backdrop-filter:blur(10px);">

  <!-- Cycle selector: preset + date range -->
  <div style="display:flex; flex-direction:column; gap:8px; padding-bottom:16px; margin-bottom:8px; border-bottom:1px solid var(--color-border,#e5e3dc);">
    <div style="display:flex; align-items:center; justify-content:space-between; padding:9px 12px; border-radius:8px; border:1px solid var(--color-border,#e5e3dc); background:var(--color-surface,#fff); gap:6px;">
      <span style="font-family:var(--font-sans,sans-serif); font-size:12px; font-weight:500; color:var(--color-text,#2c2c2a); flex:1;">mês atual</span>
      <div style="width:12px; height:12px;">${getSvg('chevron-down')}</div>
    </div>
    <div style="display:flex; align-items:center; padding:9px 12px; border-radius:8px; border:1px solid var(--color-border,#e5e3dc); background:var(--color-surface,#fff); gap:6px;">
      <div style="width:14px; height:14px;">${getSvg('calendar')}</div>
      <span style="font-family:var(--font-ui,sans-serif); font-size:12px; font-weight:500; color:var(--color-text,#2c2c2a); white-space:nowrap;">1 ago – 31 ago</span>
    </div>
  </div>

  <!-- Main nav -->
  <nav style="flex:1; overflow-y:auto; overflow-x:hidden;">
    <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:4px; width:100%;">

      <li style="display:flex; flex-direction:column;">
        <button style="display:flex; align-items:center; gap:12px; padding:8px; border-radius:12px; width:100%; box-sizing:border-box; background:transparent; border:none; cursor:pointer; text-align:left; color:var(--color-text,#2c2c2a);">
          <div style="width:34px; height:34px;">${getSvg('categories')}</div>
          <span style="font-family:var(--font-sans,sans-serif); font-size:14px; font-weight:500; line-height:18px; flex:1;">Categorias</span>
          <span style="font-size:12px; color:var(--color-text-muted,#8a8a85);">&#8250;</span>
        </button>
      </li>

      <li style="display:flex; flex-direction:column;">
        <a style="display:flex; align-items:center; gap:12px; padding:8px; border-radius:12px; text-decoration:none; color:var(--color-text,#2c2c2a);">
          <div style="width:34px; height:34px;">${getSvg('budget')}</div>
          <span style="font-family:var(--font-sans,sans-serif); font-size:14px; font-weight:500; line-height:18px;">Orçamentos</span>
        </a>
      </li>

      <li style="display:flex; flex-direction:column;">
        <a style="display:flex; align-items:center; gap:12px; padding:8px; border-radius:12px; text-decoration:none; color:var(--color-text,#2c2c2a);">
          <div style="width:34px; height:34px;">${getSvg('movements')}</div>
          <span style="font-family:var(--font-sans,sans-serif); font-size:14px; font-weight:500; line-height:18px;">Movimentos</span>
        </a>
      </li>

    </ul>
  </nav>

  <!-- Footer -->
  <footer style="display:flex; flex-direction:column; gap:2px; padding-top:12px; border-top:1px solid var(--color-border,#e5e3dc); flex-shrink:0;">

    <a style="display:flex; align-items:center; gap:12px; padding:8px; border-radius:12px; text-decoration:none; color:var(--color-text,#2c2c2a);">
      <div style="width:34px; height:34px;">${getSvg('manage-categories')}</div>
      <span style="font-family:var(--font-sans,sans-serif); font-size:14px; font-weight:500; line-height:18px;">Gerir Categorias</span>
    </a>

    <button style="display:flex; align-items:center; gap:12px; padding:8px; border-radius:12px; width:100%; box-sizing:border-box; background:transparent; border:none; cursor:pointer; text-align:left; color:var(--color-text,#2c2c2a);">
      <div style="width:34px; height:34px;">${getSvg('settings')}</div>
      <span style="font-family:var(--font-sans,sans-serif); font-size:14px; font-weight:500; line-height:18px; flex:1;">Definições</span>
      <span style="font-size:12px; color:var(--color-text-muted,#8a8a85);">&#8250;</span>
    </button>

    <button style="display:flex; align-items:center; gap:12px; padding:8px; border-radius:12px; width:100%; box-sizing:border-box; background:transparent; border:none; cursor:pointer; text-align:left; color:var(--color-text,#2c2c2a);">
      <div style="width:34px; height:34px;">${getSvg('language')}</div>
      <span style="font-family:var(--font-sans,sans-serif); font-size:14px; font-weight:500; line-height:18px;">Português (PT)</span>
    </button>

  </footer>
</div>
`;

fs.writeFileSync('/Users/alexsantos/Projects/SavvyJar/header.html', headerHtml);
fs.writeFileSync('/Users/alexsantos/Projects/SavvyJar/sidenav.html', sidenavHtml);
console.log('Generated header.html and sidenav.html');
