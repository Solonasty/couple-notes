import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { signal } from '@angular/core';
import { AuthService } from '../../guards/auth.service';
import { PairSetupShellComponent } from './pair-setup-shell.component';

class AuthServiceMock {
  user = signal<any | null>({ email: 'test@mail.com' });
  logout = jasmine.createSpy('logout').and.resolveTo(void 0);
}

describe('ShellComponent', () => {
  let component: PairSetupShellComponent;
  let fixture: ComponentFixture<PairSetupShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PairSetupShellComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useClass: AuthServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PairSetupShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
