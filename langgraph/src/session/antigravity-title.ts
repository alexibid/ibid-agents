import { askAntigravity } from '../limits/antigravity-language-server.js';

const UPDATE_ANNOTATIONS = 'UpdateConversationAnnotations';
const CONVERSATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CODED = /#|\b\d+\b/;

export class CodedTitleError extends Error {
  constructor(title: string) {
    super(`"${title}" uses numbers or #. Write the title in plain words, such as "Livro no desktop › Abrir e fechar suave".`);
    this.name = 'CodedTitleError';
  }
}

export class UnknownConversationError extends Error {
  constructor(conversationId: string) {
    super(`"${conversationId}" is not an Antigravity conversation id.`);
    this.name = 'UnknownConversationError';
  }
}

export function titleRequestOf(conversationId: string, title: string): object {
  if (!CONVERSATION_ID.test(conversationId)) {
    throw new UnknownConversationError(conversationId);
  }
  if (CODED.test(title)) {
    throw new CodedTitleError(title);
  }
  return { cascadeId: conversationId, annotations: { title }, mergeAnnotations: true };
}

export async function setAntigravityTitle(conversationId: string, title: string): Promise<string> {
  await askAntigravity(UPDATE_ANNOTATIONS, titleRequestOf(conversationId, title), acceptedAnswer);
  return title;
}

function acceptedAnswer(answer: unknown): true | undefined {
  return typeof answer === 'object' && answer !== null ? true : undefined;
}
