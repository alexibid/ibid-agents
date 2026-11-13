import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
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

  protected readonly tokensSpentOn = tokensSpentOn;
}
