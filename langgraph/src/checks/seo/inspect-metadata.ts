import { attributeOf, linksWithRel, metaContent, tagsNamed, type HtmlDocument } from './html-tags.js';
import type { SeoIssue } from './seo-audit-contract.js';
import { blocking, slugOf, warning, type SeoPage } from './seo-rules.js';

export type TrailingSlashPolicy = 'always' | 'never' | 'undeclared';

const MAX_PRECONNECTS = 3;
const OG_IMAGE_WIDTH = '1200';
const OG_IMAGE_HEIGHT = '630';
const LARGE_CARD = 'summary_large_image';
const REQUIRED_OPEN_GRAPH = ['og:title', 'og:description', 'og:url', 'og:type', 'og:image', 'og:image:alt', 'og:locale'];
const REQUIRED_TWITTER = ['twitter:card', 'twitter:image:alt'];
const KEYWORD_LENGTH = 4;
const JSON_LD = 'application/ld+json';

export function inspectMetadata(page: SeoPage, policy: TrailingSlashPolicy): SeoIssue[] {
  return [
    ...resourceHints(page),
    ...openGraph(page),
    ...twitterCard(page),
    ...iconsAndTheme(page),
    ...structuredData(page),
    ...headings(page),
    ...language(page),
    ...pageUrls(page, policy),
  ];
}

export function jsonLdBlocksOf(document: HtmlDocument): unknown[] {
  return document.scripts.filter(({ type }) => type === JSON_LD).flatMap(({ content }) => parsedJson(content));
}

function resourceHints({ document, filePath }: SeoPage): SeoIssue[] {
  const preconnects = linksWithRel(document, 'preconnect').length;
  const highPriority = document.tags.filter((tag) => attributeOf(tag, 'fetchpriority').toLowerCase() === 'high').length;
  return [
    ...(preconnects > MAX_PRECONNECTS ? [blocking('SEO01', filePath, `${preconnects} preconnect hints; the limit is ${MAX_PRECONNECTS}.`)] : []),
    ...(highPriority > 1 ? [blocking('SEO03', filePath, `${highPriority} resources have fetchpriority="high"; only the LCP may.`)] : []),
  ];
}

