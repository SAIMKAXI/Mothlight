import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFormattedLine } from '../src/richText.ts';

test('renders markdown heading markers as heading content', () => {
  assert.deepEqual(parseFormattedLine('## A heading'), { kind: 'heading', text: 'A heading' });
});

test('recognizes bullets, quotes, dividers, and ordinary body text', () => {
  assert.deepEqual(parseFormattedLine('• A task'), { kind: 'bullet', text: 'A task' });
  assert.deepEqual(parseFormattedLine('> A quotation'), { kind: 'quote', text: 'A quotation' });
  assert.deepEqual(parseFormattedLine('— — —'), { kind: 'divider', text: '' });
  assert.deepEqual(parseFormattedLine('A paragraph'), { kind: 'body', text: 'A paragraph' });
});

test('preserves empty lines as spacing', () => {
  assert.deepEqual(parseFormattedLine('  '), { kind: 'empty', text: '' });
});
