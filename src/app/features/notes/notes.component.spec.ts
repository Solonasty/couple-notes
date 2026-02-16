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

  it('addNote(): calls service.add with trimmed text', async () => {
    component.openAdd();
    component.form.setValue({ text: '  hello  ' });

    await component.addNote();

    expect(notesMock.add).toHaveBeenCalledWith('hello');
    expect(component.isAdding()).toBeFalse();
    expect(component.form.value.text).toBe('');
  });

  it('addNote(): does not call service.add if invalid', async () => {
    component.form.setValue({ text: '' });

    await component.addNote();

    expect(notesMock.add).not.toHaveBeenCalled();
  });

  it('addNote(): does not call service.add for whitespace-only', async () => {
    component.openAdd();
    component.form.setValue({ text: '   ' });

    await component.addNote();

    expect(notesMock.add).not.toHaveBeenCalled();
    expect(component.isAdding()).toBeTrue();
  });

  it('deleteNote(): calls service.remove', async () => {
    await component.deleteNote('id-1');
    expect(notesMock.remove).toHaveBeenCalledWith('id-1');
  });
});
