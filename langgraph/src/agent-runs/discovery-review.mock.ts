import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const sheetOf = (project: string, discoveryRow: string) => `# ${project}

| Field | Value |
| --- | --- |
| Path | \`apps/${project}\` |
| Nx project | \`${project}\` |
| Commit scope | \`${project}\` |
${discoveryRow}

## Mandatory steps

| Step | When |
| --- | --- |
| \`plan\`, \`implement\` | \`always\` |
`;

const SEO_RULES = `# SEO rules

## Rules

| Id | Category | Rule | Checked by |
| --- | --- | --- | --- |
| SEO15 | SEO | hreflang | graph |
| SEO16 | SEO | h1 | metadata |
`;

const ASO_RULES = `# ASO rules

## Rules

None yet.
`;

export async function writeMockRules(root: string): Promise<void> {
  await mkdir(join(root, 'projects'), { recursive: true });
  await mkdir(join(root, 'discovery'), { recursive: true });
  await Promise.all([
    writeFile(join(root, 'projects', 'web.md'), sheetOf('web', '| Discovery | `seo` |')),
    writeFile(join(root, 'projects', 'phone.md'), sheetOf('phone', '| Discovery | `aso` |')),
    writeFile(join(root, 'projects', 'tool.md'), sheetOf('tool', '')),
    writeFile(join(root, 'discovery', 'seo.md'), SEO_RULES),
    writeFile(join(root, 'discovery', 'aso.md'), ASO_RULES),
  ]);
}

export const webReview = [{ project: 'web', discovery: 'seo', rules: ['SEO15'], reason: 'The epic adds translated pages.' }];

export const draftFor = (storyBody: string) => ({
  id: 'translated-pages',
  project: 'web',
  items: [
    { key: 'Epic', kind: 'epic', title: 'Translated pages', body: 'Pages in every language.', size: 'L', repository: 'owner/web' },
    { key: 'S1', kind: 'story', title: 'German pages', body: storyBody, size: 'M', repository: 'owner/web', parent: 'Epic' },
  ],
});
