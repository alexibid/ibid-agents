import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PromptsStore } from '../../application/prompts-store';
import { callsTo } from '../../domain/agent-graph';
import { secondsTakenBy, tokensSpentOn } from '../../domain/prompt';
import { Dialog } from '../atoms/dialog';
import { Percent } from '../atoms/percent';
import { ToolBadge } from '../atoms/tool-badge';
import { AgentGraph } from '../molecules/agent-graph';
import { AgentMessages } from '../organisms/agent-messages';

const NO_AGENT_PICKED = '';

@Component({
  selector: 'monitor-prompt-page',
  imports: [DatePipe, DecimalPipe, RouterLink, Dialog, Percent, ToolBadge, AgentGraph, AgentMessages],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prompt-page.html',
  styleUrl: './prompt-page.scss',
})
export class PromptPage {
  readonly promptId = input.required<string>();

  private readonly store = inject(PromptsStore);

  protected readonly prompt = computed(() => this.store.openPrompts().find((prompt) => prompt.id === this.promptId()));
  protected readonly pickedAgent = signal(NO_AGENT_PICKED);
  protected readonly pickedCalls = computed(() => callsTo(this.pickedAgent(), this.prompt()?.calls ?? []));
  protected readonly tokensSpentOn = tokensSpentOn;
  protected readonly secondsTakenBy = secondsTakenBy;

  constructor() {
    effect(() => this.store.open(this.promptId()));
  }

  protected closeMessages(): void {
    this.pickedAgent.set(NO_AGENT_PICKED);
  }
}
