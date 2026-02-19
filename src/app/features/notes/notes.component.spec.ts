import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotesComponent } from './notes.component';
import { BehaviorSubject } from 'rxjs';
import { NotesService } from '../../core/services/notes.service';
import { Note } from '../../core/services/pair.types';
import { provideAppTestProviders } from '@/app/core/testing/app-test-providers';

class NotesServiceMock {
  notesSubject = new BehaviorSubject<Note[]>([]);
  notes$ = () => this.notesSubject.asObservable();

  add = jasmine.createSpy('add').and.resolveTo(void 0);
  remove = jasmine.createSpy('remove').and.resolveTo(void 0);
}
describe('NotesComponent', () => {
  let component: NotesComponent;
  let fixture: ComponentFixture<NotesComponent>;
  let notesMock: NotesServiceMock;

  beforeEach(async () => {
    notesMock = new NotesServiceMock();

    await TestBed.configureTestingModule({
      imports: [NotesComponent],
      providers: [
        { provide: NotesService, useValue: notesMock },
        ...provideAppTestProviders(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('initial: notes empty, notesCount=0', () => {
    expect(component.notes()).toEqual([]);
    expect(component.notesCount()).toBe(0);
  });
});
