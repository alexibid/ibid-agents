import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { catchAllHosting, healthyHosting, siteSheet, writeMockSite } from '../checks/seo/seo-site.mock.js';
import { seoAuditStep } from './seo-audit-step.js';

const changed = (...files: string[]) => files.map((file) => ({ repository: '.', file, alreadyDirty: false }));

describe('seoAuditStep', () => {
  let root = '';

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'seo-audit-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('should pass a site whose prerendered pages and hosting follow every rule', async () => {
    await writeMockSite(root, healthyHosting);

    const outcome = await seoAuditStep(changed('apps/site/src/index.html'), { workspaceRoot: root, sheet: siteSheet(root) });

    expect(outcome).toEqual({ result: expect.objectContaining({ passed: true, details: ['SEO audit PASS: 2 pages checked.'] }), followUps: [] });
  });

  it('should send the story back with the file and the fix when it touches a page source that breaks a rule', async () => {
    await writeMockSite(root, catchAllHosting);

    const { result } = await seoAuditStep(changed('firebase.json'), { workspaceRoot: root, sheet: siteSheet(root) });

    expect(result.passed).toBe(false);
    expect(result.details.join('\n')).toContain('[BLOCK SEO10 SEO] firebase.json: The rewrite "**" -> "/index.html" answers unknown URLs with 200.');
    expect(result.details.join('\n')).toContain('[BLOCK SEO12 SEO] firebase.json');
  });

  it('should only warn, and file a follow-up, for existing debt the story does not touch', async () => {
    await writeMockSite(root, catchAllHosting);

    const outcome = await seoAuditStep(changed('apps/site/src/app/book.service.ts'), { workspaceRoot: root, sheet: siteSheet(root) });

    expect(outcome.result.passed).toBe(true);
    expect(outcome.result.details).toEqual(['SEO audit WARN: 2 pages checked.']);
    expect(outcome.followUps.join('\n')).toContain('[WARN SEO10 SEO] firebase.json: Existing debt this story does not touch:');
  });

  it('should fail with the reason when the build left no prerendered routes', async () => {
    await writeMockSite(root, healthyHosting);
    await rm(join(root, 'dist/site/prerendered-routes.json'));

    const { result } = await seoAuditStep(changed('apps/site/src/index.html'), { workspaceRoot: root, sheet: siteSheet(root) });

    expect(result).toMatchObject({
      passed: false,
      details: ['The build left no prerendered routes at dist/site/prerendered-routes.json; the SEO audit needs the prerendered pages.'],
    });
  });
});
