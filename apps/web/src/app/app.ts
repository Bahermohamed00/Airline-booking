import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NaToastHost } from './shared/ui/toast-host.component';

@Component({
  imports: [RouterOutlet, NaToastHost],
  selector: 'app-root',
  styleUrl: './app.scss',
  template: `
    <router-outlet />
    <na-toast-host />
  `,
})
export class App {}
