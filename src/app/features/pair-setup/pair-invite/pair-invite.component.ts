import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PairCodeInvite } from '@/app/core/models/pair-code-invite.type';
import { UiButtonComponent } from '@/app/ui';
import { PairCodeService } from '@/app/core/guards/pair-code.service';
import { PairProgressComponent } from '../pair-progress/pair-progress.component';

@Component({
  standalone: true,
  selector: 'app-pair-invite',
  imports: [RouterLink, UiButtonComponent, PairProgressComponent],
  templateUrl: './pair-invite.component.html',
  styleUrl: './pair-invite.component.scss',
})
export class PairInviteComponent {
  private pairCode = inject(PairCodeService);
  private destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly copied = signal(false);

  readonly code = signal<string | null>(null);
  readonly invite = signal<PairCodeInvite | null>(null);

  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    void this.generate();

    this.destroyRef.onDestroy(() => {
      if (this.copiedTimer) {
        clearTimeout(this.copiedTimer);
      }
    });

    effect((onCleanup) => {
      const c = this.code();
      if (!c) return;

      const sub = this.pairCode.watchInvite(c).subscribe({
        next: (inv) => this.invite.set(inv ?? null),
        error: () => this.error.set('Не удалось получить состояние кода'),
      });

      onCleanup(() => sub.unsubscribe());
    });
  }

  async generate() {
    this.loading.set(true);
    this.error.set(null);
    this.invite.set(null);
    this.copied.set(false);

    try {
      const code = await this.pairCode.createInvite();
      this.code.set(code);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Ошибка генерации кода');
    } finally {
      this.loading.set(false);
    }
  }

  async copyCode() {
    const c = this.code();
    if (!c) return;

    try {
      await navigator.clipboard.writeText(c);
      this.showCopiedNotice();
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = c;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);

        this.showCopiedNotice();
      } catch {
        this.error.set('Не удалось скопировать код');
      }
    }
  }

  private showCopiedNotice() {
    this.copied.set(true);

    if (this.copiedTimer) {
      clearTimeout(this.copiedTimer);
    }
  }

  statusText(): string {
    const s = this.invite()?.status ?? 'open';
    if (s === 'cancelled') return 'Код отменён';
    if (s === 'expired') return 'Срок действия истёк';
    return '';
  }
}