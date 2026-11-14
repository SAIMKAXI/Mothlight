import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachmentReducer,
  bootReducer,
  helperReducer,
  historyReducer,
  initialAttachmentState,
  initialBootState,
  initialEditorHistory,
  initialHelperState,
  initialNavigationState,
  initialReminderState,
  initialSaveState,
  initialSearchState,
  initialTypewriterState,
  navigationReducer,
  reminderReducer,
  saveReducer,
  searchReducer,
  typewriterReducer,
} from '../src/stateMachines.ts';

test('navigation never leaves a panel open behind the library', () => {
  const editor = navigationReducer(initialNavigationState, { type: 'OPEN_PANEL', panel: 'settings' });
  assert.deepEqual(editor, { screen: 'editor', panel: 'settings' });
  const library = navigationReducer(editor, { type: 'OPEN_LIBRARY' });
  assert.deepEqual(library, { screen: 'library', panel: null });
  assert.deepEqual(
    navigationReducer(library, { type: 'OPEN_PANEL', panel: 'search' }),
    library,
  );
});

test('hydration has one explicit terminal transition', () => {
  assert.deepEqual(
    bootReducer(initialBootState, { type: 'HYDRATED', source: 'recovered' }),
    { status: 'ready', source: 'recovered' },
  );
});

test('a stale save completion never marks a newer revision as saved', () => {
  let state = saveReducer(initialSaveState, { type: 'DIRTY', revision: 1 });
  state = saveReducer(state, { type: 'SAVE_STARTED', revision: 1 });
  state = saveReducer(state, { type: 'DIRTY', revision: 2 });
  state = saveReducer(state, { type: 'SAVE_SUCCEEDED', revision: 1 });
  assert.equal(state.status, 'dirty');
  assert.equal(state.savedRevision, 1);
  state = saveReducer(state, { type: 'SAVE_STARTED', revision: 2 });
  state = saveReducer(state, { type: 'SAVE_SUCCEEDED', revision: 2 });
  assert.equal(state.status, 'saved');
  assert.equal(state.savedRevision, 2);
});

test('editor history caps snapshots and clears redo on a new edit', () => {
  let state = historyReducer(initialEditorHistory, { type: 'RECORD', value: 'before' });
  state = historyReducer(state, { type: 'UNDO', current: 'after' });
  assert.deepEqual(state, { undo: [], redo: ['after'] });
  state = historyReducer(state, { type: 'RECORD', value: 'new branch' });
  assert.deepEqual(state, { undo: ['new branch'], redo: [] });
});

test('typewriter ignores paste and stale animation completions', () => {
  const unchanged = typewriterReducer(initialTypewriterState, { type: 'KEYSTROKE', kind: 'paste' });
  assert.equal(unchanged, initialTypewriterState);
  const first = typewriterReducer(unchanged, { type: 'KEYSTROKE', kind: 'key' });
  const second = typewriterReducer(first, { type: 'KEYSTROKE', kind: 'return' });
  assert.equal(second.phase, 'carriage-returning');
  assert.equal(typewriterReducer(second, { type: 'ANIMATION_FINISHED', sequence: first.sequence }), second);
  assert.equal(
    typewriterReducer(second, { type: 'ANIMATION_FINISHED', sequence: second.sequence }).phase,
    'idle',
  );
});

test('attachment flow rejects out-of-order events', () => {
  const invalid = attachmentReducer(initialAttachmentState, { type: 'ATTACHED', attachmentId: 'a1' });
  assert.equal(invalid, initialAttachmentState);
  let state = attachmentReducer(initialAttachmentState, { type: 'START' });
  state = attachmentReducer(state, { type: 'PERMISSION_GRANTED' });
  state = attachmentReducer(state, { type: 'ASSET_SELECTED' });
  state = attachmentReducer(state, { type: 'ATTACHED', attachmentId: 'a1' });
  assert.deepEqual(state, { status: 'attached', attachmentId: 'a1' });
});

test('reminder cannot be scheduled before permission and scheduling states', () => {
  const invalid = reminderReducer(initialReminderState, {
    type: 'SCHEDULED',
    notificationId: 'n1',
    fireAt: 100,
  });
  assert.equal(invalid, initialReminderState);
  let state = reminderReducer(initialReminderState, { type: 'START' });
  state = reminderReducer(state, { type: 'PERMISSION_GRANTED' });
  state = reminderReducer(state, { type: 'SCHEDULED', notificationId: 'n1', fireAt: 100 });
  assert.equal(state.status, 'scheduled');
});

test('search moves from editing to a concrete match or a no-match state', () => {
  let state = searchReducer(initialSearchState, { type: 'OPEN' });
  state = searchReducer(state, { type: 'QUERY_CHANGED', query: 'moth' });
  state = searchReducer(state, { type: 'FOUND', query: 'moth', start: 0, end: 4 });
  assert.deepEqual(state, { status: 'found', query: 'moth', start: 0, end: 4 });
  assert.deepEqual(searchReducer(state, { type: 'CLOSE' }), { status: 'closed' });
});

test('smart helper preview must be explicitly applied or discarded', () => {
  let state = helperReducer(initialHelperState, { type: 'OPEN', mode: 'smart' });
  state = helperReducer(state, { type: 'PREVIEW', title: 'Summary', text: 'A short summary.' });
  assert.deepEqual(state, {
    status: 'preview',
    mode: 'smart',
    title: 'Summary',
    text: 'A short summary.',
  });
  assert.deepEqual(helperReducer(state, { type: 'DISCARD' }), { status: 'ready', mode: 'smart' });
  assert.deepEqual(helperReducer(state, { type: 'APPLY' }), { status: 'closed' });
});
