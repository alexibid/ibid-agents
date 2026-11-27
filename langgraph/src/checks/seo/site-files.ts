import { z } from 'zod';
import type { TrailingSlashPolicy } from './inspect-metadata.js';
import type { SeoIssue } from './seo-audit-contract.js';
import { blocking } from './seo-rules.js';

export const hostingEntrySchema = z.object({
  public: z.string(),
  trailingSlash: z.boolean().optional(),
  rewrites: z.array(z.object({ source: z.string(), destination: z.string().optional() }).passthrough()).default([]),
  headers: z
    .array(z.object({ source: z.string(), headers: z.array(z.object({ key: z.string(), value: z.string() })) }))
    .default([]),
});

export type HostingEntry = z.infer<typeof hostingEntrySchema>;

export interface SiteFiles {
  readonly pagesDirectory: string;
  readonly robotsText: string;
  readonly rootFiles: ReadonlySet<string>;
  readonly hostingFile: string;
  readonly hosting: HostingEntry | 'missing';
  readonly jsonLdBlocks: readonly unknown[];
}

const SITEMAP_LINE = /^\s*sitemap:\s*https?:\/\/\S+/im;
const CATCH_ALL = new Set(['**', '/**', '**/*']);
const SPA_SHELL = /(?:^|\/)index(?:\.csr)?\.html$/;

export function trailingSlashPolicyOf(hosting: HostingEntry | 'missing'): TrailingSlashPolicy {
  if (hosting === 'missing' || hosting.trailingSlash === undefined) {
    return 'undeclared';
  }
  return hosting.trailingSlash ? 'always' : 'never';
}

export function checkSiteFiles(site: SiteFiles): SeoIssue[] {
  return [...crawlerFiles(site), ...notFoundPage(site), ...hostingRules(site), ...sameAs(site)];
}

function crawlerFiles({ pagesDirectory, robotsText, rootFiles }: SiteFiles): SeoIssue[] {
  const robots = `${pagesDirectory}/robots.txt`;
  return [
    ...(rootFiles.has('robots.txt') ? [] : [blocking('SEO08', robots, 'The site publishes no robots.txt.')]),
    ...(rootFiles.has('robots.txt') && !SITEMAP_LINE.test(robotsText)
      ? [blocking('SEO08', robots, 'robots.txt has no absolute "Sitemap:" line.')]
      : []),
    ...(rootFiles.has('llms.txt') ? [] : [blocking('SEO09', `${pagesDirectory}/llms.txt`, 'The site publishes no llms.txt.')]),
  ];
}

function notFoundPage({ pagesDirectory, rootFiles, hosting, hostingFile }: SiteFiles): SeoIssue[] {
  const catchAll = hosting === 'missing' ? [] : hosting.rewrites.filter((rewrite) => CATCH_ALL.has(rewrite.source) && SPA_SHELL.test(rewrite.destination ?? ''));
  return [
    ...(rootFiles.has('404.html') ? [] : [blocking('SEO10', `${pagesDirectory}/404.html`, 'The site publishes no 404.html.')]),
    ...catchAll.map((rewrite) =>
      blocking('SEO10', hostingFile, `The rewrite "${rewrite.source}" -> "${rewrite.destination ?? ''}" answers unknown URLs with 200.`),
    ),
  ];
}

function hostingRules({ hosting, hostingFile, pagesDirectory }: SiteFiles): SeoIssue[] {
  if (hosting === 'missing') {
    return [blocking('SEO11', hostingFile, `No hosting entry publishes ${pagesDirectory}.`)];
  }
  const noindex = hosting.headers.some(({ headers }) =>
    headers.some(({ key, value }) => key.toLowerCase() === 'x-robots-tag' && value.toLowerCase().includes('noindex')),
  );
  return [
    ...(hosting.trailingSlash === undefined ? [blocking('SEO11', hostingFile, 'The hosting entry declares no trailingSlash policy.')] : []),
    ...(noindex ? [] : [blocking('SEO12', hostingFile, 'No header sends "X-Robots-Tag: noindex" for files that are not pages.')]),
  ];
}

function sameAs({ jsonLdBlocks, pagesDirectory }: SiteFiles): SeoIssue[] {
  return jsonLdBlocks.some(hasSameAs) ? [] : [blocking('SEO13', pagesDirectory, 'No JSON-LD on the site declares sameAs.')];
}

function hasSameAs(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasSameAs);
  }
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return Object.entries(value).some(([key, inner]) => (key === 'sameAs' ? isFilled(inner) : hasSameAs(inner)));
}

function isFilled(value: unknown): boolean {
  return Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value.trim() !== '';
}
