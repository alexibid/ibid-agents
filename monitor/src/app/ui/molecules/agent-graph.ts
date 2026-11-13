import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { agentGraphOf } from '../../domain/agent-graph';
import type { AgentCall } from '../../domain/prompt';

@Component({
  selector: 'monitor-agent-graph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agent-graph.html',
  styleUrl: './agent-graph.scss',
})
export class AgentGraph {
  readonly calls = input.required<readonly AgentCall[]>();
  readonly agentPicked = output<string>();

  protected readonly graph = computed(() => agentGraphOf(this.calls()));
}
