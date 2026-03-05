import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAppTestProviders } from '@/app/core/testing/app-test-providers';
import { PairWaitingComponent } from './pair-waiting.component';

describe('PairComponent', () => {
  let component: PairWaitingComponent;
  let fixture: ComponentFixture<PairWaitingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PairWaitingComponent],
      providers: [...provideAppTestProviders()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PairWaitingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
