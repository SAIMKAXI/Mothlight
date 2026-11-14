/**
 * Explicit finite-state models for Mothlight's asynchronous and interactive flows.
 * Reducers are pure: side effects (storage, OS permissions, animation) stay in App.tsx.
 */

export type Panel =
  | 'ideas'
  | 'page'
  | 'search'
  | 'format'
  | 'settings'
  | 'reminder'
  | 'smart'
  | null;

export type Screen = 'editor' | 'library';

export type NavigationState = {
  screen: Screen;
  panel: Panel;
};

export type NavigationEvent =
  | { type: 'OPEN_LIBRARY' }
  | { type: 'OPEN_EDITOR' }
  | { type: 'OPEN_PANEL'; panel: Exclude<Panel, null> }
  | { type: 'CLOSE_PANEL' };

export const initialNavigationState: NavigationState = {
  screen: 'editor',
  panel: null,
};

export function navigationReducer(
  state: NavigationState,
  event: NavigationEvent,
): NavigationState {
  switch (event.type) {
    case 'OPEN_LIBRARY':
      return { screen: 'library', panel: null };
    case 'OPEN_EDITOR':
      return { screen: 'editor', panel: null };
    case 'OPEN_PANEL':
      return state.screen === 'editor' ? { ...state, panel: event.panel } : state;
    case 'CLOSE_PANEL':
      return state.panel === null ? state : { ...state, panel: null };
    default:
      return state;
  }
}

export type BootState =
  | { status: 'loading' }
  | { status: 'ready'; source: 'stored' | 'fresh' | 'recovered' };

export type BootEvent = {
  type: 'HYDRATED';
  source: 'stored' | 'fresh' | 'recovered';
};

export const initialBootState: BootState = { status: 'loading' };

export function bootReducer(_state: BootState, event: BootEvent): BootState {
  if (event.type === 'HYDRATED') return { status: 'ready', source: event.source };
  return _state;
}

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export type SaveState = {
  status: SaveStatus;
  revision: number;
  savedRevision: number;
  error?: string;
};

export type SaveEvent =
  | { type: 'DIRTY'; revision: number }
  | { type: 'SAVE_STARTED'; revision: number }
  | { type: 'SAVE_SUCCEEDED'; revision: number }
  | { type: 'SAVE_FAILED'; revision: number; error: string };

export const initialSaveState: SaveState = {
  status: 'idle',
  revision: 0,
  savedRevision: 0,
};

export function saveReducer(state: SaveState, event: SaveEvent): SaveState {
  switch (event.type) {
    case 'DIRTY':
      if (event.revision <= state.revision) return state;
      return { ...state, status: 'dirty', revision: event.revision, error: undefined };
    case 'SAVE_STARTED':
      return event.revision === state.revision
        ? { ...state, status: 'saving', error: undefined }
        : state;
    case 'SAVE_SUCCEEDED': {
      const savedRevision = Math.max(state.savedRevision, event.revision);
      return {
        ...state,
        savedRevision,
        status: state.revision === event.revision ? 'saved' : state.status,
        error: undefined,
      };
    }
    case 'SAVE_FAILED':
      return event.revision === state.revision
        ? { ...state, status: 'error', error: event.error }
        : state;
    default:
      return state;
  }
}

export type EditorHistory = {
  undo: string[];
  redo: string[];
};

export type HistoryEvent =
  | { type: 'RECORD'; value: string }
  | { type: 'UNDO'; current: string }
  | { type: 'REDO'; current: string }
  | { type: 'RESET' };

export const initialEditorHistory: EditorHistory = { undo: [], redo: [] };

export function historyReducer(state: EditorHistory, event: HistoryEvent): EditorHistory {
  switch (event.type) {
    case 'RECORD':
      return {
        undo: [...state.undo.slice(-59), event.value],
        redo: [],
      };
    case 'UNDO':
      if (state.undo.length === 0) return state;
      return {
        undo: state.undo.slice(0, -1),
        redo: [...state.redo.slice(-59), event.current],
      };
    case 'REDO':
      if (state.redo.length === 0) return state;
      return {
        undo: [...state.undo.slice(-59), event.current],
        redo: state.redo.slice(0, -1),
      };
    case 'RESET':
      return initialEditorHistory;
    default:
      return state;
  }
}

