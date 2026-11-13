import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PromptsStore } from '../../application/prompts-store';
import { Button } from '../atoms/button';
import { PromptTable } from '../organisms/prompt-table';

@Component({
  selector: 'monitor-prompts-page',
  imports: [PromptTable, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="o-stack">
      <h1>Pedidos</h1>
      @if (store.prompts().length > 0) {
        <div class="o-panel"><monitor-prompt-table [prompts]="store.prompts()" /></div>
        <div class="o-row"><monitor-button look="quiet" (click)="store.showMore()">Mostrar mais antigos</monitor-button></div>
      } @else {
        <p class="o-panel o-empty">Ainda não há pedidos registados. Aparecem aqui assim que falares com o Claude ou com o Antigravity.</p>
      }
    </section>
  `,
})
export class PromptsPage {
  protected readonly store = inject(PromptsStore);
}
