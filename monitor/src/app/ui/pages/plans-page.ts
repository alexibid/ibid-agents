import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PlansStore } from '../../application/records-stores';
import type { Note } from '../../domain/records';
import { Button } from '../atoms/button';
import { Dialog } from '../atoms/dialog';
import { TextField } from '../atoms/text-field';
import { TrashButton } from '../atoms/trash-button';

const KIND_NAMES: Readonly<Record<Note['kind'], string>> = { idea: 'Ideia', plan: 'Plano', decision: 'Decisão', research: 'Investigação' };
const STATUS_NAMES: Readonly<Record<Note['status'], string>> = { open: 'por concretizar', done: 'concretizado', dropped: 'abandonado' };
const NO_PLAN = '';

@Component({
  selector: 'monitor-plans-page',
  imports: [DatePipe, Button, Dialog, TextField, TrashButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plans-page.html',
  styleUrl: './plans-page.scss',
})
export class PlansPage {
  protected readonly store = inject(PlansStore);
  protected readonly kindNames = KIND_NAMES;
  protected readonly statusNames = STATUS_NAMES;
  protected readonly doomedId = signal(NO_PLAN);
  protected readonly doomed = computed(() => this.store.plans().find((plan) => plan.id === this.doomedId()));
  protected readonly failure = signal('');

  protected forget(planId: string): void {
    this.store.forget(planId).subscribe({
      next: () => this.doomedId.set(NO_PLAN),
      error: () => this.failure.set('Não foi possível apagar. O serviço está ligado?'),
    });
  }

  protected closeConfirmation(): void {
    this.doomedId.set(NO_PLAN);
    this.failure.set('');
  }
}
