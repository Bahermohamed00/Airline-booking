import { Injectable, signal } from '@angular/core';
import type { StatusTone } from '../utils/status-maps';

export interface Toast {
  id: number;
  message: string;
  tone: StatusTone;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  readonly toasts = signal<Toast[]>([]);

  show(message: string, tone: StatusTone = 'info', durationMs = 4000): void {
    const id = this.nextId++;
    this.toasts.update((t) => [...t, { id, message, tone }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  success(message: string): void { this.show(message, 'success'); }
  error(message: string): void { this.show(message, 'danger'); }
  info(message: string): void { this.show(message, 'info'); }
  warning(message: string): void { this.show(message, 'warning'); }

  dismiss(id: number): void {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}
