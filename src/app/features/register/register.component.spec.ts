import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RegisterComponent } from './register.component';

import { signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

class AuthServiceMock {
  user = signal<any | null>(null);
  signIn = jasmine.createSpy('signIn').and.resolveTo(void 0);
  signUp = jasmine.createSpy('signUp').and.resolveTo(void 0);
  logout = jasmine.createSpy('logout').and.resolveTo(void 0);
}

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useClass: AuthServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
