import { inject, Injectable, signal } from '@angular/core';
import type { PromptDetail, PromptSummary } from '../domain/prompt';
import { keptFresh } from './kept-fresh';
import { MonitorGateway } from './monitor-gateway';

const PAGE = 50;
const NO_PROMPT_OPEN = '';

@Injectable({ providedIn: 'root' })
export class PromptsStore {
  private readonly gateway = inject(MonitorGateway);
  private readonly shown = signal(PAGE);
  private readonly openId = signal(NO_PROMPT_OPEN);

  readonly prompts = keptFresh<number, readonly PromptSummary[]>({
    gateway: this.gateway,
    choice: this.shown,
    load: (limit) => this.gateway.prompts(limit),
    whileLoading: [],
  });

  readonly openPrompts = keptFresh<string, readonly PromptDetail[]>({
    gateway: this.gateway,
    choice: this.openId,
    load: (promptId) => this.gateway.promptsWithId(promptId),
    whileLoading: [],
  });

  showMore(): void {
    this.shown.update((shown) => shown + PAGE);
  }

  open(promptId: string): void {
    this.openId.set(promptId);
  }
}
