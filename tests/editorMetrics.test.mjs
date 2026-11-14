import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyEdit, getCursorMetrics } from '../src/editorMetrics.ts';

test('classifies physical key, space, return, backspace, paste and no-op edits', () => {
  assert.equal(classifyEdit('', 'a'), 'key');
  assert.equal(classifyEdit('a', 'a '), 'space');
  assert.equal(classifyEdit('a', 'a\n'), 'return');
  assert.equal(classifyEdit('ab', 'a'), 'backspace');
  assert.equal(classifyEdit('', 'hello'), 'paste');
  assert.equal(classifyEdit('same', 'same'), 'none');
});

test('maps cursor offsets to rows and columns, including newlines and wrapping', () => {
  assert.deepEqual(getCursorMetrics('abc', 2, 100, 10), { row: 0, column: 2, columns: 10 });
  assert.deepEqual(getCursorMetrics('ab\ncd', 4, 100, 10), { row: 1, column: 1, columns: 10 });
  assert.deepEqual(getCursorMetrics('abcdef', 6, 30, 10), { row: 1, column: 3, columns: 3 });
});

test('clamps invalid cursor offsets and protects against zero glyph widths', () => {
  assert.deepEqual(getCursorMetrics('abc', 99, 0, 0), { row: 2, column: 1, columns: 1 });
  assert.deepEqual(getCursorMetrics('abc', -5, 40, 10), { row: 0, column: 0, columns: 4 });
});
