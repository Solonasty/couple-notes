import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAppTestProviders } from '@/app/core/testing/app-test-providers';
import { PairProgressComponent } from './pair-progress.component';

describe('PairComponent', () => {
  let component: PairProgressComponent;
  let fixture: ComponentFixture<PairProgressComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PairProgressComponent],
      providers: [...provideAppTestProviders()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PairProgressComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
