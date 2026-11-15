import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { commandToRun, summaryOf, type CaseReport } from '../../domain/evals';
import { CopyButton } from '../atoms/copy-button';

@Component({
  selector: 'monitor-agent-evals',
  imports: [DatePipe, CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="evals">
      @let summary = totals();
      <div class="o-row">
        <h3>Avaliações</h3>
        @if (summary.total > 0) {
          <span [class]="summary.passed === summary.total ? 'evals__score evals__score--good' : 'evals__score'">
            {{ summary.passed }} de {{ summary.total }} passaram{{ summary.neverRun > 0 ? ' · ' + summary.neverRun + ' por correr' : '' }}
          </span>
        }
      </div>
      @if (summary.total === 0) {
        <p class="u-muted">Sem avaliação automática: este agente mexe em contas, ficheiros ou programas teus, por isso não corre sozinho.</p>
      } @else {
        <div class="o-row">
          <span class="u-muted">Correr de novo:</span>
          <monitor-copy-button [text]="command()" />
        </div>
        @for (report of cases(); track report.caseId) {
          <article [class]="'evals__case evals__case--' + report.lastResult">
            <p>
              <strong>{{ outcomeNames[report.lastResult] }}</strong>
              @if (report.ranOn) {
                · {{ report.ranOn | date: 'd MMM, HH:mm' }}
              }
            </p>
            <p>{{ report.request }}</p>
            <p class="u-muted">
              Tem de chegar {{ report.stopsAt === 'finished' ? 'ao fim do fluxo' : 'ao passo "' + report.stopsAt + '" e parar aí' }}{{
                report.mentions.length ? ' e falar de ' + report.mentions.join(', ') : ''
              }}.
            </p>
            @for (detail of report.details; track $index) {
              <p class="evals__problem">{{ detail }}</p>
            }
          </article>
        }
      }
    </section>
  `,
  styleUrl: './agent-evals.scss',
})
export class AgentEvals {
  readonly agent = input.required<string>();
  readonly cases = input.required<readonly CaseReport[]>();

  protected readonly totals = computed(() => summaryOf(this.cases()));
  protected readonly command = computed(() => commandToRun(this.agent()));
  protected readonly outcomeNames: Readonly<Record<CaseReport['lastResult'], string>> = {
    passed: 'Passou',
    failed: 'Falhou',
    'never-run': 'Ainda não correu',
  };
}
