import { attributeOf, linksWithRel, metaContent } from './html-tags.js';
import { pathOf } from './inspect-metadata.js';
import type { SeoIssue } from './seo-audit-contract.js';
import { blocking, slugOf, warning, type SeoPage } from './seo-rules.js';

interface Alternate {
  readonly hreflang: string;
  readonly path: string;
}

interface PageLinks {
  readonly page: SeoPage;
  readonly path: string;
  readonly alternates: readonly Alternate[];
}

const X_DEFAULT = 'x-default';

export function validateHreflangGraph(pages: readonly SeoPage[]): SeoIssue[] {
  const graph = pages.map(linksOf);
  const byPath = new Map(graph.map((links) => [links.path, links]));
  return graph.flatMap((links) => [
    ...duplicates(links),
    ...missingSelfOrDefault(links),
    ...brokenOrOneWay(links, byPath),
    ...untranslated(links, byPath),
  ]);
}

function linksOf(page: SeoPage): PageLinks {
  const alternates = linksWithRel(page.document, 'alternate')
    .filter((tag) => attributeOf(tag, 'hreflang') !== '')
    .map((tag) => ({ hreflang: attributeOf(tag, 'hreflang').toLowerCase(), path: comparablePath(attributeOf(tag, 'href')) }));
  return { page, path: comparablePath(page.route), alternates };
}

function duplicates({ page, alternates }: PageLinks): SeoIssue[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const { hreflang } of alternates) {
    (seen.has(hreflang) ? repeated : seen).add(hreflang);
  }
  return [...repeated].map((hreflang) => blocking('SEO15', page.filePath, `hreflang "${hreflang}" appears more than once.`));
}

function missingSelfOrDefault({ page, path, alternates }: PageLinks): SeoIssue[] {
  if (alternates.length === 0) {
    return [blocking('SEO15', page.filePath, 'The page declares no hreflang alternates.')];
  }
  const hasSelf = alternates.some((alternate) => alternate.hreflang !== X_DEFAULT && alternate.path === path);
  const hasDefault = alternates.some(({ hreflang }) => hreflang === X_DEFAULT);
  return [
    ...(hasSelf ? [] : [blocking('SEO15', page.filePath, 'The hreflang alternates do not include the page itself.')]),
    ...(hasDefault ? [] : [blocking('SEO15', page.filePath, 'The hreflang alternates have no x-default.')]),
  ];
}

function brokenOrOneWay({ page, path, alternates }: PageLinks, byPath: ReadonlyMap<string, PageLinks>): SeoIssue[] {
  return alternates
    .filter((alternate) => alternate.hreflang !== X_DEFAULT && alternate.path !== path)
    .flatMap((alternate) => {
      const target = byPath.get(alternate.path);
      if (target === undefined) {
        return [blocking('SEO15', page.filePath, `hreflang "${alternate.hreflang}" points to ${alternate.path}, which is not a prerendered page.`)];
      }
      const pointsBack = target.alternates.some((back) => back.path === path);
      return pointsBack ? [] : [blocking('SEO15', page.filePath, `${alternate.path} does not point back to ${path} with hreflang.`)];
    });
}

function untranslated(links: PageLinks, byPath: ReadonlyMap<string, PageLinks>): SeoIssue[] {
  const siblings = links.alternates
    .filter((alternate) => alternate.hreflang !== X_DEFAULT && alternate.path !== links.path)
    .flatMap((alternate) => byPath.get(alternate.path) ?? []);
  const slug = slugOf(links.page.route);
  const alt = metaContent(links.page.document, 'og:image:alt')[0] ?? '';
  const sameSlug = slug !== '' && siblings.some((sibling) => slugOf(sibling.page.route) === slug);
  const sameAlt = alt !== '' && siblings.some((sibling) => metaContent(sibling.page.document, 'og:image:alt')[0] === alt);
  return [
    ...(sameSlug ? [warning('SEO14', links.page.filePath, `The slug "${slug}" is the same in another language.`)] : []),
    ...(sameAlt ? [warning('SEO06', links.page.filePath, `og:image:alt "${alt}" is the same in another language.`)] : []),
  ];
}

function comparablePath(url: string): string {
  const path = pathOf(url);
  return path.length > 1 ? path.replace(/\/+$/, '') : '/';
}
