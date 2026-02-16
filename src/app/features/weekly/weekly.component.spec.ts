import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeeklyComponent } from './weekly.component';
import { of } from 'rxjs';
import { NotesService } from '../../core/services/notes.service';
import { SummaryService } from '../../core/services/summary.service';
import { provideAppTestProviders } from '@/app/core/testing/app-test-providers';

describe('WeeklyComponent', () => {
  let component: WeeklyComponent;
  let fixture: ComponentFixture<WeeklyComponent>;

  const notesServiceMock = {
    notes$: () => of([])
  };

  const summaryServiceMock = {
    getSummary: () => of('test summary')
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeeklyComponent],
      providers: [
        { provide: NotesService, useValue: notesServiceMock },
        { provide: SummaryService, useValue: summaryServiceMock },
        ...provideAppTestProviders(),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WeeklyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
