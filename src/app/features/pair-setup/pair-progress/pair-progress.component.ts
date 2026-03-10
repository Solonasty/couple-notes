import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgClass } from '@angular/common';

type PairSetupStep = 1 | 2 | 3;

@Component({
  selector: 'app-pair-setup-progress',
  standalone: true,
  imports: [NgClass],
  templateUrl: './pair-progress.component.html',
  styleUrl: './pair-progress.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PairProgressComponent {
  readonly currentStep = input.required<PairSetupStep>();
  readonly currentStepLabel = input.required<string>();

  readonly steps = [1, 2, 3] as const;
  readonly totalSteps = this.steps.length;

  readonly progressPercent = computed(() => {
    switch (this.currentStep()) {
      case 1: return 32;
      case 2: return 70;
      case 3: return 100;
    }
  });
}