import { UiSectionHeaderComponent } from '@/app/ui/section-header/section-header.component';
import { UiButtonComponent } from '@/app/ui/ui-button/ui-button.component';
import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  standalone: true,
  selector: 'app-ui-kit',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    UiButtonComponent,
    UiSectionHeaderComponent,
  ],
  templateUrl: './ui-kit.component.html',
})
export class UIKitComponent {}