export type KeyboardState = 'hidden' | 'visible';
export type KeyboardEvent = { type: 'SHOW' } | { type: 'HIDE' };

export function keyboardReducer(
  state: KeyboardState,
  event: KeyboardEvent,
): KeyboardState {
  if (event.type === 'SHOW') return 'visible';
  if (event.type === 'HIDE') return 'hidden';
  return state;
}

export type EditKind = 'key' | 'space' | 'return' | 'backspace' | 'paste' | 'none';

export type TypewriterState =
  | { phase: 'idle'; sequence: number }
  | { phase: 'striking'; kind: Exclude<EditKind, 'none' | 'paste' | 'return'>; sequence: number }
  | { phase: 'carriage-returning'; sequence: number };

export type TypewriterEvent =
  | { type: 'KEYSTROKE'; kind: EditKind }
  | { type: 'ANIMATION_FINISHED'; sequence: number };

export const initialTypewriterState: TypewriterState = { phase: 'idle', sequence: 0 };

export function typewriterReducer(
  state: TypewriterState,
  event: TypewriterEvent,
): TypewriterState {
  switch (event.type) {
    case 'KEYSTROKE':
      if (event.kind === 'none' || event.kind === 'paste') return state;
      if (event.kind === 'return') {
        return { phase: 'carriage-returning', sequence: state.sequence + 1 };
      }
      return {
        phase: 'striking',
        kind: event.kind,
        sequence: state.sequence + 1,
      };
    case 'ANIMATION_FINISHED':
      return event.sequence === state.sequence
        ? { phase: 'idle', sequence: state.sequence }
        : state;
    default:
      return state;
  }
}

export type AttachmentState =
  | { status: 'idle' }
  | { status: 'requesting-permission' }
  | { status: 'picking' }
  | { status: 'validating' }
  | { status: 'attached'; attachmentId: string }
  | { status: 'denied' }
  | { status: 'cancelled' }
  | { status: 'too-large' }
  | { status: 'failed'; reason: string };

export type AttachmentEvent =
  | { type: 'START' }
  | { type: 'PERMISSION_GRANTED' }
  | { type: 'PERMISSION_DENIED' }
  | { type: 'ASSET_SELECTED' }
  | { type: 'PICKER_CANCELLED' }
  | { type: 'ATTACHED'; attachmentId: string }
  | { type: 'TOO_LARGE' }
  | { type: 'FAILED'; reason: string }
  | { type: 'RESET' };

export const initialAttachmentState: AttachmentState = { status: 'idle' };

export function attachmentReducer(
  state: AttachmentState,
  event: AttachmentEvent,
): AttachmentState {
  switch (event.type) {
    case 'START':
      return state.status === 'requesting-permission' ||
        state.status === 'picking' ||
        state.status === 'validating'
        ? state
        : { status: 'requesting-permission' };
    case 'PERMISSION_GRANTED':
      return state.status === 'requesting-permission' ? { status: 'picking' } : state;
    case 'PERMISSION_DENIED':
      return state.status === 'requesting-permission' ? { status: 'denied' } : state;
    case 'ASSET_SELECTED':
      return state.status === 'picking' ? { status: 'validating' } : state;
    case 'PICKER_CANCELLED':
      return state.status === 'picking' ? { status: 'cancelled' } : state;
    case 'ATTACHED':
      return state.status === 'validating'
        ? { status: 'attached', attachmentId: event.attachmentId }
        : state;
    case 'TOO_LARGE':
      return state.status === 'validating' ? { status: 'too-large' } : state;
    case 'FAILED':
      return state.status === 'requesting-permission' ||
        state.status === 'picking' ||
        state.status === 'validating'
        ? { status: 'failed', reason: event.reason }
        : state;
    case 'RESET':
      return initialAttachmentState;
    default:
      return state;
  }
}

export type ReminderState =
  | { status: 'idle' }
  | { status: 'requesting-permission' }
  | { status: 'scheduling' }
  | { status: 'scheduled'; notificationId: string; fireAt: number }
  | { status: 'denied' }
  | { status: 'failed'; reason: string };

