import { describe, expect, it } from 'vitest';
import { checkAssetOptimization } from './asset-optimization.js';
import { readHtml } from './html-tags.js';
import { rulesFound } from './seo-page.mock.js';
import { builtPageWithPreloads, templateWithImageDebt } from './seo-pages.mock.js';

describe('checkAssetOptimization', () => {
  it('should block an image without ngSrc or alt and a second prioritised image in one template', () => {
    const template = { filePath: 'apps/site/src/app/cover.html', document: readHtml(templateWithImageDebt) };

    const issues = checkAssetOptimization([], [template]);

    expect(rulesFound(issues)).toEqual(['BLOCK SEO18', 'BLOCK SEO17', 'BLOCK SEO18']);
    expect(issues.every(({ filePath }) => filePath === template.filePath)).toBe(true);
  });

  it('should block a non-critical preload and a second image preload, and warn on an image preload without high priority', () => {
    const page = { filePath: 'dist/site/browser/en/index.html', document: readHtml(builtPageWithPreloads) };

    expect(rulesFound(checkAssetOptimization([page], []))).toEqual(['BLOCK SEO02', 'BLOCK SEO02', 'WARN SEO02', 'BLOCK SEO17']);
  });
});
