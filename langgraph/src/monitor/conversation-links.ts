import type { Row } from '../store/database.js';

export interface LangGraphCallRow extends Row {
  readonly promptId: string;
  readonly request: string;
  readonly response: string;
}

interface ExtractedLink {
  readonly keys: readonly string[];
  readonly title: string;
}

class ConversationUnion {
  readonly #parent = new Map<string, string>();

  find(id: string): string {
    const parent = this.#parent.get(id);
    if (parent === undefined || parent === id) {
      this.#parent.set(id, id);
      return id;
    }
    const root = this.find(parent);
    this.#parent.set(id, root);
    return root;
  }

  unite(first: string, second: string): void {
    const firstRoot = this.find(first);
    const secondRoot = this.find(second);
    if (firstRoot !== secondRoot) {
      this.#parent.set(secondRoot, firstRoot);
    }
  }
}

export function attachThreads(prompts: readonly Row[], calls: readonly LangGraphCallRow[]): Row[] {
  const conversationOfPrompt = new Map<string, string>();
  for (const prompt of prompts) {
    const id = stringField(prompt, 'id');
    const conversationId = stringField(prompt, 'conversationId') || id;
    if (id !== '') {
      conversationOfPrompt.set(id, conversationId);
    }
  }

  const union = new ConversationUnion();
  const ownerByKey = new Map<string, string>();
  const titleByConversation = new Map<string, string>();

  for (const call of calls) {
    const conversationId = conversationOfPrompt.get(call.promptId);
    if (conversationId === undefined) {
      continue;
    }
    const link = extractLink(call);
    if (link.title !== '' && !titleByConversation.has(conversationId)) {
      titleByConversation.set(conversationId, link.title);
    }
    for (const key of link.keys) {
      const existing = ownerByKey.get(key);
      if (existing === undefined) {
        ownerByKey.set(key, conversationId);
      } else {
        union.unite(existing, conversationId);
      }
    }
  }

  const titleByRoot = new Map<string, string>();
  for (const [conversationId, title] of titleByConversation) {
    const root = union.find(conversationId);
    if (!titleByRoot.has(root)) {
      titleByRoot.set(root, title);
    }
  }

  return prompts.map((prompt) => {
    const conversationId = stringField(prompt, 'conversationId') || stringField(prompt, 'id');
    const threadId = union.find(conversationId);
    const threadTitle = titleByRoot.get(threadId) ?? '';
    return { ...prompt, threadId, threadTitle };
  });
}

function extractLink(call: LangGraphCallRow): ExtractedLink {
  const keys = new Set<string>();
  let title = '';
  for (const raw of [call.request, call.response]) {
    const parsed = parseObject(raw);
    if (parsed === undefined) {
      continue;
    }
    collectObjectKeys(parsed, keys);
    if (title === '') {
      title = extractTitle(parsed);
    }
  }
  return { keys: [...keys], title };
}

function collectObjectKeys(record: Readonly<Record<string, unknown>>, keys: Set<string>): void {
  addPrefixed(keys, 'story', record['storyId']);
  addPrefixed(keys, 'story', record['activeStoryId']);
  addPrefixed(keys, 'run', record['runId']);
  addPrefixed(keys, 'run', record['activeRunId']);
  addPrefixed(keys, 'coach', record['sessionId']);
  addPrefixed(keys, 'coach', record['activeCoachId']);
  addPrefixed(keys, 'handoff', record['handoffId']);
  if (isHandoffPayload(record)) {
    addPrefixed(keys, 'handoff', record['id']);
  }
  collectArrayKeys(record['handoffs'], 'handoff', keys);
  collectArrayKeys(record['activeStories'], 'story', keys);
  collectArrayKeys(record['activeRuns'], 'run', keys);
}

function collectArrayKeys(value: unknown, prefix: string, keys: Set<string>): void {
  if (!Array.isArray(value)) {
    return;
  }
  for (const item of value) {
    if (isRecord(item)) {
      addPrefixed(keys, prefix, item['id']);
      addPrefixed(keys, 'story', item['activeStoryId']);
      addPrefixed(keys, 'run', item['activeRunId']);
      addPrefixed(keys, 'coach', item['activeCoachId']);
    }
  }
}

function extractTitle(record: Readonly<Record<string, unknown>>): string {
  if (typeof record['topic'] === 'string' && record['topic'].trim() !== '') {
    return record['topic'].trim();
  }
  if (Array.isArray(record['handoffs'])) {
    for (const item of record['handoffs']) {
      if (isRecord(item) && typeof item['topic'] === 'string' && item['topic'].trim() !== '') {
        return item['topic'].trim();
      }
    }
  }
  return '';
}

function isHandoffPayload(record: Readonly<Record<string, unknown>>): boolean {
  return typeof record['topic'] === 'string' && typeof record['client'] === 'string';
}

function addPrefixed(keys: Set<string>, prefix: string, value: unknown): void {
  if (typeof value === 'string' && value.trim() !== '') {
    keys.add(`${prefix}:${value.trim()}`);
  }
}

function parseObject(raw: string): Readonly<Record<string, unknown>> | undefined {
  if (raw.trim() === '' || !raw.trimStart().startsWith('{')) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(row: Row, field: string): string {
  const value = row[field];
  return typeof value === 'string' ? value : '';
}
