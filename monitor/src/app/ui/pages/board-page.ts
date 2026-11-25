import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BoardStore } from '../../application/records-stores';
import { boardByProject, issueNumberOf, percentDone, STATE_NAMES, type BoardCard, type BoardEpic } from '../../domain/board';
import { ToggleChip } from '../atoms/toggle-chip';

@Component({
  selector: 'monitor-board-page',
  imports: [ToggleChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './board-page.html',
  styleUrl: './board-page.scss',
})
export class BoardPage {
  private readonly store = inject(BoardStore);

  protected readonly showOpen = signal(true);
  protected readonly showClosed = signal(false);
  protected readonly projects = computed(() =>
    boardByProject(this.store.epics(), { open: this.showOpen(), closed: this.showClosed() }),
  );

  protected percentOf(entry: BoardEpic): number {
    return percentDone(entry);
  }

  protected stateName(card: BoardCard): string {
    return STATE_NAMES[card.state];
  }

  protected numberOf(card: BoardCard): string {
    return issueNumberOf(card);
  }
}
