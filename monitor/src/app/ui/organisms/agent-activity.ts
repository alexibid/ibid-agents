import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { AgentRun, KnownAgent } from '../../domain/agent-roster';
import { CopyButton } from '../atoms/copy-button';
import { ToolBadge } from '../atoms/tool-badge';
import { TrashButton } from '../atoms/trash-button';

@Component({
  selector: 'monitor-agent-activity',
  imports: [DatePipe, RouterLink, CopyButton, ToolBadge, TrashButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agent-activity.html',
  styleUrl: './agent-activity.scss',
})
export class AgentActivity {
  readonly agent = input.required<KnownAgent>();
  readonly runs = input.required<readonly AgentRun[]>();
  readonly removeAsked = output<void>();
}
