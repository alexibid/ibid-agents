import { describe, expect, it } from 'vitest';
import { inspectMetadata } from './inspect-metadata.js';
import { mockPage, rulesFound } from './seo-page.mock.js';
import { brokenSocialHead, crowdedHints, englishCareer } from './seo-pages.mock.js';

describe('inspectMetadata', () => {
  it('should find nothing on a page that follows every rule', () => {
    expect(inspectMetadata(mockPage(englishCareer), 'never')).toEqual([]);
  });

  it('should block too many preconnects, an SVG share image and a second high-priority resource', () => {
    const extra = `${crowdedHints}${brokenSocialHead}<link rel="preload" as="font" href="f.woff2" fetchpriority="high">`;

    expect(rulesFound(inspectMetadata(mockPage(englishCareer, extra), 'never'))).toEqual(['BLOCK SEO01', 'BLOCK SEO03', 'BLOCK SEO04']);
  });

  it('should block a title that repeats the h1', () => {
    const issues = inspectMetadata(mockPage({ ...englishCareer, title: 'A frontend career' }), 'never');

    expect(issues.map(({ message }) => message)).toEqual(['The title and the h1 are identical ("A frontend career").']);
  });

  it('should block canonical and hreflang URLs that break the trailing-slash policy', () => {
    const issues = inspectMetadata(mockPage(englishCareer), 'always');

    expect(new Set(rulesFound(issues))).toEqual(new Set(['BLOCK SEO11']));
  });
});
