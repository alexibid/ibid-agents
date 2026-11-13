import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';

const SHOWN_FOR_MS = 1800;

@Component({
  selector: 'monitor-copy-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button class="copy-button" type="button" [attr.aria-label]="'Copiar ' + text()" (click)="copy($event)">
      <code class="copy-button__text">{{ text() }}</code>
      <span class="copy-button__state" aria-live="polite">{{ copied() ? 'Copiado' : 'Copiar' }}</span>
    </button>
  `,
  styleUrl: './copy-button.scss',
})
export class CopyButton {
  readonly text = input.required<string>();

  protected readonly copied = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected copy(event: Event): void {
    event.stopPropagation();
    void navigator.clipboard.writeText(this.text()).then(() => {
      this.copied.set(true);
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.copied.set(false), SHOWN_FOR_MS);
    });
  }
}
