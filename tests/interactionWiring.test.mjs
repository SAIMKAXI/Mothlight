import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { auditInteractiveBindings } from '../scripts/audit-interactions.mjs';

test('every interactive control in App.tsx has a real callback and input wiring', () => {
  const source = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const result = auditInteractiveBindings(source);

  assert.deepEqual(result.failures, []);
  assert.ok(result.counts.pressables >= 20, 'expected the visible pressable actions to be audited');
  assert.equal(result.counts.textInputs, 2, 'editor and in-note search should both be controlled');
  assert.ok(result.counts.iconButtons >= 2);
  assert.ok(result.counts.panelActions >= 10);
  assert.equal(result.counts.toggles, 3);
  assert.equal(result.counts.flatLists, 1);
  assert.equal(result.counts.modals, 2);
});
