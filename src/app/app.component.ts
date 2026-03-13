import { Component, afterNextRender, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PairProfileSyncService } from './core/services/pair-profile-sync.service';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
})

export class AppComponent {
  private pairSync = inject(PairProfileSyncService);

  constructor() {
    this.pairSync.init().subscribe({
      error: (e) => console.error('Pair sync failed', e),
    });

    afterNextRender(() => {
      requestAnimationFrame(() => {
        this.hideSplash();
      });
    });
  }

  private hideSplash(): void {
    const splash = document.getElementById('app-splash');
    if (!splash || splash.classList.contains('app-splash--hidden')) return;

    splash.classList.add('app-splash--hidden');

    setTimeout(() => {
      splash.remove();
    }, 250);
  }
}
