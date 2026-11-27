import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { discoveryReviewProblem, uncoveredRulesProblem } from './discovery-review.js';
import { draftFor, webReview, writeMockRules } from './discovery-review.mock.js';

describe('discoveryReviewProblem', () => {
  let rules = '';

  beforeEach(async () => {
    rules = await mkdtemp(join(tmpdir(), 'discovery-rules-'));
    await writeMockRules(rules);
  });

  afterEach(async () => {
    await rm(rules, { recursive: true, force: true });
  });

  it('should accept a website with SEO rules its document has, an app with no rule and an unclassified project', async () => {
    const review = [
      ...webReview,
      { project: 'phone', discovery: 'aso', rules: [], reason: 'No ASO rule exists yet.' },
      { project: 'tool', discovery: 'unclassified', rules: [], reason: 'The sheet does not say; asked the user.' },
    ];

    expect(await discoveryReviewProblem(review, rules)).toBe('');
  });

  it('should refuse a classification that differs from the project sheet, so nothing is guessed', async () => {
    const review = [{ project: 'tool', discovery: 'seo', rules: [], reason: 'It looks like a site.' }];

    expect(await discoveryReviewProblem(review, rules)).toBe('"tool" is "unclassified" in its project sheet, not "seo"');
  });

  it('should refuse a rule id the rules document does not have, ASO included', async () => {
    const review = [
      { project: 'web', discovery: 'seo', rules: ['SEO99'], reason: 'Made up.' },
      { project: 'phone', discovery: 'aso', rules: ['ASO01'], reason: 'Made up.' },
    ];

    expect(await discoveryReviewProblem(review, rules)).toBe('SEO99 is not in rules/discovery/seo.md; ASO01 is not in rules/discovery/aso.md');
  });
});

describe('uncoveredRulesProblem', () => {
  it('should refuse a draft whose stories never cover a rule the size step listed', () => {
    const problem = uncoveredRulesProblem(draftFor('German pages exist.'), { size: { discoveryReview: webReview } });

    expect(problem).toBe('names no story whose acceptance criteria cover SEO15, which the size step said the work touches');
  });

  it('should accept a draft whose story criteria cite the rule', () => {
    const draft = draftFor('Every German page lists all languages and x-default, and each points back (SEO15).');

    expect(uncoveredRulesProblem(draft, { size: { discoveryReview: webReview } })).toBe('');
  });
});
