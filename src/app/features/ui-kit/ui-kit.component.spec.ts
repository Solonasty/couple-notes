import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UIKitComponent } from './ui-kit.component';



describe('UIKitComponent', () => {
  let component: UIKitComponent;
  let fixture: ComponentFixture<UIKitComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UIKitComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UIKitComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
