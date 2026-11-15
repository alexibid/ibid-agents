import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { CatalogEntry, FlowNode, StoryStep } from '../../domain/flow-map';

@Component({
  selector: 'monitor-step-detail',
  imports: [DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let shown = node();
    <dl class="step">
      <dt>Quem faz</dt>
      <dd>{{ shown.doneBy }}</dd>
      <dt>O que faz</dt>
      <dd>{{ shown.task || 'Passo interno do LangGraph.' }}</dd>
      @if (shown.calls?.length) {
        <dt>Chama</dt>
        <dd>{{ shown.calls?.join(', ') }}</dd>
      }
    </dl>
    @for (file of shown.contracts; track file) {
      <article class="step__contract">
        <h3>{{ jobOf(file)?.name ?? file }} <span class="u-muted">agents/{{ file }}</span></h3>
        <p>{{ jobOf(file)?.job }}</p>
      </article>
    }
    @for (file of shown.contractsWhenNeeded; track file) {
      <article class="step__contract step__contract--optional">
        <h3>{{ jobOf(file)?.name ?? file }} <span class="u-muted">agents/{{ file }} · só quando a mudança o pede</span></h3>
        <p>{{ jobOf(file)?.job }}</p>
      </article>
    }
    <h3>Nesta user story</h3>
    @for (event of events(); track $index) {
      <article class="step__event" [class.step__event--failed]="!event.passed">
        <p>
          Tentativa {{ event.attempt }} · {{ event.passed ? 'passou' : 'falhou' }} · {{ event.occurredOn | date: 'd MMM, HH:mm:ss' }} ·
          {{ event.seconds | number: '1.0-1' }} s
        </p>
        @for (detail of event.details; track $index) {
          <pre>{{ detail }}</pre>
        }
      </article>
    } @empty {
      <p class="u-muted">Sem registos deste passo na user story escolhida.</p>
    }
  `,
  styleUrl: './step-detail.scss',
})
export class StepDetail {
  readonly node = input.required<FlowNode>();
  readonly catalog = input.required<readonly CatalogEntry[]>();
  readonly events = input.required<readonly StoryStep[]>();

  protected jobOf(file: string): CatalogEntry | undefined {
    return this.catalog().find((entry) => entry.file === file);
  }
}
