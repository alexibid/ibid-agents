import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { AgentCall } from '../../domain/prompt';

@Component({
  selector: 'monitor-agent-messages',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (call of calls(); track call.id) {
      <article class="exchange" [class.exchange--failed]="call.failed">
        <p class="exchange__when">{{ call.calledOn | date: 'd MMM, HH:mm:ss' }}{{ call.failed ? ' · falhou' : '' }}</p>
        <section class="exchange__side">
          <h3 class="exchange__label">O que lhe foi pedido</h3>
          <pre>{{ call.request || 'Sem texto.' }}</pre>
        </section>
        <section class="exchange__side">
          <h3 class="exchange__label">{{ call.kind === 'langgraph' ? 'O que o LangGraph respondeu' : 'O que devolveu' }}</h3>
          <pre>{{ call.response || 'Ainda sem resposta registada.' }}</pre>
        </section>
      </article>
    } @empty {
      <p class="o-empty">Não há mensagens registadas para este agente.</p>
    }
  `,
  styleUrl: './agent-messages.scss',
})
export class AgentMessages {
  readonly calls = input.required<readonly AgentCall[]>();
}
