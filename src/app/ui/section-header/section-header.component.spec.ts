import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UiSectionHeaderComponent } from './section-header.component';

describe('DashboardComponent', () => {
  let component: UiSectionHeaderComponent;
  let fixture: ComponentFixture<UiSectionHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiSectionHeaderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UiSectionHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
