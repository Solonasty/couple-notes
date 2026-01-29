import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [MatCardModule],
  template: `
    <mat-card>
      <mat-card-title>Личный кабинет</mat-card-title>
      <mat-card-content>Здесь будет пара, инвайт и быстрые действия.</mat-card-content>
    </mat-card>
  `
})
export class DashboardComponent {}
