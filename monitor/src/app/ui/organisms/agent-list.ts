import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { AgentGroup } from '../../domain/agent-roster';
import { CopyButton } from '../atoms/copy-button';
import { ListButton } from '../atoms/list-button';

@Component({
  selector: 'monitor-agent-list',
  imports: [DatePipe, CopyButton, ListButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (group of groups(); track group.group) {
    <h3 class="agent-list__group">{{ group.title }} ({{ group.agents.length }})</h3>
    <ul class="agent-list">
      @for (agent of group.agents; track agent.name + agent.kind) {
        <li class="agent-list__row">
          <monitor-list-button [current]="agent.activityName === picked()" (click)="agentPicked.emit(agent.activityName)">
            <span class="agent-list__name">{{ agent.name }}</span>
            <span class="agent-list__facts">
              {{ kindNames[agent.kind] }} · {{ agent.calls }} {{ agent.calls === 1 ? 'execução' : 'execuções' }}
              @if (agent.failures > 0) {
                · <span class="agent-list__failed">{{ agent.failures }} falhou</span>
              }
              @if (agent.lastOn) {
                · {{ agent.lastOn | date: 'd MMM' }}
              }
            </span>
          </monitor-list-button>
          @if (agent.command) {
            <monitor-copy-button class="agent-list__command" [text]="agent.command" />
          }
        </li>
      }
    </ul>
    }
  `,
  styleUrl: './agent-list.scss',
})
export class AgentList {
  readonly groups = input.required<readonly AgentGroup[]>();
  readonly picked = input('');
  readonly agentPicked = output<string>();

  protected readonly kindNames: Readonly<Record<string, string>> = { agent: 'agente', skill: 'skill', langgraph: 'LangGraph', tool: 'ferramenta' };
}
