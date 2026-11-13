import { Injectable } from '@angular/core';
import { invoke, isTauri } from '@tauri-apps/api/core';

@Injectable({ providedIn: 'root' })
export class MenuBar {
  show(text: string): void {
    if (isTauri()) {
      void invoke('show_limits', { text });
    }
  }
}
