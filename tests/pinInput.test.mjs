import test from 'node:test';
import assert from 'node:assert/strict';
import { PIN_LENGTH, appendPinDigit, isValidPin, removePinDigit } from '../src/pinInput.ts';

test('the app PIN is exactly six digits', () => {
  assert.equal(PIN_LENGTH, 6);
  assert.equal(isValidPin('123456'), true);
  assert.equal(isValidPin('12345'), false);
  assert.equal(isValidPin('12a456'), false);
});

test('PIN keypad accepts digits only and never exceeds six places', () => {
  assert.equal(appendPinDigit('12', '3'), '123');
  assert.equal(appendPinDigit('12', 'x'), '12');
  assert.equal(appendPinDigit('123456', '7'), '123456');
  assert.equal(removePinDigit('123456'), '12345');
});
