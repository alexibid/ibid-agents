import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BacklogStore } from '../../application/records-stores';
import { filterOutline, outlineOf, type Epic, type EpicOutline } from '../../domain/backlog';
import { TextField } from '../atoms/text-field';
import { BacklogEntry } from '../molecules/backlog-entry';

interface FilteredEpic {
  readonly epic: Epic;
  readonly outline: EpicOutline;
}

@Component({
  selector: 'monitor-backlog-page',
  imports: [DatePipe, BacklogEntry, TextField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './backlog-page.html',
  styleUrl: './backlog-page.scss',
})
export class BacklogPage {
  private readonly store = inject(BacklogStore);

  protected readonly query = signal('');

  protected readonly epics = computed(() => {
    const query = this.query();
    const results: FilteredEpic[] = [];
    for (const epic of this.store.epics()) {
      const outline = filterOutline(outlineOf(epic), query);
      if (outline !== null) {
        results.push({ epic, outline });
      }
    }
    return results;
  });
}
