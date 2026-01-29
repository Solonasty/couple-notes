import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotesComponent } from './notes.component';

describe('NotesComponent', () => {
  let component: NotesComponent;
  let fixture: ComponentFixture<NotesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotesComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NotesComponent);
    component = fixture.componentInstance;

    if (!(globalThis.crypto as any)) {
      (globalThis as any).crypto = {};
    }
    if (!(globalThis.crypto as any).randomUUID) {
      (globalThis.crypto as any).randomUUID = () => 'uuid-mock';
    }

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('initial state: isAdding=false, notes empty, notesCount=0', () => {
    expect(component.isAdding()).toBeFalse();
    expect(component.notes()).toEqual([]);
    expect(component.notesCount()).toBe(0);
    expect(component.form.value.text).toBe('');
    expect(component.form.valid).toBeFalse(); // required
  });

  it('openAdd(): sets isAdding=true and resets form text', () => {
    component.form.setValue({ text: 'hello' });
    expect(component.form.value.text).toBe('hello');

    component.openAdd();

    expect(component.isAdding()).toBeTrue();
    expect(component.form.value.text).toBe('');
  });

  it('cancelAdd(): sets isAdding=false and resets form text', () => {
    component.isAdding.set(true);
    component.form.setValue({ text: 'hello' });

    component.cancelAdd();

    expect(component.isAdding()).toBeFalse();
    expect(component.form.value.text).toBe('');
  });

  it('addNote(): does nothing if form is invalid', () => {

    component.form.setValue({ text: '' });
    component.addNote();

    expect(component.notes()).toEqual([]);
    expect(component.notesCount()).toBe(0);
  });

  it('addNote(): does nothing for whitespace-only text', () => {
    component.openAdd();
    component.form.setValue({ text: '   ' });

    component.addNote();

    expect(component.notes()).toEqual([]);
    expect(component.notesCount()).toBe(0);
    // isAdding не меняется, потому что ранний return после trim()
    expect(component.isAdding()).toBeTrue();
  });

  it('addNote(): adds a note, prepends to list, resets form and closes add mode', () => {
    // стабилизируем время
    spyOn(Date, 'now').and.returnValue(1234567890);

    // стабилизируем uuid
    spyOn(globalThis.crypto, 'randomUUID').and.returnValue('id-1' as any);

    component.openAdd();
    component.form.setValue({ text: '  first  ' });

    component.addNote();

    const list = component.notes();
    expect(list.length).toBe(1);

    expect(list[0]).toEqual({
      id: 'id-1',
      text: 'first',
      createdAt: 1234567890,
    });

    expect(component.notesCount()).toBe(1);
    expect(component.isAdding()).toBeFalse();
    expect(component.form.value.text).toBe('');
  });

  it('addNote(): newest note should be first (prepend behavior)', () => {
    spyOn(Date, 'now').and.returnValues(111, 222);
    const uuidSpy = spyOn(globalThis.crypto, 'randomUUID');
    uuidSpy.and.returnValues('id-1' as any, 'id-2' as any);

    component.openAdd();
    component.form.setValue({ text: 'one' });
    component.addNote();

    component.openAdd();
    component.form.setValue({ text: 'two' });
    component.addNote();

    const list = component.notes();
    expect(list.length).toBe(2);

    // "two" добавили позже, значит она сверху
    expect(list[0].id).toBe('id-2');
    expect(list[0].text).toBe('two');
    expect(list[0].createdAt).toBe(222);

    expect(list[1].id).toBe('id-1');
    expect(list[1].text).toBe('one');
    expect(list[1].createdAt).toBe(111);
  });

  it('deleteNote(): removes note by id', () => {
    // проще всего наполнить через публичный метод addNote()
    spyOn(Date, 'now').and.returnValues(111, 222);
    const uuidSpy = spyOn(globalThis.crypto, 'randomUUID');
    uuidSpy.and.returnValues('id-1' as any, 'id-2' as any);

    component.openAdd();
    component.form.setValue({ text: 'one' });
    component.addNote();

    component.openAdd();
    component.form.setValue({ text: 'two' });
    component.addNote();

    expect(component.notesCount()).toBe(2);

    component.deleteNote('id-1');

    const list = component.notes();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe('id-2');
    expect(component.notesCount()).toBe(1);
  });

  it('deleteNote(): unknown id does not change list', () => {
    spyOn(Date, 'now').and.returnValue(111);
    spyOn(globalThis.crypto, 'randomUUID').and.returnValue('id-1' as any);

    component.openAdd();
    component.form.setValue({ text: 'one' });
    component.addNote();

    const before = component.notes();

    component.deleteNote('nope');

    expect(component.notes()).toEqual(before);
    expect(component.notesCount()).toBe(1);
  });

  it('form validators: maxLength(5000) should invalidate long text', () => {
    component.openAdd();
    component.form.setValue({ text: 'a'.repeat(5001) });

    expect(component.form.valid).toBeFalse();
    component.addNote();

    expect(component.notesCount()).toBe(0);
  });
});

