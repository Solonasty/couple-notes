import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PairComponent } from './pair.component';
import { provideAppTestProviders } from '@/app/core/testing/app-test-providers';



describe('PairComponent', () => {
  let component: PairComponent;
  let fixture: ComponentFixture<PairComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PairComponent],
      providers: [...provideAppTestProviders()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PairComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
