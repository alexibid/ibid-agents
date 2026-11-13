import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotesStore } from '../../application/records-stores';
import type { Note } from '../../domain/records';
import { TextField } from '../atoms/text-field';

const KIND_NAMES: Readonly<Record<Note['kind'], string>> = { idea: 'Ideia', plan: 'Plano', decision: 'Decisão', research: 'Investigação' };
const STATUS_NAMES: Readonly<Record<Note['status'], string>> = { open: 'por executar', done: 'feito', dropped: 'abandonado' };

@Component({
  selector: 'monitor-memory-page',
  imports: [DatePipe, TextField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="o-stack">
      <h1>Memória</h1>
      <monitor-text-field label="Procurar no que já pensámos" placeholder="Vazio mostra o que está por executar" [(value)]="store.text" />
      @for (note of store.notes(); track note.id) {
        <article class="o-panel o-stack">
          <div class="o-row">
            <h2>{{ note.title }}</h2>
            <span class="u-muted">{{ kindNames[note.kind] }} · {{ statusNames[note.status] }} · {{ note.project }} · {{ note.updatedOn | date: 'd MMM y' }}</span>
          </div>
          <pre>{{ note.body }}</pre>
          @if (note.sources.length > 0) {
            <p class="u-muted">Fontes: {{ note.sources.join(', ') }}</p>
          }
        </article>
      } @empty {
        <p class="o-panel o-empty">{{ store.text() ? 'Nada guardado sobre isso.' : 'Não há ideias nem planos por executar.' }}</p>
      }
    </section>
  `,
})
export class MemoryPage {
  protected readonly store = inject(NotesStore);
  protected readonly kindNames = KIND_NAMES;
  protected readonly statusNames = STATUS_NAMES;
}
