import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { groupConversations } from '../../domain/conversation-group';
import { tokensSpentOn, type PromptSummary } from '../../domain/prompt';
import { Percent } from '../atoms/percent';
import { ToolBadge } from '../atoms/tool-badge';

@Component({
  selector: 'monitor-prompt-table',
  imports: [DatePipe, DecimalPipe, RouterLink, Percent, ToolBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prompt-table.html',
  styleUrl: './prompt-table.scss',
})
export class PromptTable {
  readonly prompts = input.required<readonly PromptSummary[]>();

  protected readonly groups = computed(() => groupConversations(this.prompts()));
  protected readonly tokensSpentOn = tokensSpentOn;

  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  protected isExpanded(groupId: string): boolean {
    return this.expanded().has(groupId);
  }

  protected toggle(groupId: string): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }
}
