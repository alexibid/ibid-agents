import { describe, expect, it } from 'vitest';
import { CodedTitleError, titleRequestOf, UnknownConversationError } from './antigravity-title.js';

describe('titleRequestOf', () => {
  it('should ask Antigravity to merge the new title into the conversation annotations', () => {
    const request = titleRequestOf('6cd02de9-d6fa-4b35-b148-81c42b500926', 'Livro no desktop › Abrir e fechar suave');

    expect(request).toEqual({
      cascadeId: '6cd02de9-d6fa-4b35-b148-81c42b500926',
      annotations: { title: 'Livro no desktop › Abrir e fechar suave' },
      mergeAnnotations: true,
    });
  });

  it('should refuse a title the user has to decode', () => {
    expect(() => titleRequestOf('6cd02de9-d6fa-4b35-b148-81c42b500926', '#20 › #24 Isolate admin CSS')).toThrow(CodedTitleError);
  });

  it('should refuse something that is not a conversation id', () => {
    expect(() => titleRequestOf('brain/6cd02de9', 'title')).toThrow(UnknownConversationError);
  });
});
