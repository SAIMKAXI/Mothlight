import test from 'node:test';
import assert from 'node:assert/strict';
import { insertAtSelection, toggleLinePrefix } from '../src/formatting.ts';

test('heading prefix inserts at the start of the current line and maps the caret', () => {
  const result = toggleLinePrefix('A thought\nAnother line', { start: 3, end: 3 }, '# ');
  assert.equal(result.text, '# A thought\nAnother line');
  assert.deepEqual(result.selection, { start: 5, end: 5 });
});

test('prefix formatting toggles off when the current line already has the marker', () => {
  const result = toggleLinePrefix('· A thought', { start: 5, end: 5 }, '· ');
  assert.equal(result.text, 'A thought');
  assert.deepEqual(result.selection, { start: 3, end: 3 });
});

test('a selected multi-line block gets a prefix on every non-empty line', () => {
  const result = toggleLinePrefix('First\n\nSecond', { start: 0, end: 13 }, '· ');
  assert.equal(result.text, '· First\n\n· Second');
});

test('selected multi-line prefix can be toggled back off', () => {
  const result = toggleLinePrefix('· First\n· Second', { start: 2, end: 16 }, '· ');
  assert.equal(result.text, 'First\nSecond');
});

test('inserting text replaces the selected range and returns a collapsed caret', () => {
  const result = insertAtSelection('Hello world', { start: 6, end: 11 }, 'Mothlight');
  assert.equal(result.text, 'Hello Mothlight');
  assert.deepEqual(result.selection, { start: 15, end: 15 });
});

test('insertions obey the note character limit', () => {
  const result = insertAtSelection('x'.repeat(5999), { start: 5999, end: 5999 }, 'abcd');
  assert.equal(result.text.length, 6000);
  assert.deepEqual(result.selection, { start: 6000, end: 6000 });
});
