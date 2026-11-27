import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ProjectSheet } from '../../domain/sheet.js';
import { completePageHtml, englishCareer, portugueseCareer, robotsWithSitemap } from './seo-pages.mock.js';

export const SITE_SHEET_MARKDOWN = `# site

| Field | Value |
| --- | --- |
| Discovery | \`seo\` |

## SEO audit

| Field | Value |
| --- | --- |
| \`pages\` | \`dist/site/browser\` |
| \`routes\` | \`dist/site/prerendered-routes.json\` |
| \`hosting\` | \`firebase.json\` |
| \`templates\` | \`apps/site/src/app\` |
| \`page sources\` | \`apps/site/src/index.html\`, \`firebase.json\` |
`;

export const healthyHosting = {
  hosting: [
    {
      public: 'dist/site/browser',
      trailingSlash: false,
      headers: [{ source: '/pages/**', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] }],
    },
  ],
};

export const catchAllHosting = {
  hosting: [{ public: 'dist/site/browser', trailingSlash: false, rewrites: [{ source: '**', destination: '/index.html' }] }],
};

export function siteSheet(root: string): ProjectSheet {
  return {
    project: 'site',
    path: 'apps/site',
    commitScope: 'site',
    sheetFile: join(root, 'site.md'),
    reuses: [],
    specialist: 'agents/specialist.md',
    agents: [],
    triggers: [],
    mandatorySteps: [{ step: 'seo-audit', when: 'always' }],
    commands: {},
    discovery: 'seo',
  };
}

export async function writeMockSite(root: string, hosting: unknown): Promise<void> {
  const files: Readonly<Record<string, string>> = {
    'site.md': SITE_SHEET_MARKDOWN,
    'firebase.json': JSON.stringify(hosting),
    'dist/site/prerendered-routes.json': JSON.stringify({ routes: { [englishCareer.path]: {}, [portugueseCareer.path]: {} } }),
    [`dist/site/browser${englishCareer.path}/index.html`]: completePageHtml(englishCareer),
    [`dist/site/browser${portugueseCareer.path}/index.html`]: completePageHtml(portugueseCareer),
    'dist/site/browser/robots.txt': robotsWithSitemap,
    'dist/site/browser/llms.txt': '# Site\n',
    'dist/site/browser/404.html': '<html lang="en"></html>',
    'apps/site/src/app/cover.html': '<img [ngSrc]="cover" alt="Cover" priority>',
  };
  await Promise.all(
    Object.entries(files).map(async ([file, content]) => {
      await mkdir(dirname(join(root, file)), { recursive: true });
      await writeFile(join(root, file), content);
    }),
  );
}
