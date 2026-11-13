import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProblemsStore } from '../../application/records-stores';
import { ChoiceField, type Choice } from '../atoms/choice-field';
import { TextField } from '../atoms/text-field';
import { ToolBadge } from '../atoms/tool-badge';

const SOURCES: readonly Choice[] = [
  { value: '', label: 'Todas' },
  { value: 'claude', label: 'Claude' },
  { value: 'antigravity', label: 'Antigravity' },
  { value: 'langgraph', label: 'LangGraph' },
];

@Component({
  selector: 'monitor-problems-page',
  imports: [DatePipe, RouterLink, ChoiceField, TextField, ToolBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="o-stack">
      <h1>Erros</h1>
      <div class="o-row">
        <monitor-choice-field label="Origem" [choices]="sources" [(value)]="store.tool" />
        <monitor-text-field label="Procurar" placeholder="Texto do erro ou do sítio" [(value)]="store.text" />
      </div>
      @if (store.problems().length > 0) {
        <div class="o-panel">
          <table>
            <thead><tr><th scope="col">Quando</th><th scope="col">Origem</th><th scope="col">Onde</th><th scope="col">Erro</th></tr></thead>
            <tbody>
              @for (problem of store.problems(); track $index) {
                <tr>
                  <td>{{ problem.occurredOn | date: 'd MMM, HH:mm' }}</td>
                  <td><monitor-tool-badge [tool]="problem.tool" /></td>
                  <td>
                    @if (problem.promptId) {
                      <a [routerLink]="['/pedido', problem.promptId]">{{ problem.where }}</a>
                    } @else {
                      {{ problem.where }}
                    }
                  </td>
                  <td><pre>{{ problem.message }}</pre></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="o-panel o-empty">Nenhum erro registado com estes filtros.</p>
      }
    </section>
  `,
})
export class ProblemsPage {
  protected readonly store = inject(ProblemsStore);
  protected readonly sources = SOURCES;
}
