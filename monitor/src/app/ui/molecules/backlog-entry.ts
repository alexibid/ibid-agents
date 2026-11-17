import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { issueNameOf, type BacklogItem } from '../../domain/backlog';

const KIND_NAMES: Readonly<Record<BacklogItem['kind'], string>> = { epic: 'Épico', story: 'Story', task: 'Tarefa' };

@Component({
  selector: 'monitor-backlog-entry',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="backlog-entry" [class.backlog-entry--draft]="item().state === 'draft'">
      <summary class="backlog-entry__summary">
        <span class="backlog-entry__key">{{ item().key }}</span>
        <span class="backlog-entry__title">{{ item().title }}</span>
        <span class="backlog-entry__size" [attr.aria-label]="'Tamanho ' + item().size">{{ item().size }}</span>
        @if (item().state === 'published') {
          <a class="backlog-entry__link" [href]="item().issueUrl" target="_blank" rel="noopener">{{ issueName() }}</a>
        } @else {
          <span class="backlog-entry__pending">Ainda não está no GitHub</span>
        }
      </summary>
      <p class="u-muted">{{ kindName() }} · {{ item().repository }} · {{ item().labels.join(', ') }}</p>
      <p class="backlog-entry__body">{{ item().body }}</p>
    </details>
  `,
  styleUrl: './backlog-entry.scss',
})
export class BacklogEntry {
  readonly item = input.required<BacklogItem>();

  protected readonly issueName = computed(() => issueNameOf(this.item()));
  protected readonly kindName = computed(() => KIND_NAMES[this.item().kind]);
}
