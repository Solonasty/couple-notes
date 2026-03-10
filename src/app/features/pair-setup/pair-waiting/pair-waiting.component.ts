import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButtonComponent } from '@/app/ui';
import { AuthService } from '@/app/core/guards/auth.service';
import { PairProgressComponent } from '../pair-progress/pair-progress.component';

@Component({
  standalone: true,
  selector: 'app-pair-waiting',
  imports: [RouterLink, UiButtonComponent, PairProgressComponent],
  templateUrl: './pair-waiting.component.html',
  styleUrl: './pair-waiting.component.scss',
})
export class PairWaitingComponent {
  private auth = inject(AuthService);

  readonly hasPair = computed(() => !!this.auth.profile()?.pairId);
}