export type ReminderEvent =
  | { type: 'START' }
  | { type: 'PERMISSION_GRANTED' }
  | { type: 'PERMISSION_DENIED' }
  | { type: 'SCHEDULED'; notificationId: string; fireAt: number }
  | { type: 'FAILED'; reason: string }
  | { type: 'RESET' };

export const initialReminderState: ReminderState = { status: 'idle' };

export function reminderReducer(
  state: ReminderState,
  event: ReminderEvent,
): ReminderState {
  switch (event.type) {
    case 'START':
      return state.status === 'requesting-permission' || state.status === 'scheduling'
        ? state
        : { status: 'requesting-permission' };
    case 'PERMISSION_GRANTED':
      return state.status === 'requesting-permission' ? { status: 'scheduling' } : state;
    case 'PERMISSION_DENIED':
      return state.status === 'requesting-permission' ? { status: 'denied' } : state;
    case 'SCHEDULED':
      return state.status === 'scheduling'
        ? { status: 'scheduled', notificationId: event.notificationId, fireAt: event.fireAt }
        : state;
    case 'FAILED':
      return state.status === 'requesting-permission' || state.status === 'scheduling'
        ? { status: 'failed', reason: event.reason }
        : state;
    case 'RESET':
      return initialReminderState;
    default:
      return state;
  }
}

export type SearchState =
  | { status: 'closed' }
  | { status: 'editing'; query: string }
  | { status: 'found'; query: string; start: number; end: number }
  | { status: 'not-found'; query: string };

export type SearchEvent =
  | { type: 'OPEN' }
  | { type: 'QUERY_CHANGED'; query: string }
  | { type: 'FOUND'; query: string; start: number; end: number }
  | { type: 'NOT_FOUND'; query: string }
  | { type: 'CLOSE' };

export const initialSearchState: SearchState = { status: 'closed' };

export function searchReducer(state: SearchState, event: SearchEvent): SearchState {
  switch (event.type) {
    case 'OPEN':
      return { status: 'editing', query: '' };
    case 'QUERY_CHANGED':
      return state.status === 'closed' ? state : { status: 'editing', query: event.query };
    case 'FOUND':
      return state.status === 'closed'
        ? state
        : { status: 'found', query: event.query, start: event.start, end: event.end };
    case 'NOT_FOUND':
      return state.status === 'closed' ? state : { status: 'not-found', query: event.query };
    case 'CLOSE':
      return { status: 'closed' };
    default:
      return state;
  }
}

export type HelperState =
  | { status: 'closed' }
  | { status: 'ready'; mode: 'ideas' | 'smart' }
  | { status: 'preview'; mode: 'smart'; title: string; text: string };

export type HelperEvent =
  | { type: 'OPEN'; mode: 'ideas' | 'smart' }
  | { type: 'PREVIEW'; title: string; text: string }
  | { type: 'DISCARD' }
  | { type: 'APPLY' }
  | { type: 'CLOSE' };

export const initialHelperState: HelperState = { status: 'closed' };

export function helperReducer(state: HelperState, event: HelperEvent): HelperState {
  switch (event.type) {
    case 'OPEN':
      return { status: 'ready', mode: event.mode };
    case 'PREVIEW':
      return state.status === 'ready' && state.mode === 'smart'
        ? { status: 'preview', mode: 'smart', title: event.title, text: event.text }
        : state;
    case 'DISCARD':
      return state.status === 'preview' ? { status: 'ready', mode: state.mode } : state;
    case 'APPLY':
    case 'CLOSE':
      return { status: 'closed' };
    default:
      return state;
  }
}

export type ToolbarState = 'expanded' | 'collapsed';
export type ToolbarEvent = { type: 'TOGGLE' } | { type: 'EXPAND' } | { type: 'COLLAPSE' };

export function toolbarReducer(state: ToolbarState, event: ToolbarEvent): ToolbarState {
  switch (event.type) {
    case 'TOGGLE':
      return state === 'expanded' ? 'collapsed' : 'expanded';
    case 'EXPAND':
      return 'expanded';
    case 'COLLAPSE':
      return 'collapsed';
    default:
      return state;
  }
}


