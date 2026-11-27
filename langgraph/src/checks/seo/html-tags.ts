export interface HtmlTag {
  readonly name: string;
  readonly attributes: ReadonlyMap<string, string>;
}

export interface HtmlDocument {
  readonly tags: readonly HtmlTag[];
  readonly scripts: readonly HtmlScript[];
  textsOf(name: string): string[];
}

export interface HtmlScript {
  readonly type: string;
  readonly content: string;
}

const RAW_TEXT_BLOCK = /<(script|style)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi;
const COMMENT = /<!--[\s\S]*?-->/g;
const START_TAG = /<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
const ATTRIBUTE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const ANY_TAG = /<[^>]*>/g;
const ENTITIES: Readonly<Record<string, string>> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };

export function readHtml(html: string): HtmlDocument {
  const scripts: HtmlScript[] = [];
  const withoutRawText = html.replace(COMMENT, '').replace(RAW_TEXT_BLOCK, (_block, name: string, attributes: string, content: string) => {
    if (name.toLowerCase() === 'script') {
      scripts.push({ type: attributesOf(attributes).get('type') ?? '', content });
    }
    return `<${name}${attributes}>`;
  });
  return {
    tags: startTagsOf(withoutRawText),
    scripts,
    textsOf: (name) => textsOf(withoutRawText, name),
  };
}

export function attributeOf(tag: HtmlTag, name: string): string {
  return tag.attributes.get(name) ?? '';
}

export function hasAttribute(tag: HtmlTag, name: string): boolean {
  return tag.attributes.has(name);
}

export function tagsNamed(document: HtmlDocument, name: string): HtmlTag[] {
  return document.tags.filter((tag) => tag.name === name);
}

export function linksWithRel(document: HtmlDocument, rel: string): HtmlTag[] {
  return tagsNamed(document, 'link').filter((tag) => attributeOf(tag, 'rel').toLowerCase().split(/\s+/).includes(rel));
}

export function metaContent(document: HtmlDocument, key: string): string[] {
  return tagsNamed(document, 'meta')
    .filter((tag) => attributeOf(tag, 'property') === key || attributeOf(tag, 'name') === key)
    .map((tag) => attributeOf(tag, 'content'));
}

function startTagsOf(html: string): HtmlTag[] {
  return [...html.matchAll(START_TAG)].map((match) => ({
    name: (match[1] ?? '').toLowerCase(),
    attributes: attributesOf(match[2] ?? ''),
  }));
}

function attributesOf(source: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of source.matchAll(ATTRIBUTE)) {
    const name = (match[1] ?? '').toLowerCase();
    if (name !== '') {
      attributes.set(name, decoded(match[2] ?? match[3] ?? match[4] ?? ''));
    }
  }
  return attributes;
}

function textsOf(html: string, name: string): string[] {
  const element = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}\\s*>`, 'gi');
  return [...html.matchAll(element)].map((match) => decoded((match[1] ?? '').replace(ANY_TAG, ' ')).replace(/\s+/g, ' ').trim());
}

function decoded(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    }
    if (code.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    }
    return ENTITIES[code.toLowerCase()] ?? entity;
  });
}