function openGraph({ document, filePath }: SeoPage): SeoIssue[] {
  const missing = REQUIRED_OPEN_GRAPH.filter((key) => firstMeta(document, key) === '');
  const image = firstMeta(document, 'og:image');
  const width = firstMeta(document, 'og:image:width');
  const height = firstMeta(document, 'og:image:height');
  const languages = alternateLanguages(document).length;
  const localeAlternates = metaContent(document, 'og:locale:alternate').length;
  return [
    ...missing.map((key) => blocking('SEO04', filePath, `Open Graph "${key}" is missing.`)),
    ...metaContent(document, 'og:image')
      .filter((url) => /\.svg(?:$|[?#])/i.test(url))
      .map((url) => blocking('SEO04', filePath, `og:image is an SVG (${url}); social networks need PNG, JPEG or WebP.`)),
    ...(image !== '' && (width !== OG_IMAGE_WIDTH || height !== OG_IMAGE_HEIGHT)
      ? [blocking('SEO04', filePath, `og:image is declared ${width || '?'}x${height || '?'}; it must be ${OG_IMAGE_WIDTH}x${OG_IMAGE_HEIGHT}.`)]
      : []),
    ...(languages > 1 && localeAlternates < languages - 1
      ? [blocking('SEO04', filePath, `${localeAlternates} og:locale:alternate for ${languages - 1} other languages.`)]
      : []),
  ];
}

function twitterCard({ document, filePath }: SeoPage): SeoIssue[] {
  const missing = REQUIRED_TWITTER.filter((key) => firstMeta(document, key) === '');
  const card = firstMeta(document, 'twitter:card');
  return [
    ...missing.map((key) => blocking('SEO05', filePath, `Twitter card "${key}" is missing.`)),
    ...(card !== '' && card !== LARGE_CARD ? [warning('SEO05', filePath, `twitter:card is "${card}", not "${LARGE_CARD}".`)] : []),
  ];
}

function iconsAndTheme({ document, filePath }: SeoPage): SeoIssue[] {
  const missingLinks = ['icon', 'apple-touch-icon', 'manifest'].filter((rel) => linksWithRel(document, rel).length === 0);
  return [
    ...missingLinks.map((rel) => blocking('SEO07', filePath, `No <link rel="${rel}">.`)),
    ...(firstMeta(document, 'theme-color') === '' ? [blocking('SEO07', filePath, 'No <meta name="theme-color">.')] : []),
  ];
}

function structuredData({ document, filePath }: SeoPage): SeoIssue[] {
  const blocks = document.scripts.filter(({ type }) => type === JSON_LD);
  if (blocks.length === 0) {
    return [blocking('SEO13', filePath, 'The page has no JSON-LD.')];
  }
  const invalid = blocks.filter(({ content }) => parsedJson(content).length === 0).length;
  return invalid > 0 ? [blocking('SEO13', filePath, `${invalid} JSON-LD block(s) are not valid JSON.`)] : [];
}

function headings({ document, filePath, route }: SeoPage): SeoIssue[] {
  const h1s = document.textsOf('h1');
  const title = document.textsOf('title')[0] ?? '';
  if (h1s.length !== 1) {
    return [blocking('SEO16', filePath, `The page has ${h1s.length} h1 elements; it must have exactly one.`)];
  }
  const h1 = h1s[0] ?? '';
  if (title === '' || normalized(title) === normalized(h1)) {
    return [blocking('SEO16', filePath, title === '' ? 'The page has no title.' : `The title and the h1 are identical ("${h1}").`)];
  }
  const slug = slugOf(route);
  return slug === '' || sharesKeyword([slug, h1, title])
    ? []
    : [warning('SEO16', filePath, `Slug "${slug}", h1 "${h1}" and title "${title}" share no keyword.`)];
}

function language({ document, filePath }: SeoPage): SeoIssue[] {
  const lang = tagsNamed(document, 'html').map((tag) => attributeOf(tag, 'lang'))[0] ?? '';
  return lang === '' ? [blocking('SEO17', filePath, 'The <html> element has no lang.')] : [];
}

function pageUrls({ document, filePath }: SeoPage, policy: TrailingSlashPolicy): SeoIssue[] {
  const urls = [...linksWithRel(document, 'canonical'), ...linksWithRel(document, 'alternate')].map((tag) => attributeOf(tag, 'href'));
  const hashed = urls.filter((url) => url.includes('#'));
  const offPolicy = policy === 'undeclared' ? [] : urls.filter((url) => breaksPolicy(url, policy));
  return [
    ...hashed.map((url) => blocking('SEO14', filePath, `The URL "${url}" contains "#".`)),
    ...offPolicy.map((url) => blocking('SEO11', filePath, `The URL "${url}" breaks the trailing-slash policy "${policy}".`)),
  ];
}

function breaksPolicy(url: string, policy: 'always' | 'never'): boolean {
  const path = pathOf(url);
  if (path === '/' || path === '' || /\.[a-z0-9]+$/i.test(path)) {
    return false;
  }
  return policy === 'always' ? !path.endsWith('/') : path.endsWith('/');
}

export function pathOf(url: string): string {
  try {
    return new URL(url, 'https://site.invalid').pathname;
  } catch {
    return url;
  }
}

function alternateLanguages(document: HtmlDocument): string[] {
  const languages = linksWithRel(document, 'alternate').map((tag) => attributeOf(tag, 'hreflang')).filter((lang) => lang !== '' && lang !== 'x-default');
  return [...new Set(languages)];
}

function firstMeta(document: HtmlDocument, key: string): string {
  return metaContent(document, key).find((content) => content.trim() !== '') ?? '';
}

function sharesKeyword(texts: readonly string[]): boolean {
  const [first, ...others] = texts.map(keywordsOf);
  return [...(first ?? [])].some((word) => others.every((words) => words.has(word)));
}

function keywordsOf(text: string): Set<string> {
  return new Set(normalized(text).split(/[^a-z0-9]+/).filter((word) => word.length >= KEYWORD_LENGTH));
}

function normalized(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function parsedJson(content: string): unknown[] {
  try {
    const value: unknown = JSON.parse(content);
    return [value];
  } catch {
    return [];
  }
}
