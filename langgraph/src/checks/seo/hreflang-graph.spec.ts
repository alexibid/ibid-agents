import { describe, expect, it } from 'vitest';
import { validateHreflangGraph } from './hreflang-graph.js';
import { mockPage, rulesFound } from './seo-page.mock.js';
import { englishCareer, oneWayPortuguese, portugueseCareer, untranslatedPair } from './seo-pages.mock.js';

describe('validateHreflangGraph', () => {
  it('should accept two translations that point at each other with x-default', () => {
    expect(validateHreflangGraph([mockPage(englishCareer), mockPage(portugueseCareer)])).toEqual([]);
  });

  it('should block a one-way link, a duplicate language and a missing x-default', () => {
    const messages = validateHreflangGraph([mockPage(englishCareer), mockPage(oneWayPortuguese)]).map(({ message }) => message);

    expect(messages).toEqual([
      '/pt/carreira-frontend does not point back to /en/frontend-career with hreflang.',
      'hreflang "pt" appears more than once.',
      'The hreflang alternates have no x-default.',
    ]);
  });

  it('should only warn when a translation keeps the same slug and image alt', () => {
    expect(rulesFound(validateHreflangGraph(untranslatedPair.map((head) => mockPage(head))))).toEqual([
      'WARN SEO14',
      'WARN SEO06',
      'WARN SEO14',
      'WARN SEO06',
    ]);
  });
});
