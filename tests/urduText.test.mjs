import test from 'node:test';
import assert from 'node:assert/strict';
import { containsUrduScript } from '../src/urduText.ts';

test('detects Urdu text pasted into a note', () => {
  assert.equal(containsUrduScript('یہ ایک نوٹ ہے'), true);
});

test('detects Urdu mixed with English', () => {
  assert.equal(containsUrduScript('Meeting notes: کل ملاقات ہے'), true);
});

test('leaves ordinary English and numbers on the existing typewriter font', () => {
  assert.equal(containsUrduScript('Meeting notes 2026'), false);
});

test('recognizes Arabic-script text without matching punctuation alone', () => {
  assert.equal(containsUrduScript('مرحبا'), true);
  assert.equal(containsUrduScript('...!? 123'), false);
});
