import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAppTestProviders } from '@/app/core/testing/app-test-providers';
import { PairInviteComponent } from './pair-invite.component';

describe('PairComponent', () => {
  let component: PairInviteComponent;
  let fixture: ComponentFixture<PairInviteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PairInviteComponent],
      providers: [...provideAppTestProviders()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PairInviteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
