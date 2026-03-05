import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '@/app/core/guards/auth.service';
import { PairService } from '@/app/core/services/pair.service';
import { UiButtonComponent } from '@/app/ui';

@Component({
  standalone: true,
  selector: 'app-pair',
  imports: [UiButtonComponent],
  templateUrl: './pair.component.html',
  styleUrl: './pair.component.scss',
})
export class PairComponent {
  private auth = inject(AuthService);
  private pair = inject(PairService);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly ok = signal<string | null>(null);

  readonly profile = this.auth.profile;

  readonly partnerLabel = computed(() => {
    const p = this.profile();
    return p?.partnerEmail ?? p?.partnerUid ?? null;
  });

  async breakPair() {
    this.error.set(null);
    this.ok.set(null);

    this.saving.set(true);
    try {
      await this.pair.breakPair();
      this.ok.set('Пара разорвана');
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Ошибка разрыва пары');
    } finally {
      this.saving.set(false);
    }
  }
}