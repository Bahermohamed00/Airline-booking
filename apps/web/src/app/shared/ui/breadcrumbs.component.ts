import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface BreadcrumbItem {
  label: string;
  link?: string;
}

@Component({
  selector: 'na-breadcrumbs',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Breadcrumb" class="crumbs">
      <ol>
        @for (item of items(); track item.label; let last = $last) {
          <li>
            @if (item.link && !last) {
              <a [routerLink]="item.link">{{ item.label }}</a>
            } @else {
              <span [attr.aria-current]="last ? 'page' : null">{{ item.label }}</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styles: `
    .crumbs ol { list-style: none; display: flex; flex-wrap: wrap; gap: var(--na-space-2); padding: 0; margin: 0 0 var(--na-space-4); font-size: var(--na-text-sm); }
    .crumbs li:not(:last-child)::after { content: '/'; margin-left: var(--na-space-2); color: var(--na-ink-300); }
    .crumbs span { color: var(--na-ink-500); }
  `,
})
export class NaBreadcrumbs {
  readonly items = input.required<BreadcrumbItem[]>();
}
