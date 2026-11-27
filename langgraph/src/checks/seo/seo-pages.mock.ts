const SITE = 'https://example.test';

export interface MockHead {
  readonly lang: string;
  readonly path: string;
  readonly title: string;
  readonly h1: string;
  readonly alternates: readonly (readonly [string, string])[];
  readonly imageAlt: string;
}

export const englishCareer: MockHead = {
  lang: 'en',
  path: '/en/frontend-career',
  title: 'Frontend career of the author | Site',
  h1: 'A frontend career',
  alternates: [
    ['en', '/en/frontend-career'],
    ['pt', '/pt/carreira-frontend'],
    ['x-default', '/pt/carreira-frontend'],
  ],
  imageAlt: 'The author at work',
};

export const portugueseCareer: MockHead = {
  lang: 'pt',
  path: '/pt/carreira-frontend',
  title: 'Carreira frontend do autor | Site',
  h1: 'Uma carreira frontend',
  alternates: [
    ['pt', '/pt/carreira-frontend'],
    ['en', '/en/frontend-career'],
    ['x-default', '/pt/carreira-frontend'],
  ],
  imageAlt: 'O autor a trabalhar',
};

export function completePageHtml(head: MockHead, extraHead = ''): string {
  const alternates = head.alternates.map(([lang, path]) => `<link rel="alternate" hreflang="${lang}" href="${SITE}${path}">`).join('');
  const otherLocales = head.alternates
    .filter(([lang]) => lang !== head.lang && lang !== 'x-default')
    .map(([lang]) => `<meta property="og:locale:alternate" content="${lang}">`)
    .join('');
  return `<!DOCTYPE html><html lang="${head.lang}"><head><title>${head.title}</title>
<link rel="icon" href="favicon.ico"><link rel="apple-touch-icon" href="icon.png"><link rel="manifest" href="site.webmanifest">
<meta name="theme-color" content="#000000"><link rel="preconnect" href="https://fonts.example.test">
<link rel="canonical" href="${SITE}${head.path}">${alternates}
<meta property="og:title" content="${head.title}"><meta property="og:description" content="About the author">
<meta property="og:url" content="${SITE}${head.path}"><meta property="og:type" content="website">
<meta property="og:locale" content="${head.lang}">${otherLocales}
<meta property="og:image" content="${SITE}/images/share.webp"><meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630"><meta property="og:image:alt" content="${head.imageAlt}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image:alt" content="${head.imageAlt}">
<script type="application/ld+json">{"@type":"Person","name":"Author","sameAs":["https://social.example.test/author"]}</script>
${extraHead}</head><body><h1 class="cover"><span>${head.h1}</span></h1>
<img src="images/cover.webp" alt="Cover" fetchpriority="high"></body></html>`;
}

export const crowdedHints =
  '<link rel="preconnect" href="https://a.test"><link rel="preconnect" href="https://b.test"><link rel="preconnect" href="https://c.test">';

export const brokenSocialHead = '<meta property="og:image" content="https://example.test/share.svg">';

export const templateWithImageDebt = `@if (cover) {
<img [ngSrc]="cover.url" alt="Cover" priority width="10" height="10">
}
<img src="images/side.webp" priority>
<img ngSrc="images/footer.webp" [alt]="footerAlt" width="10" height="10">`;

export const builtPageWithPreloads = `<html lang="en"><head>
<link rel="preload" as="script" href="main.js">
<link rel="preload" as="image" href="hero.webp" fetchpriority="high">
<link rel="preload" as="image" href="side.webp">
</head><body><img src="hero.webp"></body></html>`;

export const robotsWithSitemap = 'User-agent: *\nAllow: /\nSitemap: https://example.test/sitemap.xml\n';

export const oneWayPortuguese: MockHead = {
  ...portugueseCareer,
  alternates: [
    ['pt', '/pt/carreira-frontend'],
    ['pt', '/pt/carreira-frontend'],
  ],
};

const untranslatedAlternates: MockHead['alternates'] = [
  ['en', '/en/frontend-career'],
  ['pt', '/pt/frontend-career'],
  ['x-default', '/pt/frontend-career'],
];

export const untranslatedPair: readonly MockHead[] = [
  { ...englishCareer, alternates: untranslatedAlternates },
  { ...portugueseCareer, path: '/pt/frontend-career', imageAlt: englishCareer.imageAlt, alternates: untranslatedAlternates },
];
