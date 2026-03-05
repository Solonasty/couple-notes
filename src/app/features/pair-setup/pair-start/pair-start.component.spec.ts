import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAppTestProviders } from '@/app/core/testing/app-test-providers';
import { PairStartComponent } from './pair-start.component';



describe('PairComponent', () => {
  let component: PairStartComponent;
  let fixture: ComponentFixture<PairStartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PairStartComponent],
      providers: [...provideAppTestProviders()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PairStartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
