import test from 'node:test';
import assert from 'node:assert/strict';
import { getReminderNoteId } from '../src/notificationRouting.ts';

test('extracts a valid note id from a reminder payload', () => {
  assert.equal(getReminderNoteId({ noteId: 'note-123' }), 'note-123');
});

test('rejects missing, blank, and malformed reminder payloads safely', () => {
  assert.equal(getReminderNoteId(null), null);
  assert.equal(getReminderNoteId([]), null);
  assert.equal(getReminderNoteId({}), null);
  assert.equal(getReminderNoteId({ noteId: '' }), null);
  assert.equal(getReminderNoteId({ noteId: 12 }), null);
});
