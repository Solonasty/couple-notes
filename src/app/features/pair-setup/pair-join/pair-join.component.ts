import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UiButtonComponent, UiInputComponent } from '@/app/ui';
import { PairCodeService } from '@/app/core/guards/pair-code.service';
import { PairProgressComponent } from '../pair-progress/pair-progress.component';

@Component({
  standalone: true,
  selector: 'app-pair-join',
  imports: [RouterLink, ReactiveFormsModule, UiButtonComponent, UiInputComponent, PairProgressComponent],
  templateUrl: './pair-join.component.html',
  styleUrl: './pair-join.component.scss',
})
export class PairJoinComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private pairCode = inject(PairCodeService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(24)]],
  });

  constructor() {
    this.form.valueChanges.subscribe(() => this.error.set(null));
  }

  async submit() {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const { code } = this.form.getRawValue();

      await this.pairCode.useCodeAndCreatePair(code);

      await this.router.navigateByUrl('/app/pair-setup/waiting', { replaceUrl: true });
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : 'Не удалось использовать код');
    } finally {
      this.loading.set(false);
    }
  }
}