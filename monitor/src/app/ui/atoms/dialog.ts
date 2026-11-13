import { ChangeDetectionStrategy, Component, effect, type ElementRef, input, output, viewChild } from '@angular/core';
import { Button } from './button';

@Component({
  selector: 'monitor-dialog',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #frame class="dialog" (close)="closed.emit()" (click)="closeWhenOutside($event)">
      <header class="dialog__header">
        <h2>{{ heading() }}</h2>
        <monitor-button look="quiet" (click)="frame.close()">Fechar</monitor-button>
      </header>
      <div class="dialog__body"><ng-content /></div>
    </dialog>
  `,
  styleUrl: './dialog.scss',
})
export class Dialog {
  readonly heading = input.required<string>();
  readonly open = input.required<boolean>();
  readonly closed = output<void>();

  private readonly frame = viewChild.required<ElementRef<HTMLDialogElement>>('frame');

  constructor() {
    effect(() => {
      const frame = this.frame().nativeElement;
      if (this.open() && !frame.open) {
        frame.showModal();
      }
      if (!this.open() && frame.open) {
        frame.close();
      }
    });
  }

  protected closeWhenOutside(event: MouseEvent): void {
    if (event.target === this.frame().nativeElement) {
      this.frame().nativeElement.close();
    }
  }
}
