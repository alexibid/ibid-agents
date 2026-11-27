import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { HtmlFile } from './asset-optimization.js';
import { readHtml } from './html-tags.js';
import { jsonLdBlocksOf } from './inspect-metadata.js';
import type { SeoAuditConfig } from './seo-audit-config.js';
import type { SeoIssue } from './seo-audit-contract.js';
import { blocking, type SeoPage } from './seo-rules.js';
import { hostingEntrySchema, type HostingEntry, type SiteFiles } from './site-files.js';

export interface LoadedSite {
  readonly checkedUrls: readonly string[];
  readonly pages: readonly SeoPage[];
  readonly templates: readonly HtmlFile[];
  readonly site: SiteFiles;
  readonly missing: readonly SeoIssue[];
}

export class MissingBuildError extends Error {
  constructor(routesFile: string) {
    super(`The build left no prerendered routes at ${routesFile}; the SEO audit needs the prerendered pages.`);
    this.name = 'MissingBuildError';
  }
}

const routesSchema = z.object({ routes: z.record(z.string(), z.unknown()) });
const hostingConfigSchema = z.object({ hosting: z.union([z.array(z.unknown()), z.unknown()]).optional() });
const TEMPLATE = /\.html$/;

export async function loadSite(config: SeoAuditConfig, workspaceRoot: string): Promise<LoadedSite> {
  const routes = await prerenderedRoutes(config, workspaceRoot);
  const loaded = await Promise.all(routes.map((route) => loadPage(route, config, workspaceRoot)));
  const pages = loaded.flatMap((page) => (page === 'missing' ? [] : [page]));
  const missing = routes
    .filter((_route, index) => loaded[index] === 'missing')
    .map((route) => blocking('SEO10', `${config.pages}${pageFileOf(route)}`, `The route ${route} has no prerendered page.`));
  return {
    checkedUrls: routes,
    pages,
    templates: await loadTemplates(config.templates, workspaceRoot),
    site: await loadSiteFiles(config, workspaceRoot, pages),
    missing,
  };
}

export function pageFileOf(route: string): string {
  return route === '/' ? '/index.html' : `${route.replace(/\/+$/, '')}/index.html`;
}

async function prerenderedRoutes(config: SeoAuditConfig, workspaceRoot: string): Promise<string[]> {
  const text = await readFile(join(workspaceRoot, config.routes), 'utf8').catch(() => '');
  const parsed = routesSchema.safeParse(text === '' ? undefined : parsedJson(text));
  if (!parsed.success) {
    throw new MissingBuildError(config.routes);
  }
  return Object.keys(parsed.data.routes).sort();
}

async function loadPage(route: string, config: SeoAuditConfig, workspaceRoot: string): Promise<SeoPage | 'missing'> {
  const filePath = `${config.pages}${pageFileOf(route)}`;
  const html = await readFile(join(workspaceRoot, filePath), 'utf8').catch(() => '');
  return html === '' ? 'missing' : { route, filePath, document: readHtml(html) };
}

async function loadTemplates(directory: string, workspaceRoot: string): Promise<HtmlFile[]> {
  const entries = await readdir(join(workspaceRoot, directory), { recursive: true }).catch(() => []);
  const files = entries.filter((entry) => TEMPLATE.test(entry)).sort();
  return Promise.all(
    files.map(async (entry) => {
      const filePath = join(directory, entry);
      return { filePath, document: readHtml(await readFile(join(workspaceRoot, filePath), 'utf8')) };
    }),
  );
}

async function loadSiteFiles(config: SeoAuditConfig, workspaceRoot: string, pages: readonly SeoPage[]): Promise<SiteFiles> {
  const rootFiles = new Set(await readdir(join(workspaceRoot, config.pages)).catch(() => []));
  return {
    pagesDirectory: config.pages,
    robotsText: await readFile(join(workspaceRoot, config.pages, 'robots.txt'), 'utf8').catch(() => ''),
    rootFiles,
    hostingFile: config.hosting,
    hosting: await hostingEntryFor(config, workspaceRoot),
    jsonLdBlocks: pages.flatMap(({ document }) => jsonLdBlocksOf(document)),
  };
}

async function hostingEntryFor(config: SeoAuditConfig, workspaceRoot: string): Promise<HostingEntry | 'missing'> {
  const text = await readFile(join(workspaceRoot, config.hosting), 'utf8').catch(() => '');
  const parsed = hostingConfigSchema.safeParse(text === '' ? {} : parsedJson(text));
  const hosting = parsed.success ? parsed.data.hosting : undefined;
  const entries = Array.isArray(hosting) ? hosting : [hosting];
  const found = entries.map((entry) => hostingEntrySchema.safeParse(entry)).find((entry) => entry.success && entry.data.public === config.pages);
  return found?.success === true ? found.data : 'missing';
}

function parsedJson(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return undefined;
  }
}
