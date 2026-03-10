import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButtonComponent } from '@/app/ui';
import { PairProgressComponent } from '../pair-progress/pair-progress.component';

@Component({
  standalone: true,
  selector: 'app-pair-start',
  imports: [RouterLink, UiButtonComponent, PairProgressComponent],
  templateUrl: './pair-start.component.html',
  styleUrl: './pair-start.component.scss',
})
export class PairStartComponent {}