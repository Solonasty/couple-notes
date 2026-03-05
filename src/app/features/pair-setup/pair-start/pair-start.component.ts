import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButtonComponent } from '@/app/ui';

@Component({
  standalone: true,
  selector: 'app-pair-start',
  imports: [RouterLink, UiButtonComponent],
  templateUrl: './pair-start.component.html',
  styleUrl: './pair-start.component.scss',
})
export class PairStartComponent {}