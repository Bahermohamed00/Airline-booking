import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

export interface AutocompleteOption {
  value: string;
  label: string;
  hint?: string;
}

@Component({
  selector: 'na-autocomplete',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ac" (focusout)="onBlur()">
      <label class="na-label" [attr.for]="inputId()">{{ label() }}</label>
      <input
        class="na-input"
        [id]="inputId()"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="inputId() + '-list'"
        [placeholder]="placeholder()"
        [value]="text()"
        [disabled]="disabled()"
        (input)="onInput($event)"
        (focus)="onFocus()"
      />
      @if (open() && filtered().length) {
        <ul class="ac__list" [id]="inputId() + '-list'" role="listbox">
          @for (option of filtered(); track option.value) {
            <li role="option" [attr.aria-selected]="option.value === text()">
              <button type="button" class="ac__option" (mousedown)="pick(option)">
                <span class="ac__value">{{ option.label }}</span>
                @if (option.hint) { <span class="ac__hint">{{ option.hint }}</span> }
              </button>
            </li>
          }
        </ul>
      } @else if (open() && !loading() && text().trim()) {
        <ul class="ac__list" [id]="inputId() + '-list'" role="listbox">
          <li class="ac__empty" role="option" aria-disabled="true">No matches found</li>
        </ul>
      }
    </div>
  `,
  styles: `
    .ac { position: relative; }
    .ac__list {
      position: absolute; top: 100%; left: 0; right: 0; z-index: 50;
      background: var(--na-surface-raised); border: 1px solid var(--na-border);
      border-radius: var(--na-radius-md); box-shadow: var(--na-shadow-md);
      list-style: none; margin: var(--na-space-1) 0 0; padding: var(--na-space-1); max-height: 260px; overflow-y: auto;
    }
    .ac__option {
      width: 100%; display: flex; justify-content: space-between; gap: var(--na-space-3); align-items: baseline;
      background: none; border: none; text-align: left; padding: var(--na-space-2) var(--na-space-3);
      border-radius: var(--na-radius-sm); min-height: 44px;
    }
    .ac__option:hover, .ac__option:focus-visible { background: var(--na-blue-100); }
    .ac__value { font-weight: var(--na-font-medium); }
    .ac__hint { color: var(--na-ink-500); font-size: var(--na-text-xs); }
    .ac__empty {
      padding: var(--na-space-2) var(--na-space-3); min-height: 44px;
      display: flex; align-items: center;
      color: var(--na-ink-500); font-size: var(--na-text-sm);
    }
  `,
})
export class NaAutocomplete {
  readonly inputId = input(`ac-${Math.random().toString(36).slice(2, 8)}`);
  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly options = input<AutocompleteOption[]>([]);
  readonly disabled = input(false);
  /** When true, options arrive pre-filtered from the server and are shown as-is. */
  readonly serverSide = input(false);
  readonly loading = input(false);
  readonly selected = output<AutocompleteOption>();
  readonly query = output<string>();
  readonly focused = output<void>();

  readonly text = signal('');
  readonly open = signal(false);
  readonly filtered = computed(() => {
    const opts = this.options();
    if (this.serverSide()) return opts;
    const q = this.text().toLowerCase();
    return opts.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  });

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.text.set(value);
    this.query.emit(value);
    this.open.set(true);
  }

  onFocus(): void {
    this.open.set(true);
    this.focused.emit();
  }

  pick(option: AutocompleteOption): void {
    this.text.set(option.label);
    this.open.set(false);
    this.selected.emit(option);
  }

  onBlur(): void {
    setTimeout(() => this.open.set(false), 150);
  }
}
