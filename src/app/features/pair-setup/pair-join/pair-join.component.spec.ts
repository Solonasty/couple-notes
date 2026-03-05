import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAppTestProviders } from '@/app/core/testing/app-test-providers';
import { PairJoinComponent } from './pair-join.component';

describe('PairComponent', () => {
  let component: PairJoinComponent;
  let fixture: ComponentFixture<PairJoinComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PairJoinComponent],
      providers: [...provideAppTestProviders()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PairJoinComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
