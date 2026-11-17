import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BacklogStore } from '../../application/records-stores';
import { outlineOf } from '../../domain/backlog';
import { BacklogEntry } from '../molecules/backlog-entry';

@Component({
  selector: 'monitor-backlog-page',
  imports: [DatePipe, BacklogEntry],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './backlog-page.html',
  styleUrl: './backlog-page.scss',
})
export class BacklogPage {
  private readonly store = inject(BacklogStore);

  protected readonly epics = computed(() =>
    this.store.epics().map((epic) => ({ epic, outline: outlineOf(epic) })),
  );
}
