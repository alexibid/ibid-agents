import { attributeOf, hasAttribute, linksWithRel, tagsNamed, type HtmlDocument, type HtmlTag } from './html-tags.js';
import type { SeoIssue } from './seo-audit-contract.js';
import { blocking, warning } from './seo-rules.js';

export interface HtmlFile {
  readonly filePath: string;
  readonly document: HtmlDocument;
}

const CRITICAL_PRELOADS = new Set(['font', 'image']);
const ALT_ATTRIBUTES = ['alt', '[alt]', '[attr.alt]'];
const SOURCE_ATTRIBUTES = ['ngsrc', '[ngsrc]'];
const PRIORITY_ATTRIBUTES = ['priority', '[priority]'];

export function checkAssetOptimization(pages: readonly HtmlFile[], templates: readonly HtmlFile[]): SeoIssue[] {
  return [...pages.flatMap(builtPageAssets), ...templates.flatMap(templateAssets)];
}

function builtPageAssets({ filePath, document }: HtmlFile): SeoIssue[] {
  const preloads = linksWithRel(document, 'preload');
  const nonCritical = preloads.filter((tag) => !CRITICAL_PRELOADS.has(attributeOf(tag, 'as').toLowerCase()));
  const images = preloads.filter((tag) => attributeOf(tag, 'as').toLowerCase() === 'image');
  const lowPriorityImages = images.filter((tag) => attributeOf(tag, 'fetchpriority').toLowerCase() !== 'high');
  return [
    ...nonCritical.map((tag) => blocking('SEO02', filePath, `Preload of a non-critical resource: ${describe(tag)}.`)),
    ...(images.length > 1 ? [blocking('SEO02', filePath, `${images.length} image preloads; only the LCP image may be preloaded.`)] : []),
    ...lowPriorityImages.map((tag) => warning('SEO02', filePath, `Image preload without fetchpriority="high": ${describe(tag)}.`)),
    ...missingAlt(filePath, tagsNamed(document, 'img')),
  ];
}

function templateAssets({ filePath, document }: HtmlFile): SeoIssue[] {
  const images = tagsNamed(document, 'img');
  const withoutNgSrc = images.filter((tag) => !SOURCE_ATTRIBUTES.some((name) => hasAttribute(tag, name)));
  const prioritised = images.filter((tag) => PRIORITY_ATTRIBUTES.some((name) => hasAttribute(tag, name))).length;
  return [
    ...withoutNgSrc.map((tag) => blocking('SEO18', filePath, `<img> without ngSrc: ${describe(tag)}.`)),
    ...missingAlt(filePath, images),
    ...(prioritised > 1 ? [blocking('SEO18', filePath, `${prioritised} images have priority in one view; only one may.`)] : []),
  ];
}

function missingAlt(filePath: string, images: readonly HtmlTag[]): SeoIssue[] {
  return images
    .filter((tag) => !ALT_ATTRIBUTES.some((name) => hasAttribute(tag, name)))
    .map((tag) => blocking('SEO17', filePath, `<img> without alt: ${describe(tag)}.`));
}

function describe(tag: HtmlTag): string {
  const source = attributeOf(tag, 'href') || attributeOf(tag, 'src') || attributeOf(tag, 'ngsrc') || attributeOf(tag, '[ngsrc]');
  return source === '' ? `<${tag.name}>` : source;
}
