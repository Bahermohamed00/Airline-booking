import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { AuthService } from '../services/auth.service';

/** Structural directive: renders content only when the current staff user
 *  holds the given permission. Super Admin passes every check. */
@Directive({
  selector: '[naHasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly template = inject(TemplateRef);
  private readonly view = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);

  readonly naHasPermission = input.required<string>();

  constructor() {
    effect(() => {
      const allowed = this.auth.hasPermission(this.naHasPermission());
      this.view.clear();
      if (allowed) this.view.createEmbeddedView(this.template);
    });
  }
}