export type ShareState = 'idle' | 'opening' | 'shared' | 'dismissed' | 'failed';
export type ShareEvent =
  | { type: 'START' }
  | { type: 'SHARED' }
  | { type: 'DISMISSED' }
  | { type: 'FAILED' };

export function shareReducer(state: ShareState, event: ShareEvent): ShareState {
  switch (event.type) {
    case 'START':
      return state === 'opening' ? state : 'opening';
    case 'SHARED':
      return state === 'opening' ? 'shared' : state;
    case 'DISMISSED':
      return state === 'opening' ? 'dismissed' : state;
    case 'FAILED':
      return state === 'opening' ? 'failed' : state;
    default:
      return state;
  }
}

export type DeleteState = 'idle' | 'confirming' | 'deleting';
export type DeleteEvent =
  | { type: 'REQUEST' }
  | { type: 'CANCEL' }
  | { type: 'CONFIRM' }
  | { type: 'COMPLETE' };

export function deleteReducer(state: DeleteState, event: DeleteEvent): DeleteState {
  switch (event.type) {
    case 'REQUEST':
      return state === 'idle' ? 'confirming' : state;
    case 'CANCEL':
      return state === 'confirming' ? 'idle' : state;
    case 'CONFIRM':
      return state === 'confirming' ? 'deleting' : state;
    case 'COMPLETE':
      return state === 'deleting' ? 'idle' : state;
    default:
      return state;
  }
}


export type OnboardingState =
  | { status: 'checking' }
  | { status: 'active'; step: 0 | 1 | 2 }
  | { status: 'completed' };

export type OnboardingEvent =
  | { type: 'START' }
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'SKIP' }
  | { type: 'COMPLETE' };

export const initialOnboardingState: OnboardingState = { status: 'checking' };

export function onboardingReducer(
  state: OnboardingState,
  event: OnboardingEvent,
): OnboardingState {
  switch (event.type) {
    case 'START':
      return state.status === 'checking' ? { status: 'active', step: 0 } : state;
    case 'NEXT':
      if (state.status !== 'active') return state;
      return state.step === 2
        ? { status: 'completed' }
        : { status: 'active', step: (state.step + 1) as 0 | 1 | 2 };
    case 'BACK':
      if (state.status !== 'active') return state;
      return state.step === 0
        ? state
        : { status: 'active', step: (state.step - 1) as 0 | 1 | 2 };
    case 'SKIP':
    case 'COMPLETE':
      return { status: 'completed' };
    default:
      return state;
  }
}

export type AppLockState =
  | { status: 'disabled' }
  | { status: 'locked' }
  | { status: 'authenticating' }
  | { status: 'unlocked' }
  | { status: 'failed'; reason: string };

export type AppLockEvent =
  | { type: 'ENABLE' }
  | { type: 'STARTUP_LOCK' }
  | { type: 'LOCK' }
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS' }
  | { type: 'AUTH_FAILED'; reason: string }
  | { type: 'RETRY' }
  | { type: 'DISABLE' };

export const initialAppLockState: AppLockState = { status: 'disabled' };

export function appLockReducer(
  state: AppLockState,
  event: AppLockEvent,
): AppLockState {
  switch (event.type) {
    case 'ENABLE':
      return state.status === 'disabled' ? { status: 'unlocked' } : state;
    case 'STARTUP_LOCK':
      return state.status === 'disabled' ? { status: 'locked' } : state;
    case 'LOCK':
      return state.status === 'disabled' ? state : { status: 'locked' };
    case 'AUTH_START':
      return state.status === 'locked' || state.status === 'failed'
        ? { status: 'authenticating' }
        : state;
    case 'AUTH_SUCCESS':
      return state.status === 'authenticating' ? { status: 'unlocked' } : state;
    case 'AUTH_FAILED':
      return state.status === 'authenticating'
        ? { status: 'failed', reason: event.reason }
        : state;
    case 'RETRY':
      return state.status === 'failed' ? { status: 'locked' } : state;
    case 'DISABLE':
      return { status: 'disabled' };
    default:
      return state;
  }
}
