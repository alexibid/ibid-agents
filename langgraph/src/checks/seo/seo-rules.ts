import type { HtmlDocument } from './html-tags.js';
import type { SeoCategory, SeoIssue } from './seo-audit-contract.js';

export interface SeoPage {
  readonly route: string;
  readonly filePath: string;
  readonly document: HtmlDocument;
}

interface SeoRule {
  readonly category: SeoCategory;
  readonly fixHint: string;
}

export type SeoRuleId =
  | 'SEO01'
  | 'SEO02'
  | 'SEO03'
  | 'SEO04'
  | 'SEO05'
  | 'SEO06'
  | 'SEO07'
  | 'SEO08'
  | 'SEO09'
  | 'SEO10'
  | 'SEO11'
  | 'SEO12'
  | 'SEO13'
  | 'SEO14'
  | 'SEO15'
  | 'SEO16'
  | 'SEO17'
  | 'SEO18';

const RULES: Readonly<Record<SeoRuleId, SeoRule>> = {
  SEO01: { category: 'HINTS', fixHint: 'Keep at most 3 preconnect hints, only for origins the first view really uses.' },
  SEO02: { category: 'HINTS', fixHint: 'Preload only critical fonts and the single LCP image, the image with fetchpriority="high".' },
  SEO03: { category: 'HINTS', fixHint: 'Give fetchpriority="high" to the LCP resource only.' },
  SEO04: {
    category: 'SOCIAL',
    fixHint: 'Set og:title, og:description, og:url, og:type, og:locale and its alternates, and a 1200x630 non-SVG og:image with og:image:alt.',
  },
  SEO05: { category: 'SOCIAL', fixHint: 'Set twitter:card to summary_large_image and give twitter:image:alt.' },
  SEO06: { category: 'SOCIAL', fixHint: 'Translate og:image:alt into the language of each page.' },
  SEO07: { category: 'SEO', fixHint: 'Link rel="icon", rel="apple-touch-icon" and rel="manifest", and set meta theme-color.' },
  SEO08: { category: 'SEO', fixHint: 'Publish robots.txt at the site root with an absolute "Sitemap:" line.' },
  SEO09: { category: 'SEO', fixHint: 'Publish llms.txt at the site root.' },
  SEO10: { category: 'SEO', fixHint: 'Publish 404.html and drop the catch-all rewrite to index.html, so unknown URLs answer 404.' },
  SEO11: { category: 'SEO', fixHint: 'Set one trailingSlash policy in the hosting config and write every canonical and hreflang URL by it.' },
  SEO12: { category: 'SEO', fixHint: 'Send "X-Robots-Tag: noindex" for files that are not pages (fragments, data, fallbacks).' },
  SEO13: { category: 'SEO', fixHint: 'Give every page valid JSON-LD, with sameAs on the entity that owns the site.' },
  SEO14: { category: 'SEO', fixHint: 'Use short slugs translated into the language of the page, without "#".' },
  SEO15: { category: 'SEO', fixHint: 'Give each page one hreflang per language, itself included, x-default, and links that point back.' },
  SEO16: { category: 'SEO', fixHint: 'Use one h1; let slug, h1 and title share one primary keyword without being identical.' },
  SEO17: { category: 'A11Y', fixHint: 'Set html lang to the language of the page and give every image an alt (empty when decorative).' },
  SEO18: { category: 'CWV', fixHint: 'Render images with ngSrc and give priority to one image per view only.' },
};

export function blocking(ruleId: SeoRuleId, filePath: string, message: string): SeoIssue {
  return { ruleId, severity: 'BLOCK', ...RULES[ruleId], filePath, message };
}

export function warning(ruleId: SeoRuleId, filePath: string, message: string): SeoIssue {
  return { ruleId, severity: 'WARN', ...RULES[ruleId], filePath, message };
}

export function slugOf(route: string): string {
  return route.split('/').filter((segment) => segment !== '').slice(1).join('/');
}
