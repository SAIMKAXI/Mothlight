import test from 'node:test';
import assert from 'node:assert/strict';
import { getNoteTitle, normalizeNotes } from '../src/noteModel.ts';

test('normalizes notes written before attachments were introduced', () => {
  const notes = normalizeNotes([{
    id: 'legacy-note',
    title: 'Untitled note',
    content: 'A saved thought',
    createdAt: 100,
    updatedAt: 125,
  }], 500);

  assert.equal(notes.length, 1);
  assert.deepEqual(notes[0].attachments, []);
  assert.equal(notes[0].createdAt, 100);
  assert.equal(notes[0].updatedAt, 125);
  assert.equal(notes[0].content, 'A saved thought');
});

test('preserves valid reminder and attachment data while repairing optional fields', () => {
  const notes = normalizeNotes([{
    id: 'note-1',
    title: '',
    content: 'A thought',
    createdAt: 10,
    updatedAt: 11,
    attachments: [
      { uri: 'data:image/jpeg;base64,abc' },
      null,
      { id: 'bad', uri: '' },
    ],
    reminderId: 'notification-1',
    reminderAt: 99,
  }], 500);

  assert.equal(notes.length, 1);
  assert.equal(notes[0].title, 'Untitled note');
  assert.deepEqual(notes[0].attachments, [{
    id: 'note-1-attachment-1',
    uri: 'data:image/jpeg;base64,abc',
    name: 'Image attachment',
  }]);
  assert.equal(notes[0].reminderId, 'notification-1');
  assert.equal(notes[0].reminderAt, 99);
});

test('drops invalid rows and truncates content to the editor limit', () => {
  const notes = normalizeNotes([
    { id: '', content: 'invalid' },
    { id: 'note-2', content: 'x'.repeat(6500), createdAt: 'bad-time' },
  ], 123);

  assert.equal(notes.length, 1);
  assert.equal(notes[0].content.length, 6000);
  assert.equal(notes[0].createdAt, 123);
  assert.equal(notes[0].updatedAt, 123);
});

test('returns null for non-array storage and derives title from the first non-empty line', () => {
  assert.equal(normalizeNotes({ id: 'not-an-array' }), null);
  assert.equal(getNoteTitle({ title: 'Untitled note', content: '\n  First thought\nSecond line' }), 'First thought');
  assert.equal(getNoteTitle({ title: 'Explicit title', content: 'Body' }), 'Explicit title');
});
