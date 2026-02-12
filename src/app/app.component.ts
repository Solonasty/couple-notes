import { Component, inject } from '@angular/core';
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
  }
}
