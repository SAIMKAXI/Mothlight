import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Alert, Animated, AppState, BackHandler, Easing, FlatList, Image, Keyboard, KeyboardAvoidingView, Modal,
  Platform, Pressable, ScrollView, Share, StatusBar, StyleSheet, Text, TextInput,
  View, useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer } from 'expo-audio';
import { useFonts } from '@expo-google-fonts/courier-prime/useFonts';
import { CourierPrime_400Regular } from '@expo-google-fonts/courier-prime/400Regular';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import DateTimePicker from '@expo/ui/community/datetime-picker';
import * as SplashScreen from 'expo-splash-screen';
import {
  ArrowLeft, Bell, BookOpen, Check, ChevronDown, ChevronRight, ChevronUp,
  Clock3, Copy, FileText, Heading2, ImagePlus, Lightbulb, List, Minus, PenLine, Plus, Quote,
  Redo2, Search, Share2, SlidersHorizontal, Sparkles, Trash2, Undo2, Volume2, LockKeyhole,
  VolumeX, Vibrate, WandSparkles, X,
} from 'lucide-react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getNoteTitle as getTitle, normalizeNotes, type Note } from './src/noteModel';
import { getReminderNoteId } from './src/notificationRouting';
import { toggleLinePrefix, insertAtSelection as insertTextAtSelection } from './src/formatting';
import { parseFormattedLine } from './src/richText';
import { appendPinDigit, isValidPin, PIN_LENGTH, removePinDigit } from './src/pinInput';
import { classifyEdit, getCursorMetrics } from './src/editorMetrics';
import { resolveTheme, themePalettes, type ThemeColors, type ThemeMode } from './src/theme';
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
  keyboardReducer,
  navigationReducer,
  reminderReducer,
  saveReducer,
  searchReducer,
  typewriterReducer,
  shareReducer,
  deleteReducer,
  toolbarReducer,
  onboardingReducer,
  appLockReducer,
  initialOnboardingState,
  initialAppLockState,
  type Panel,
  type Screen,
} from './src/stateMachines';

const NOTES_KEY = 'mothlight.notes.v1';
const SETTINGS_KEY = 'mothlight.settings.v1';
const ONBOARDING_KEY = 'mothlight.onboarding.v1';
const PIN_STORAGE_KEY = 'mothlight.private-pin.v1';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 320, fade: true });
const MAX_CHARS = 6000;

type Settings = { typewriterSound: boolean; haptics: boolean; themeMode: ThemeMode; appLockEnabled: boolean };
type Attachment = Note['attachments'][number];
type PinSetupStep = 'create' | 'confirm' | null;
type IconLike = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
type ThemeContextValue = { colors: ThemeColors; styles: ReturnType<typeof makeStyles> };
const ThemeContext = createContext<ThemeContextValue | null>(null);

const makeNote = (): Note => {
  const now = Date.now();
  return {
    id: now.toString() + Math.random().toString(36).slice(2, 7),
    title: 'Untitled note',
    content: '',
    createdAt: now,
    updatedAt: now,
    attachments: [],
  };
};

function IconButton({
  icon: Icon, label, onPress, size = 20, active = false, disabled = false,
}: {
  icon: IconLike; label: string; onPress: () => void; size?: number; active?: boolean; disabled?: boolean;
}) {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('IconButton must be rendered inside ThemeContext');
  const { colors, styles } = theme;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={7}
      onPress={onPress}
      style={({ pressed }) => [styles.toolButton, pressed && styles.pressed, active && styles.toolButtonActive, disabled && styles.disabledControl]}
    >
      <Icon size={size} color={active ? colors.accentText : colors.toolbarText} strokeWidth={1.75} />
    </Pressable>
  );
}

function PanelAction({
  icon: Icon, title, detail, onPress, destructive = false, disabled = false,
}: {
  icon: IconLike; title: string; detail?: string; onPress: () => void; destructive?: boolean; disabled?: boolean;
}) {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('PanelAction must be rendered inside ThemeContext');
  const { colors, styles } = theme;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.panelAction, pressed && styles.panelActionPressed, disabled && styles.disabledControl]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <View style={[styles.panelIcon, destructive && styles.panelIconDanger]}>
        <Icon size={18} color={destructive ? colors.danger : colors.icon} strokeWidth={1.8} />
      </View>
      <View style={styles.panelActionText}>
        <Text style={[styles.panelActionTitle, destructive && { color: colors.danger }]}>{title}</Text>
        {detail ? <Text style={styles.panelActionDetail}>{detail}</Text> : null}
      </View>
      <ChevronRight size={16} color={colors.iconMuted} />
    </Pressable>
  );
}

function ToggleRow({
  icon: Icon, title, subtitle, value, onChange, disabled = false,
}: {
  icon: IconLike; title: string; subtitle: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean;
}) {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('ToggleRow must be rendered inside ThemeContext');
  const { colors, styles } = theme;
  return (
    <Pressable onPress={() => onChange(!value)} disabled={disabled} style={[styles.toggleRow, disabled && styles.disabledControl]} accessibilityRole="switch" accessibilityState={{ checked: value, disabled }}>
      <View style={styles.panelIcon}><Icon size={18} color={colors.icon} strokeWidth={1.8} /></View>
      <View style={styles.panelActionText}>
        <Text style={styles.panelActionTitle}>{title}</Text>
        <Text style={styles.panelActionDetail}>{subtitle}</Text>
      </View>
      <View style={[styles.switchTrack, value && styles.switchTrackOn]}>
        <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
      </View>
    </Pressable>
  );
}

function PinKeypad({
  disabled, onDigit, onBackspace,
}: {
  disabled: boolean;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
}) {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('PinKeypad must be rendered inside ThemeContext');
  const { styles } = theme;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace'];
  return (
    <View style={styles.pinKeypad}>
      {keys.map((key, index) => key === '' ? (
        <View key={`empty-${index}`} />
      ) : (
        <Pressable
          key={key}
          disabled={disabled}
          onPress={() => key === 'backspace' ? onBackspace() : onDigit(key)}
          accessibilityRole="button"
          accessibilityLabel={key === 'backspace' ? 'Delete last PIN digit' : `Digit ${key}`}
          style={({ pressed }) => [styles.pinKey, pressed && styles.pressed, disabled && styles.disabledControl]}
        >
          <Text style={styles.pinKeyText}>{key === 'backspace' ? '⌫' : key}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function PinDots({ value }: { value: string }) {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('PinDots must be rendered inside ThemeContext');
  const { styles } = theme;
  return (
    <View style={styles.pinDotsRow} accessibilityLabel={`${value.length} of ${PIN_LENGTH} PIN digits entered`}>
      {Array.from({ length: PIN_LENGTH }, (_, index) => (
        <View key={index} style={[styles.pinDot, index < value.length && styles.pinDotFilled]} />
      ))}
    </View>
  );
}

function AppContent() {
  const [fontsLoaded] = useFonts({ CourierPrime_400Regular });
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>({
    typewriterSound: true,
    haptics: true,
    themeMode: 'light',
    appLockEnabled: false,
  });
  const systemColorScheme = useColorScheme();
  const resolvedTheme = resolveTheme(settings.themeMode, systemColorScheme);
  const colors = themePalettes[resolvedTheme];
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const themeContextValue = useMemo(() => ({ colors, styles }), [colors, styles]);

  const [bootState, dispatchBoot] = useReducer(bootReducer, initialBootState);
  const ready = bootState.status === 'ready';
  const [onboardingState, dispatchOnboarding] = useReducer(onboardingReducer, initialOnboardingState);
  const [appLockState, dispatchAppLock] = useReducer(appLockReducer, initialAppLockState);
  const [navigation, dispatchNavigation] = useReducer(navigationReducer, initialNavigationState);
  const screen = navigation.screen;
  const panel = navigation.panel;
  const [toolbarState, dispatchToolbar] = useReducer(toolbarReducer, 'expanded');
  const toolbarExpanded = toolbarState === 'expanded';
  const [keyboardState, dispatchKeyboard] = useReducer(keyboardReducer, 'hidden');
  const keyboardVisible = keyboardState === 'visible';
  const setKeyboardVisible = (visible: boolean) => dispatchKeyboard({ type: visible ? 'SHOW' : 'HIDE' });
  const [history, dispatchHistory] = useReducer(historyReducer, initialEditorHistory);
  const [typewriterState, dispatchTypewriter] = useReducer(typewriterReducer, initialTypewriterState);
  const [attachmentState, dispatchAttachment] = useReducer(attachmentReducer, initialAttachmentState);
  const [reminderState, dispatchReminder] = useReducer(reminderReducer, initialReminderState);
  const [searchState, dispatchSearch] = useReducer(searchReducer, initialSearchState);
  const searchText = searchState.status === 'closed' ? '' : searchState.query;
  const setSearchText = (query: string) => dispatchSearch({ type: 'QUERY_CHANGED', query });
  const [helperState, dispatchHelper] = useReducer(helperReducer, initialHelperState);
  const helperResult = helperState.status === 'preview' ? helperState.text : '';
  const setHelperResult = (value: string) => {
    if (value) dispatchHelper({ type: 'PREVIEW', title: 'Draft result', text: value });
    else dispatchHelper({ type: 'DISCARD' });
  };
  const [saveState, dispatchSave] = useReducer(saveReducer, initialSaveState);
  const [settingsSaveState, dispatchSettingsSave] = useReducer(saveReducer, initialSaveState);
  const [shareState, dispatchShare] = useReducer(shareReducer, 'idle');
  const [deleteState, dispatchDelete] = useReducer(deleteReducer, 'idle');
  const [pendingReminderNoteId, setPendingReminderNoteId] = useState<string | null>(null);
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [pinSetupStep, setPinSetupStep] = useState<PinSetupStep>(null);
  const [pinSetupDraft, setPinSetupDraft] = useState('');
  const [pinEntry, setPinEntry] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const [customReminderDate, setCustomReminderDate] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [customReminderOpen, setCustomReminderOpen] = useState(false);

  const setPanel = (nextPanel: Panel) => {
    if (nextPanel === null) {
      const wasSearchPanelOpen = panel === 'search';
      dispatchNavigation({ type: 'CLOSE_PANEL' });
      dispatchSearch({ type: 'CLOSE' });
      dispatchHelper({ type: 'CLOSE' });
      if (wasSearchPanelOpen) setTimeout(() => editorRef.current?.focus(), 220);
      return;
    }
    dispatchNavigation({ type: 'OPEN_PANEL', panel: nextPanel });
    if (nextPanel === 'search') dispatchSearch({ type: 'OPEN' });
    else dispatchSearch({ type: 'CLOSE' });
    if (nextPanel === 'ideas' || nextPanel === 'smart') {
      dispatchHelper({ type: 'OPEN', mode: nextPanel });
    } else {
      dispatchHelper({ type: 'CLOSE' });
    }
  };
  const setScreen = (nextScreen: Screen) => {
    if (nextScreen === 'library') dispatchNavigation({ type: 'OPEN_LIBRARY' });
    else if (nextScreen === 'settings') dispatchNavigation({ type: 'OPEN_SETTINGS' });
    else dispatchNavigation({ type: 'OPEN_EDITOR' });
    dispatchSearch({ type: 'CLOSE' });
    dispatchHelper({ type: 'CLOSE' });
    Keyboard.dismiss();
  };

  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [previewMode, setPreviewMode] = useState(false);
  const [stageWidth, setStageWidth] = useState(0);
  const [railWidth, setRailWidth] = useState(0);
  const [glyphWidth, setGlyphWidth] = useState(9.2);

  const editorRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const searchRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const saveRevisionRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const settingsRevisionRef = useRef(0);
  const settingsSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const appBackgroundAtRef = useRef<number | null>(null);
  const lastNotificationResponseRef = useRef<string | null>(null);
  const strikeValue = useRef(new Animated.Value(0)).current;
  const bulbGlow = useRef(new Animated.Value(0.24)).current;
  const carriageX = useRef(new Animated.Value(0)).current;
  const clickPlayer = useAudioPlayer(require('./assets/typewriter-key.wav'));
  const returnPlayer = useAudioPlayer(require('./assets/typewriter-return.wav'));

  const currentNote = useMemo(
    () => notes.find((note) => note.id === currentNoteId) ?? null,
    [notes, currentNoteId],
  );
  const content = currentNote?.content ?? '';
  const writingWidth = Math.max(80, stageWidth - 52);
  const cursor = getCursorMetrics(content, selection.start, writingWidth, glyphWidth);
  const carriageTravel = Math.max(0, railWidth - 58);
  const targetCarriageX = carriageTravel * Math.min(1, cursor.column / Math.max(1, cursor.columns - 1));

  useEffect(() => {
    let active = true;
    const load = async () => {
      let source: 'stored' | 'fresh' | 'recovered' = 'fresh';
      let hasExistingNotes = false;
      let onboardingWasComplete = false;
      try {
        const [rawNotes, rawSettings, rawOnboarding, rawPin] = await Promise.all([
          AsyncStorage.getItem(NOTES_KEY),
          AsyncStorage.getItem(SETTINGS_KEY),
          AsyncStorage.getItem(ONBOARDING_KEY),
          SecureStore.getItemAsync(PIN_STORAGE_KEY),
        ]);
        if (!active) return;
        hasExistingNotes = Boolean(rawNotes);
        onboardingWasComplete = rawOnboarding === 'completed' || hasExistingNotes;

        if (rawNotes) {
          const parsed: unknown = JSON.parse(rawNotes);
          const normalized = normalizeNotes(parsed);
          if (normalized && normalized.length > 0) {
            setNotes(normalized);
            const latest = [...normalized].sort((a, b) => b.updatedAt - a.updatedAt)[0];
            setCurrentNoteId(latest.id);
            source = 'stored';
          } else {
            setNotes([]);
            setCurrentNoteId(null);
            source = 'fresh';
          }
        } else {
          setNotes([]);
          setCurrentNoteId(null);
          source = 'fresh';
        }

        setStoredPin(rawPin);
        if (rawSettings) {
          const parsedSettings = JSON.parse(rawSettings) as Partial<Settings>;
          const themeMode: ThemeMode =
            parsedSettings.themeMode === 'light' || parsedSettings.themeMode === 'dark'
              ? parsedSettings.themeMode
              : 'light';
          const requestedAppLock = parsedSettings.appLockEnabled === true;
          const appLockEnabled = requestedAppLock && Boolean(rawPin);
          setSettings({
            typewriterSound: parsedSettings.typewriterSound ?? true,
            haptics: parsedSettings.haptics ?? true,
            themeMode,
            appLockEnabled,
          });
          dispatchAppLock({ type: appLockEnabled ? 'STARTUP_LOCK' : 'DISABLE' });
          if (requestedAppLock && !rawPin) {
            Alert.alert('PIN setup required', 'The previous biometric lock has been replaced by an in-app PIN. Set a new PIN in Settings.');
          }
        } else {
          dispatchAppLock({ type: 'DISABLE' });
        }
      } catch {
        source = 'recovered';
        if (active) {
          setNotes([]);
          setCurrentNoteId(null);
          setStoredPin(null);
          dispatchAppLock({ type: 'DISABLE' });
        }
      } finally {
        if (active) {
          if (onboardingWasComplete) {
            dispatchOnboarding({ type: 'COMPLETE' });
            if (hasExistingNotes) {
              void AsyncStorage.setItem(ONBOARDING_KEY, 'completed').catch(() => undefined);
            }
          } else {
            dispatchOnboarding({ type: 'START' });
          }
          dispatchBoot({ type: 'HYDRATED', source });
        }
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (ready && fontsLoaded) SplashScreen.hide();
  }, [ready, fontsLoaded]);

  useEffect(() => {
    if (!ready || onboardingState.status !== 'completed') return;
    const revision = ++saveRevisionRef.current;
    const snapshot = JSON.stringify(notes);
    dispatchSave({ type: 'DIRTY', revision });
    const timer = setTimeout(() => {
      dispatchSave({ type: 'SAVE_STARTED', revision });
      // Serialize writes so an older snapshot can never finish after a newer one.
      saveQueueRef.current = saveQueueRef.current
        .then(() => AsyncStorage.setItem(NOTES_KEY, snapshot))
        .then(() => dispatchSave({ type: 'SAVE_SUCCEEDED', revision }))
        .catch((error: unknown) => {
          dispatchSave({
            type: 'SAVE_FAILED',
            revision,
            error: error instanceof Error ? error.message : 'Storage write failed',
          });
        });
    }, 420);
    return () => clearTimeout(timer);
  }, [notes, ready, onboardingState.status]);

  useEffect(() => {
    if (!ready) return;
    const revision = ++settingsRevisionRef.current;
    const snapshot = JSON.stringify(settings);
    dispatchSettingsSave({ type: 'DIRTY', revision });
    dispatchSettingsSave({ type: 'SAVE_STARTED', revision });
    settingsSaveQueueRef.current = settingsSaveQueueRef.current
      .then(() => AsyncStorage.setItem(SETTINGS_KEY, snapshot))
      .then(() => dispatchSettingsSave({ type: 'SAVE_SUCCEEDED', revision }))
      .catch((error: unknown) => {
        dispatchSettingsSave({
          type: 'SAVE_FAILED',
          revision,
          error: error instanceof Error ? error.message : 'Settings write failed',
        });
      });
  }, [settings, ready]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (panel !== null) { setPanel(null); return true; }
      if (screen === 'editor') { Keyboard.dismiss(); setScreen('library'); return true; }
      if (screen === 'settings') { setScreen('library'); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [panel, screen]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => dispatchKeyboard({ type: 'SHOW' }));
    const hide = Keyboard.addListener('keyboardDidHide', () => dispatchKeyboard({ type: 'HIDE' }));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (panel !== 'search') return;
    const timer = setTimeout(() => searchRef.current?.focus(), 220);
    return () => clearTimeout(timer);
  }, [panel]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' && appBackgroundAtRef.current === null) {
        // iOS may emit "inactive" before "background"; timestamp the actual departure.
        appBackgroundAtRef.current = Date.now();
      }
      if (nextState === 'active' && appBackgroundAtRef.current !== null) {
        const awayFor = Date.now() - appBackgroundAtRef.current;
        if (settings.appLockEnabled && awayFor >= 3000) {
          setPinEntry('');
          setPinError(null);
          Keyboard.dismiss();
          dispatchNavigation({ type: 'CLOSE_PANEL' });
          dispatchSearch({ type: 'CLOSE' });
          dispatchHelper({ type: 'CLOSE' });
          dispatchAppLock({ type: 'LOCK' });
        }
        appBackgroundAtRef.current = null;
      }
    });
    return () => subscription.remove();
  }, [settings.appLockEnabled]);

  useEffect(() => {
    if (screen !== 'editor' || !ready || !currentNote) return;
    const timer = setTimeout(() => editorRef.current?.focus(), 420);
    return () => clearTimeout(timer);
  }, [screen, ready, currentNoteId]);

  useEffect(() => {
    Animated.spring(carriageX, {
      toValue: targetCarriageX,
      stiffness: 245,
      damping: 22,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [targetCarriageX, carriageX]);

  useEffect(() => {
    if (typewriterState.phase === 'idle') return;
    const sequence = typewriterState.sequence;
    bulbGlow.stopAnimation();
    Animated.sequence([
      Animated.timing(bulbGlow, { toValue: 1, duration: 26, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(bulbGlow, { toValue: 0.24, duration: 190, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    if (typewriterState.phase === 'striking' && typewriterState.kind === 'backspace') {
      dispatchTypewriter({ type: 'ANIMATION_FINISHED', sequence });
      return;
    }
    strikeValue.stopAnimation();
    Animated.sequence([
      Animated.timing(strikeValue, { toValue: 5, duration: 38, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(strikeValue, { toValue: 0, duration: 76, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) dispatchTypewriter({ type: 'ANIMATION_FINISHED', sequence });
    });
    if (typewriterState.phase === 'carriage-returning') {
      Animated.timing(carriageX, {
        toValue: 0,
        duration: 145,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [typewriterState.sequence, typewriterState.phase, strikeValue, carriageX, bulbGlow]);

  useEffect(() => {
    clickPlayer.volume = 0.38;
    returnPlayer.volume = 0.42;
  }, [clickPlayer, returnPlayer]);

  const updateNote = useCallback((id: string, patch: Partial<Note>) => {
    setNotes((existing) => existing.map((note) =>
      note.id === id ? { ...note, ...patch, updatedAt: Date.now() } : note,
    ));
  }, []);

  const createNote = useCallback(() => {
    const note = makeNote();
    setNotes((existing) => [note, ...existing]);
    setCurrentNoteId(note.id);
    setPreviewMode(false);
    setSelection({ start: 0, end: 0 });
    dispatchHistory({ type: 'RESET' });
    setPanel(null);
    setScreen('editor');
  }, []);

  const playMechanical = useCallback((kind: ReturnType<typeof classifyEdit>) => {
    if (kind === 'none' || kind === 'paste') return;
    if (settings.typewriterSound) {
      try {
        const player = kind === 'return' ? returnPlayer : clickPlayer;
        player.volume = kind === 'return' ? 0.62 : kind === 'space' ? 0.38 : kind === 'backspace' ? 0.48 : 0.58;
        player.playbackRate = kind === 'return' ? 0.92 : kind === 'space' ? 0.88 : kind === 'backspace' ? 1.18 : 1;
        player.seekTo(0);
        player.play();
      } catch { /* Sound is optional when the device has no output route. */ }
    }
    if (settings.haptics) {
      void Haptics.impactAsync(kind === 'return' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
  }, [settings.typewriterSound, settings.haptics, clickPlayer, returnPlayer]);

  const handleTextChange = useCallback((nextValue: string) => {
    if (!currentNote) return;
    setPreviewMode(false);
    const next = nextValue.slice(0, MAX_CHARS);
    const kind = classifyEdit(currentNote.content, next);
    if (kind !== 'none') {
      dispatchHistory({ type: 'RECORD', value: currentNote.content });
      playMechanical(kind);
      dispatchTypewriter({ type: 'KEYSTROKE', kind });
    }
    const generatedTitle = currentNote.title === 'Untitled note'
      ? (next.split('\n').map((line) => line.trim()).find(Boolean)?.slice(0, 42) || 'Untitled note')
      : currentNote.title;
    updateNote(currentNote.id, { content: next, title: generatedTitle });
  }, [currentNote, playMechanical, updateNote]);

  const setSettingsValue = (patch: Partial<Settings>) => setSettings((old) => ({ ...old, ...patch }));

  const setAppLockEnabled = async (enabled: boolean) => {
    if (!enabled) {
      Alert.alert('Disable PIN lock?', 'Mothlight will stop asking for your six-digit app PIN.', [
        { text: 'Keep enabled', style: 'cancel' },
        {
          text: 'Disable lock',
          style: 'destructive',
          onPress: () => {
            void SecureStore.deleteItemAsync(PIN_STORAGE_KEY).catch(() => undefined);
            setStoredPin(null);
            setSettingsValue({ appLockEnabled: false });
            dispatchAppLock({ type: 'DISABLE' });
            setPinEntry('');
            setPinError(null);
          },
        },
      ]);
      return;
    }
    setPinEntry('');
    setPinSetupDraft('');
    setPinError(null);
    setPinSetupStep('create');
  };

  const processPin = async (value: string) => {
    if (!isValidPin(value) || pinBusy) return;
    setPinBusy(true);
    try {
      if (pinSetupStep === 'create') {
        setPinSetupDraft(value);
        setPinEntry('');
        setPinError(null);
        setPinSetupStep('confirm');
        return;
      }
      if (pinSetupStep === 'confirm') {
        if (value !== pinSetupDraft) {
          setPinEntry('');
          setPinSetupDraft('');
          setPinSetupStep('create');
          setPinError('The PINs did not match. Please start again.');
          return;
        }
        await SecureStore.setItemAsync(PIN_STORAGE_KEY, value);
        setStoredPin(value);
        setSettingsValue({ appLockEnabled: true });
        dispatchAppLock({ type: 'ENABLE' });
        setPinSetupStep(null);
        setPinSetupDraft('');
        setPinEntry('');
        setPinError(null);
        return;
      }
      dispatchAppLock({ type: 'AUTH_START' });
      const savedPin = storedPin ?? await SecureStore.getItemAsync(PIN_STORAGE_KEY);
      if (savedPin && savedPin === value) {
        setPinError(null);
        dispatchAppLock({ type: 'AUTH_SUCCESS' });
      } else {
        setPinError('That PIN is not correct. Try again.');
        dispatchAppLock({ type: 'AUTH_FAILED', reason: 'Incorrect PIN.' });
      }
      setPinEntry('');
    } catch {
      setPinError('Secure PIN storage is unavailable. Please try again.');
      if (appLockState.status !== 'unlocked') {
        dispatchAppLock({ type: 'AUTH_FAILED', reason: 'Could not verify the app PIN.' });
      }
    } finally {
      setPinBusy(false);
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pinBusy) return;
    const next = appendPinDigit(pinEntry, digit);
    setPinEntry(next);
    if (next.length === PIN_LENGTH) void processPin(next);
  };

  const handlePinBackspace = () => {
    if (!pinBusy) setPinEntry((current) => removePinDigit(current));
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'completed');
    } catch {
      Alert.alert('Onboarding preference not saved', 'You can still continue using Mothlight.');
    }
    dispatchOnboarding({ type: 'COMPLETE' });
  };

  const shareNote = async () => {
    if (!currentNote || shareState === 'opening') return;
    dispatchShare({ type: 'START' });
    try {
      const result = await Share.share({
        title: getTitle(currentNote),
        message: currentNote.content || getTitle(currentNote),
      });
      dispatchShare({ type: result.action === Share.sharedAction ? 'SHARED' : 'DISMISSED' });
    } catch {
      dispatchShare({ type: 'FAILED' });
      Alert.alert('Unable to share', 'The system share sheet could not be opened.');
    }
  };

  const attachImage = async () => {
    if (!currentNote || attachmentState.status === 'requesting-permission' ||
        attachmentState.status === 'picking' || attachmentState.status === 'validating') return;
    dispatchAttachment({ type: 'START' });
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        dispatchAttachment({ type: 'PERMISSION_DENIED' });
        Alert.alert('Photo access needed', 'Allow photo access to attach an image to this note.');
        return;
      }
      dispatchAttachment({ type: 'PERMISSION_GRANTED' });
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], quality: 0.55, base64: true, allowsEditing: false,
      });
      if (result.canceled || !result.assets[0]) {
        dispatchAttachment({ type: 'PICKER_CANCELLED' });
        return;
      }
      dispatchAttachment({ type: 'ASSET_SELECTED' });
      const asset = result.assets[0];
      if (!asset.base64) {
        dispatchAttachment({ type: 'FAILED', reason: 'Selected image data was unavailable' });
        Alert.alert('Could not attach image', 'The selected image could not be read.');
        return;
      }
      if ((asset.fileSize ?? 0) > 4_000_000) {
        dispatchAttachment({ type: 'TOO_LARGE' });
        Alert.alert('Image is too large', 'Choose an image smaller than 4 MB.');
        return;
      }
      const mime = asset.mimeType || 'image/jpeg';
      const attachment: Attachment = {
        id: Date.now().toString(),
        name: asset.fileName || 'Image attachment',
        uri: 'data:' + mime + ';base64,' + asset.base64,
      };
      updateNote(currentNote.id, { attachments: [...(currentNote.attachments || []), attachment] });
      dispatchAttachment({ type: 'ATTACHED', attachmentId: attachment.id });
    } catch (error) {
      dispatchAttachment({
        type: 'FAILED',
        reason: error instanceof Error ? error.message : 'Photo library unavailable',
      });
      Alert.alert('Image unavailable', 'Mothlight could not open the photo library.');
    }
  };

  const removeAttachment = (attachmentId: string) => {
    if (!currentNote) return;
    updateNote(currentNote.id, {
      attachments: currentNote.attachments.filter((attachment) => attachment.id !== attachmentId),
    });
  };

  const deleteCurrentNote = () => {
    if (!currentNote || deleteState !== 'idle') return;
    dispatchDelete({ type: 'REQUEST' });
    Alert.alert('Delete this page?', 'This note and its local attachments will be removed from this device.', [
      {
        text: 'Keep note',
        style: 'cancel',
        onPress: () => dispatchDelete({ type: 'CANCEL' }),
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          dispatchDelete({ type: 'CONFIRM' });
          if (currentNote.reminderId) {
            void Notifications.cancelScheduledNotificationAsync(currentNote.reminderId).catch(() => undefined);
          }
          const remaining = notes.filter((note) => note.id !== currentNote.id);
          setNotes(remaining);
          setCurrentNoteId(remaining[0]?.id ?? null);
          dispatchHistory({ type: 'RESET' });
          setPanel(null);
          setScreen(remaining.length ? 'editor' : 'library');
          dispatchDelete({ type: 'COMPLETE' });
        },
      },
    ]);
  };

  const duplicateCurrentNote = () => {
    if (!currentNote) return;
    const copy: Note = {
      ...currentNote,
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      title: getTitle(currentNote) + ' copy',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      reminderAt: undefined,
      reminderId: undefined,
      attachments: [...currentNote.attachments],
    };
    setNotes((existing) => [copy, ...existing]);
    setCurrentNoteId(copy.id);
    setPreviewMode(false);
    dispatchHistory({ type: 'RESET' });
    setPanel(null);
    setScreen('editor');
    setSelection({ start: copy.content.length, end: copy.content.length });
  };

  const scheduleReminderAt = async (fireAt: Date) => {
    if (!currentNote || reminderState.status === 'requesting-permission' ||
        reminderState.status === 'scheduling') return;
    if (!Number.isFinite(fireAt.getTime()) || fireAt.getTime() <= Date.now()) {
      Alert.alert('Choose a future time', 'The reminder time must be later than now.');
      return;
    }
    dispatchReminder({ type: 'START' });
    try {
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        dispatchReminder({ type: 'PERMISSION_DENIED' });
        Alert.alert('Notifications are off', 'Allow notifications in system settings to receive note reminders.');
        return;
      }
      dispatchReminder({ type: 'PERMISSION_GRANTED' });
      if (currentNote.reminderId) {
        await Notifications.cancelScheduledNotificationAsync(currentNote.reminderId).catch(() => undefined);
      }
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: getTitle(currentNote),
          body: 'A thought is waiting for you in Mothlight.',
          data: { noteId: currentNote.id },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
      });
      updateNote(currentNote.id, { reminderId: id, reminderAt: fireAt.getTime() });
      dispatchReminder({ type: 'SCHEDULED', notificationId: id, fireAt: fireAt.getTime() });
      setCustomReminderOpen(false);
      setPanel(null);
      Alert.alert('Reminder set', 'Mothlight will remind you on ' + fireAt.toLocaleString() + '.');
    } catch (error) {
      dispatchReminder({
        type: 'FAILED',
        reason: error instanceof Error ? error.message : 'Notification scheduling failed',
      });
      Alert.alert('Reminder unavailable', 'The operating system could not schedule this reminder.');
    }
  };

  const scheduleReminder = (minutes: number) => {
    void scheduleReminderAt(new Date(Date.now() + minutes * 60_000));
  };

  const focusEditorAt = (nextSelection: { start: number; end: number }) => {
    setTimeout(() => {
      editorRef.current?.focus();
      editorRef.current?.setNativeProps({ selection: nextSelection });
    }, 220);
  };

  const insertAtSelection = (replacement: string, showPreview = false) => {
    if (!currentNote) return;
    const result = insertTextAtSelection(content, selection, replacement, MAX_CHARS);
    dispatchHistory({ type: 'RECORD', value: content });
    updateNote(currentNote.id, { content: result.text });
    setSelection(result.selection);
    setPanel(null);
    if (showPreview) {
      Keyboard.dismiss();
      setPreviewMode(true);
    } else {
      focusEditorAt(result.selection);
    }
  };

  const applyPrefix = (prefix: string, showPreview = false) => {
    if (!currentNote) return;
    const result = toggleLinePrefix(content, selection, prefix);
    if (result.text === content) return;
    dispatchHistory({ type: 'RECORD', value: content });
    updateNote(currentNote.id, { content: result.text });
    setSelection(result.selection);
    setPanel(null);
    if (showPreview) {
      Keyboard.dismiss();
      setPreviewMode(true);
    } else {
      focusEditorAt(result.selection);
    }
  };

  const undo = () => {
    if (!currentNote || !history.undo.length) return;
    const target = history.undo[history.undo.length - 1];
    dispatchHistory({ type: 'UNDO', current: content });
    updateNote(currentNote.id, { content: target });
    const caret = Math.min(selection.start, target.length);
    const nextSelection = { start: caret, end: caret };
    setSelection(nextSelection);
    requestAnimationFrame(() => editorRef.current?.setNativeProps({ selection: nextSelection }));
  };

  const redo = () => {
    if (!currentNote || !history.redo.length) return;
    const target = history.redo[history.redo.length - 1];
    dispatchHistory({ type: 'REDO', current: content });
    updateNote(currentNote.id, { content: target });
    const caret = Math.min(selection.start, target.length);
    const nextSelection = { start: caret, end: caret };
    setSelection(nextSelection);
    requestAnimationFrame(() => editorRef.current?.setNativeProps({ selection: nextSelection }));
  };

  const findNext = () => {
    if (!searchText.trim() || !currentNote) return;
    const needle = searchText.toLocaleLowerCase();
    const haystack = content.toLocaleLowerCase();
    const from = selection.end >= content.length ? 0 : Math.max(selection.end, 0);
    let index = haystack.indexOf(needle, from);
    if (index < 0) index = haystack.indexOf(needle, 0);
    if (index < 0) {
      dispatchSearch({ type: 'NOT_FOUND', query: searchText });
      Alert.alert('No match found', 'That phrase is not in this note.');
      return;
    }
    dispatchSearch({ type: 'FOUND', query: searchText, start: index, end: index + needle.length });
    const nextSelection = { start: index, end: index + needle.length };
    setSelection(nextSelection);
    requestAnimationFrame(() => editorRef.current?.setNativeProps({ selection: nextSelection }));
  };

  const applyHelperText = (next: string) => {
    if (!currentNote) return;
    dispatchHistory({ type: 'RECORD', value: content });
    const updated = next.slice(0, MAX_CHARS);
    updateNote(currentNote.id, { content: updated });
    const caret = updated.length;
    setSelection({ start: caret, end: caret });
    requestAnimationFrame(() => editorRef.current?.setNativeProps({ selection: { start: caret, end: caret } }));
    setHelperResult('');
    setPanel(null);
  };

  const polishText = () => {
    const next = content
      .replace(/[ \t]+([,.;!?])/g, '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    setHelperResult(next);
  };

  const lineItems = () => content.split('\n').filter((line) => /(todo|need to|should|remember to|action:)/i.test(line));
  const smartSummary = () => {
    const sentences = content.split(/(?<=[.!?])\s+/).filter(Boolean);
    return sentences.slice(0, 3).join(' ') || content.trim();
  };

  const attachmentBusy = attachmentState.status === 'requesting-permission' ||
    attachmentState.status === 'picking' || attachmentState.status === 'validating';
  const reminderBusy = reminderState.status === 'requesting-permission' || reminderState.status === 'scheduling';

  const toolbarActions: { icon: IconLike; label: string; action: () => void; disabled?: boolean }[] = [
    { icon: ImagePlus, label: 'Add image', action: attachImage, disabled: attachmentBusy },
    { icon: Lightbulb, label: 'Writing suggestions', action: () => { setHelperResult(''); setPanel('ideas'); } },
    { icon: FileText, label: 'Page actions', action: () => setPanel('page') },
    { icon: Search, label: 'Search in note', action: () => { setSearchText(''); setPanel('search'); } },
    { icon: PenLine, label: 'Formatting tools', action: () => setPanel('format') },
    { icon: Bell, label: 'Reminder', action: () => setPanel('reminder') },
    { icon: Sparkles, label: 'Smart actions', action: () => { setHelperResult(''); setPanel('smart'); } },
  ];

  const panelTitle = panel === 'ideas' ? 'Writing suggestions'
    : panel === 'page' ? 'Page actions'
    : panel === 'search' ? 'Find in this note'
    : panel === 'format' ? 'Writing tools'
    : panel === 'reminder' ? 'Remind me'
    : panel === 'smart' ? 'Smart actions' : '';

  const openNote = (noteId: string) => {
    setCurrentNoteId(noteId);
    setPreviewMode(false);
    setSelection({ start: 0, end: 0 });
    dispatchHistory({ type: 'RESET' });
    setPanel(null);
    setScreen('editor');
  };

  useEffect(() => {
    let mounted = true;
    const handleNotificationResponse = (response: Notifications.NotificationResponse | null) => {
      if (!mounted || !response) return;
      const responseId = response.notification.request.identifier;
      if (lastNotificationResponseRef.current === responseId) return;
      lastNotificationResponseRef.current = responseId;
      const noteId = getReminderNoteId(response.notification.request.content.data);
      if (noteId) setPendingReminderNoteId(noteId);
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    void Notifications.getLastNotificationResponseAsync().then(handleNotificationResponse).catch(() => undefined);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!ready || !pendingReminderNoteId) return;
    if (notes.some((note) => note.id === pendingReminderNoteId)) {
      openNote(pendingReminderNoteId);
    } else {
      Alert.alert('Page unavailable', 'This reminder points to a page that is no longer on this device.');
    }
    setPendingReminderNoteId(null);
  }, [ready, notes, pendingReminderNoteId]);

  if (!ready || !fontsLoaded) {
    return (
      <ThemeContext.Provider value={themeContextValue}>
        <View style={[styles.loading, { paddingTop: insets.top }]}>
          <StatusBar barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'} />
          <Image
            source={resolvedTheme === 'dark'
              ? require('./assets/mothlight-icon-dark.png')
              : require('./assets/mothlight-icon.png')}
            style={styles.loadingLogo}
            resizeMode="contain"
          />
          <Text style={styles.brandWordmark}>mothlight</Text>
          <Text style={styles.loadingCaption}>a quieter place to think</Text>
        </View>
      </ThemeContext.Provider>
    );
  }

  if (settings.appLockEnabled && appLockState.status !== 'unlocked') {
    return (
      <ThemeContext.Provider value={themeContextValue}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <StatusBar barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'} />
          <View style={styles.lockScreen}>
            <Image
              source={resolvedTheme === 'dark'
                ? require('./assets/mothlight-icon-dark.png')
                : require('./assets/mothlight-icon.png')}
              style={styles.lockLogo}
              resizeMode="contain"
            />
            <Text style={styles.brandWordmark}>mothlight</Text>
            <Text style={styles.lockTitle}>Your quiet space, kept private.</Text>
            <Text style={styles.lockSubtitle}>Enter your six-digit Mothlight PIN to continue.</Text>
            <PinDots value={pinEntry} />
            {pinError ? <Text style={styles.lockError}>{pinError}</Text> : null}
            <PinKeypad disabled={pinBusy} onDigit={handlePinDigit} onBackspace={handlePinBackspace} />
            <Text style={styles.lockFootnote}>Your PIN is stored securely on this device.</Text>
          </View>
        </SafeAreaView>
      </ThemeContext.Provider>
    );
  }

  if (onboardingState.status === 'active') {
    const step = onboardingState.step;
    const titles = [
      'A quieter place to think.',
      'A place for the little things.',
      'Make it feel like yours.',
    ];
    const descriptions = [
      'A clean sheet, a little room, and a typewriter’s rhythm. Mothlight gives unfinished thoughts somewhere to land.',
      'Keep the details close. Search your notes, attach images, and set gentle reminders for thoughts worth returning to.',
      'Choose the light that suits you. You can change appearance and set a private six-digit app PIN in Settings.',
    ];
    return (
      <ThemeContext.Provider value={themeContextValue}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <StatusBar barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'} />
          <View style={styles.onboardingRoot}>
            <View style={styles.onboardingTop}>
              <Text style={styles.onboardingKicker}>MOTHLIGHT · A QUIETER PLACE TO THINK</Text>
              <Pressable onPress={() => void completeOnboarding()} hitSlop={10}>
                <Text style={styles.onboardingSkip}>Skip</Text>
              </Pressable>
            </View>
            <View style={styles.onboardingHero}>
              <Image
                source={resolvedTheme === 'dark'
                  ? require('./assets/mothlight-icon-dark.png')
                  : require('./assets/mothlight-icon.png')}
                style={styles.onboardingLogo}
                resizeMode="contain"
              />
              <View style={styles.onboardingProgress}>
                {[0, 1, 2].map((index) => (
                  <View
                    key={index}
                    style={[styles.onboardingProgressDot, index === step && styles.onboardingProgressDotActive]}
                  />
                ))}
              </View>
            </View>
            <View style={styles.onboardingCopy}>
              <Text style={styles.onboardingStep}>0{step + 1} / 03</Text>
              <Text style={styles.onboardingTitle}>{titles[step]}</Text>
              <Text style={styles.onboardingBody}>{descriptions[step]}</Text>
              {step === 2 ? (
                <View style={styles.appearancePicker}>
                  <Text style={styles.appearancePickerTitle}>APPEARANCE</Text>
                  <View style={styles.appearanceOptions}>
                    {([
                      { value: 'system', label: 'System' },
                      { value: 'light', label: 'Light' },
                      { value: 'dark', label: 'Dark' },
                    ] as const).map((option) => (
                      <Pressable
                        key={option.value}
                        onPress={() => setSettingsValue({ themeMode: option.value })}
                        style={[
                          styles.appearanceOption,
                          settings.themeMode === option.value && styles.appearanceOptionSelected,
                        ]}
                      >
                        <Text style={[
                          styles.appearanceOptionText,
                          settings.themeMode === option.value && styles.appearanceOptionTextSelected,
                        ]}>{option.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
              <View style={styles.onboardingActions}>
                {step > 0 ? (
                  <Pressable style={styles.onboardingBack} onPress={() => dispatchOnboarding({ type: 'BACK' })}>
                    <Text style={styles.onboardingBackText}>Back</Text>
                  </Pressable>
                ) : <View style={styles.onboardingBackPlaceholder} />}
                <Pressable
                  style={styles.onboardingNext}
                  onPress={() => step === 2 ? void completeOnboarding() : dispatchOnboarding({ type: 'NEXT' })}
                >
                  <Text style={styles.onboardingNextText}>{step === 2 ? 'Begin writing' : 'Continue'}</Text>
                  <ChevronRight size={17} color={colors.accentText} />
                </Pressable>
              </View>
              {step === 2 ? (
                <Text style={styles.onboardingPrivacy}>
                  An optional six-digit app PIN keeps this writing space private. Your notes stay on this device.
                </Text>
              ) : null}
            </View>
          </View>
        </SafeAreaView>
      </ThemeContext.Provider>
    );
  }

  if (screen === 'settings') {
    return (
      <ThemeContext.Provider value={themeContextValue}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <StatusBar barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'} />
          <View style={styles.settingsPage}>
            <View style={styles.settingsPageHeader}>
              <IconButton icon={ArrowLeft} label="Back to Home" onPress={() => setScreen('library')} />
              <View style={styles.settingsPageTitleWrap}>
                <Text style={styles.settingsPageTitle}>Settings</Text>
                <Text style={styles.settingsPageSubtitle}>Make Mothlight feel like yours.</Text>
              </View>
              <View style={styles.settingsHeaderSpacer} />
            </View>
            <ScrollView contentContainerStyle={styles.settingsPageContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.settingsSection}>Appearance</Text>
              <View style={styles.themeOptions}>
                {([
                  { value: 'system', label: 'System' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ] as const).map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => setSettingsValue({ themeMode: option.value })}
                    style={[styles.themeOption, settings.themeMode === option.value && styles.themeOptionSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: settings.themeMode === option.value }}
                  >
                    <Text style={[
                      styles.themeOptionText,
                      settings.themeMode === option.value && styles.themeOptionTextSelected,
                    ]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.settingsSection}>Writing</Text>
              <ToggleRow
                icon={settings.typewriterSound ? Volume2 : VolumeX}
                title="Typewriter sound"
                subtitle="Audible mechanical key strikes and carriage return."
                value={settings.typewriterSound}
                onChange={(value) => setSettingsValue({ typewriterSound: value })}
              />
              <ToggleRow
                icon={Vibrate}
                title="Haptic feedback"
                subtitle="Optional gentle tactile feedback as you type."
                value={settings.haptics}
                onChange={(value) => setSettingsValue({ haptics: value })}
              />

              <Text style={[styles.settingsSection, styles.settingsSecuritySection]}>Privacy</Text>
              <ToggleRow
                icon={LockKeyhole}
                title="App PIN lock"
                subtitle="Require your own six-digit PIN when you return."
                value={settings.appLockEnabled}
                onChange={(value) => { void setAppLockEnabled(value); }}
              />
              {settings.appLockEnabled ? (
                <Pressable style={styles.changePinButton} onPress={() => {
                  setPinSetupDraft('');
                  setPinEntry('');
                  setPinError(null);
                  setPinSetupStep('create');
                }} accessibilityRole="button">
                  <Text style={styles.changePinText}>Change PIN</Text>
                  <ChevronRight size={16} color={colors.iconMuted} />
                </Pressable>
              ) : null}

              <Text style={styles.settingsFootnote}>
                {settingsSaveState.status === 'error'
                  ? 'Your preferences could not be saved. They may reset when the app closes.'
                  : settingsSaveState.status === 'dirty' || settingsSaveState.status === 'saving'
                    ? 'Saving your preferences…'
                    : 'Keyboard layout, language, dictation and autocorrect are provided by your operating system.'}
              </Text>
              <Text style={styles.settingsSecurityFootnote}>
                The app PIN gates access to Mothlight. Notes remain in local app storage and are not encrypted by the PIN.
              </Text>
            </ScrollView>
          </View>

          <Modal visible={pinSetupStep !== null} transparent animationType="fade" onRequestClose={() => {
            setPinSetupStep(null);
            setPinEntry('');
            setPinSetupDraft('');
            setPinError(null);
          }}>
            <View style={styles.pinModalBackdrop}>
              <View style={styles.pinSetupCard}>
                <View style={styles.pinSetupHeader}>
                  <Text style={styles.pinSetupTitle}>
                    {pinSetupStep === 'confirm' ? 'Confirm your PIN' : 'Create your PIN'}
                  </Text>
                  <Pressable onPress={() => {
                    setPinSetupStep(null);
                    setPinEntry('');
                    setPinSetupDraft('');
                    setPinError(null);
                  }} accessibilityRole="button" accessibilityLabel="Cancel PIN setup">
                    <X size={20} color={colors.iconMuted} />
                  </Pressable>
                </View>
                <Text style={styles.pinSetupSubtitle}>
                  {pinSetupStep === 'confirm' ? 'Enter the same six digits once more.' : 'Choose a six-digit PIN for this device.'}
                </Text>
                <PinDots value={pinEntry} />
                {pinError ? <Text style={styles.lockError}>{pinError}</Text> : null}
                <PinKeypad disabled={pinBusy} onDigit={handlePinDigit} onBackspace={handlePinBackspace} />
                <Pressable style={styles.pinCancelButton} onPress={() => {
                  setPinSetupStep(null);
                  setPinEntry('');
                  setPinSetupDraft('');
                  setPinError(null);
                }}>
                  <Text style={styles.pinCancelText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </ThemeContext.Provider>
    );
  }

  if (screen === 'library') {
    return (
      <ThemeContext.Provider value={themeContextValue}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={styles.library}>
          <View style={styles.libraryHeader}>
            <View>
              <Text style={styles.brandWordmark}>mothlight</Text>
              <Text style={styles.librarySubtitle}>A quieter place to think.</Text>
            </View>
            <View style={styles.libraryActions}>
              <Pressable onPress={() => setScreen('settings')} style={styles.settingsHomeButton} accessibilityRole="button" accessibilityLabel="Open settings">
                <SlidersHorizontal size={18} color={colors.icon} />
                <Text style={styles.settingsHomeLabel}>Settings</Text>
              </Pressable>
              <Pressable onPress={createNote} style={styles.newNoteButton} accessibilityRole="button" accessibilityLabel="Create a new note">
                <Plus size={18} color={colors.text} strokeWidth={1.8} />
                <Text style={styles.newNoteLabel}>New note</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.libraryRule} />
          {notes.length === 0 ? (
            <View style={styles.emptyLibrary}>
              <Text style={styles.emptyTitle}>A blank page.</Text>
              <Text style={styles.emptySubtitle}>Nothing saved here yet. Start with a thought.</Text>
              <Pressable style={styles.emptyButton} onPress={createNote}><Text style={styles.emptyButtonText}>Write a note</Text></Pressable>
            </View>
          ) : (
            <FlatList
              data={[...notes].sort((a, b) => b.updatedAt - a.updatedAt)}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.noteCardRow}
              contentContainerStyle={styles.noteList}
              renderItem={({ item }) => (
                <Pressable onPress={() => openNote(item.id)} style={({ pressed }) => [styles.noteCard, pressed && styles.noteCardPressed]}>
                  <Text numberOfLines={1} style={styles.noteCardTitle}>{getTitle(item)}</Text>
                  <Text numberOfLines={5} style={styles.noteCardPreview}>{item.content.trim() || 'A blank page, ready when you are.'}</Text>
                  <View style={styles.noteCardFooter}>
                    <Text style={styles.noteCardDate}>{new Date(item.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                    <ChevronRight size={14} color={colors.iconMuted} />
                  </View>
                </Pressable>
              )}
            />
          )}
          <View style={styles.libraryFooter}>
            <Text style={styles.footerMeta}>{notes.length} {notes.length === 1 ? 'page' : 'pages'} · stored on this device</Text>
          </View>
        </View>
      </SafeAreaView>
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={themeContextValue}>
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        style={styles.keyboardShell}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <View style={styles.appFrame}>
          <View style={styles.topBar}>
            <IconButton icon={ArrowLeft} label="Back to notes" onPress={() => { Keyboard.dismiss(); setScreen('library'); }} size={21} />
            <View style={styles.topRight}>
              <Text style={styles.counter}>{content.length.toLocaleString()} / 6,000</Text>
              <IconButton icon={previewMode ? PenLine : BookOpen} label={previewMode ? 'Edit note' : 'Preview formatted note'} onPress={() => {
                if (previewMode) {
                  setPreviewMode(false);
                  focusEditorAt(selection);
                } else {
                  Keyboard.dismiss();
                  setPreviewMode(true);
                }
              }} size={19} />
              <IconButton icon={Share2} label="Share note as text" onPress={shareNote} size={19} disabled={shareState === 'opening'} />
            </View>
          </View>

          <View style={styles.paperStage} onLayout={(event) => setStageWidth(event.nativeEvent.layout.width)}>
            <Animated.View pointerEvents="none" style={[styles.bulbLightWash, { opacity: bulbGlow.interpolate({ inputRange: [0.24, 1], outputRange: [0.035, 0.22] }) }]} />
            <Animated.View pointerEvents="none" style={[styles.bulbLightCore, { opacity: bulbGlow.interpolate({ inputRange: [0.24, 1], outputRange: [0.015, 0.10] }) }]} />
            {previewMode ? (
              <ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewContent}>
                {content.split('\n').map((line, index) => {
                  const parsed = parseFormattedLine(line);
                  if (parsed.kind === 'empty') return <View key={index} style={styles.previewSpacer} />;
                  if (parsed.kind === 'divider') return <View key={index} style={styles.previewDivider} />;
                  if (parsed.kind === 'heading') return <Text key={index} style={styles.previewHeading}>{parsed.text}</Text>;
                  if (parsed.kind === 'quote') return (
                    <View key={index} style={styles.previewQuote}>
                      <Text style={styles.previewQuoteText}>{parsed.text}</Text>
                    </View>
                  );
                  if (parsed.kind === 'bullet') return (
                    <View key={index} style={styles.previewBulletRow}>
                      <Text style={styles.previewBulletMark}>•</Text>
                      <Text style={styles.previewBody}>{parsed.text}</Text>
                    </View>
                  );
                  return <Text key={index} style={styles.previewBody}>{parsed.text}</Text>;
                })}
                {!content.trim() ? <Text style={styles.previewEmpty}>Nothing on this page yet.</Text> : null}
              </ScrollView>
            ) : (
              <>
            <TextInput
              ref={editorRef}
              style={styles.editorInput}
              value={content}
              onChangeText={handleTextChange}
              onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
              onFocus={() => setKeyboardVisible(true)}
              onBlur={() => setKeyboardVisible(false)}
              multiline
              maxLength={MAX_CHARS}
              autoCorrect
              spellCheck
              autoCapitalize="sentences"
              keyboardType="default"
              keyboardAppearance={resolvedTheme === 'dark' ? 'dark' : 'light'}
              returnKeyType="default"
              placeholder="Begin anywhere..."
              placeholderTextColor={colors.muted}
              selectionColor={colors.iconMuted}
              cursorColor={colors.text}
              textAlignVertical="bottom"
              scrollEnabled
              underlineColorAndroid="transparent"
              accessibilityLabel="Note text editor"
            />

            <View style={styles.glyphMeasure} pointerEvents="none" onLayout={(event) => {
              const measured = event.nativeEvent.layout.width / 12;
              if (Number.isFinite(measured) && measured > 1) setGlyphWidth(measured);
            }}>
              <Text style={styles.editorTypography}>MMMMMMMMMMMM</Text>
            </View>
              </>
            )}

            <View style={styles.railTrack} onLayout={(event) => setRailWidth(event.nativeEvent.layout.width)}>
              <View style={styles.railShadow} />
              <View style={styles.railHighlight} />
              <Animated.View style={[styles.carriage, { transform: [{ translateX: carriageX }] }]}>
                <Animated.View
                  style={[
                    styles.keyBulb,
                    {
                      opacity: bulbGlow,
                      transform: [{ scale: bulbGlow.interpolate({ inputRange: [0.24, 1], outputRange: [0.82, 1.18] }) }],
                    },
                  ]}
                >
                  <Lightbulb size={15} color={colors.amber} fill={colors.amber} />
                </Animated.View>
                <Animated.View style={[styles.typebar, { transform: [{ translateY: strikeValue }] }]} />
                <View style={styles.typebarTip} />
                <View style={styles.carriageDots}>
                  <View style={styles.carriageDot} />
                  <View style={styles.carriageDot} />
                </View>
              </Animated.View>
            </View>
            <View style={styles.paperEdge} />
          </View>

          {currentNote?.attachments?.length ? (
            <View style={styles.attachmentShelf}>
              <Text style={styles.attachmentShelfTitle}>ATTACHMENTS · {currentNote.attachments.length}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentShelfItems}>
                {currentNote.attachments.map((attachment) => (
                  <View key={attachment.id} style={styles.attachmentItem}>
                    <Image source={{ uri: attachment.uri }} style={styles.attachmentImage} />
                    <Pressable
                      onPress={() => removeAttachment(attachment.id)}
                      style={styles.attachmentRemove}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${attachment.name}`}
                    >
                      <X size={12} color={colors.toolbarText} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={[styles.toolbarDock, keyboardVisible && styles.toolbarDockKeyboard]}>
            <View style={styles.toolbarPill}>
              <IconButton
                icon={toolbarExpanded ? ChevronDown : ChevronUp}
                label={toolbarExpanded ? 'Collapse toolbar' : 'Expand toolbar'}
                onPress={() => dispatchToolbar({ type: 'TOGGLE' })}
                size={19}
              />
              {toolbarExpanded ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarActions}>
                  {toolbarActions.map((action) => (
                    <IconButton key={action.label} icon={action.icon} label={action.label} onPress={action.action} disabled={action.disabled} />
                  ))}
                </ScrollView>
              ) : null}
              <View style={styles.toolbarEndMark}>
                {saveState.status === 'saved'
                  ? <Check size={15} color={colors.accent} />
                  : <View style={[styles.toolbarEndDot, saveState.status === 'error' && { backgroundColor: colors.danger }]} />}
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={panel !== null} transparent animationType="slide" onRequestClose={() => setPanel(null)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalScrim} onPress={() => setPanel(null)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{panelTitle}</Text>
              <Pressable onPress={() => setPanel(null)} hitSlop={8}><X size={19} color={colors.iconMuted} /></Pressable>
            </View>

            {panel === 'ideas' ? (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.sheetIntro}>Small local helpers. Your writing stays on this device.</Text>
                    <PanelAction
                      icon={WandSparkles}
                      title="Clean up spacing"
                      detail="Tidy repeated spaces and punctuation."
                      onPress={() => applyHelperText(content.replace(/[ \t]+([,.;!?])/g, '$1').replace(/[ \t]{2,}/g, ' '))}
                      disabled={!content.trim()}
                    />
                <PanelAction
                  icon={List}
                  title="Turn lines into a list"
                  detail="Add a quiet bullet to each non-empty line."
                  onPress={() => applyHelperText(content.split('\n').map((line) => line.trim() ? '· ' + line : line).join('\n'))}
                  disabled={!content.trim()}
                />
                <PanelAction icon={Lightbulb} title="Add a thought-starter" detail="Insert a gentle prompt at the cursor." onPress={() => insertAtSelection('What I want to remember is ')} />
              </ScrollView>
            ) : null}

            {panel === 'page' ? (
              <View>
                <PanelAction icon={Plus} title="New page" detail="Start with a fresh sheet of paper." onPress={createNote} />
                <PanelAction icon={Copy} title="Duplicate this page" detail="Make a local copy, including attachments." onPress={duplicateCurrentNote} />
                <PanelAction icon={Trash2} title="Delete this page" detail="Remove this note from this device." destructive onPress={deleteCurrentNote} />
              </View>
            ) : null}

            {panel === 'search' ? (
              <View>
                <View style={styles.searchInputWrap}>
                  <Search size={17} color={colors.iconMuted} />
                  <TextInput
                    ref={searchRef}
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Find a word or phrase"
                    placeholderTextColor={colors.muted}
                    style={styles.searchInput}
                    returnKeyType="search"
                    onSubmitEditing={findNext}
                    autoCorrect={false}
                  />
                  <Pressable onPress={() => setSearchText('')} disabled={!searchText} accessibilityRole="button" accessibilityLabel="Clear search" style={!searchText ? styles.disabledControl : undefined}>
                    <X size={16} color={colors.iconMuted} />
                  </Pressable>
                </View>
                <Pressable style={styles.primaryPanelButton} onPress={findNext} disabled={!searchText.trim()} accessibilityRole="button">
                  <Text style={styles.primaryPanelButtonText}>Find next match</Text>
                  <Search size={16} color={colors.inverseText} />
                </Pressable>
                {searchState.status === 'found' ? <Text style={styles.sheetIntro}>Match selected. Close this panel to view it in your note.</Text> : null}
                {searchState.status === 'not-found' ? <Text style={styles.sheetIntro}>No match found. Try another word or phrase.</Text> : null}
              </View>
            ) : null}

            {panel === 'format' ? (
              <View>
                <View style={styles.formatGrid}>
                  <Pressable style={styles.formatButton} onPress={() => applyPrefix('## ', true)} accessibilityRole="button"><Heading2 size={18} color={colors.icon} /><Text style={styles.formatLabel}>Heading</Text></Pressable>
                  <Pressable style={styles.formatButton} onPress={() => applyPrefix('• ', true)} accessibilityRole="button"><List size={18} color={colors.icon} /><Text style={styles.formatLabel}>Bullet</Text></Pressable>
                  <Pressable style={styles.formatButton} onPress={() => applyPrefix('> ', true)} accessibilityRole="button"><Quote size={18} color={colors.icon} /><Text style={styles.formatLabel}>Quote</Text></Pressable>
                  <Pressable style={styles.formatButton} onPress={() => insertAtSelection('\n— — —\n', true)} accessibilityRole="button"><Minus size={18} color={colors.icon} /><Text style={styles.formatLabel}>Divider</Text></Pressable>
                </View>
                <View style={styles.undoRow}>
                  <Pressable style={[styles.undoButton, !history.undo.length && styles.disabledControl]} onPress={undo} disabled={!history.undo.length} accessibilityRole="button">
                    <Undo2 size={16} color={colors.icon} /><Text style={styles.undoText}>Undo</Text>
                  </Pressable>
                  <Pressable style={[styles.undoButton, !history.redo.length && styles.disabledControl]} onPress={redo} disabled={!history.redo.length} accessibilityRole="button">
                    <Redo2 size={16} color={colors.icon} /><Text style={styles.undoText}>Redo</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {panel === 'reminder' ? (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.sheetIntro}>Choose a quick reminder or select an exact date and time.</Text>
                <PanelAction icon={Bell} title="In 10 minutes" detail="A gentle nudge, soon." onPress={() => scheduleReminder(10)} disabled={reminderBusy} />
                <PanelAction icon={Clock3} title="In 1 hour" detail="Return to this thought later." onPress={() => scheduleReminder(60)} disabled={reminderBusy} />
                <PanelAction icon={BookOpen} title="Tomorrow" detail="Bring this page back in 24 hours." onPress={() => scheduleReminder(1440)} disabled={reminderBusy} />
                <View style={styles.customReminderSection}>
                  <Pressable
                    style={styles.customReminderToggle}
                    onPress={() => setCustomReminderOpen((open) => !open)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: customReminderOpen }}
                  >
                    <View style={styles.customReminderText}>
                      <Text style={styles.customReminderTitle}>Custom date and time</Text>
                      <Text style={styles.customReminderValue}>{customReminderDate.toLocaleString()}</Text>
                    </View>
                    <ChevronDown size={18} color={colors.iconMuted} />
                  </Pressable>
                  {customReminderOpen ? (
                    <DateTimePicker
                      value={customReminderDate}
                      onValueChange={(_, selectedDate) => {
                        setCustomReminderDate(selectedDate);
                        if (Platform.OS === 'android') setCustomReminderOpen(false);
                      }}
                      onDismiss={() => setCustomReminderOpen(false)}
                      mode="datetime"
                      presentation={Platform.OS === 'android' ? 'dialog' : 'inline'}
                      minimumDate={new Date()}
                      accentColor={colors.accent}
                      themeVariant={resolvedTheme}
                    />
                  ) : null}
                  <Pressable
                    style={[styles.customReminderSchedule, reminderBusy && styles.disabledControl]}
                    onPress={() => void scheduleReminderAt(customReminderDate)}
                    disabled={reminderBusy}
                    accessibilityRole="button"
                  >
                    <Text style={styles.customReminderScheduleText}>Schedule selected time</Text>
                  </Pressable>
                </View>
                {currentNote?.reminderAt ? <Text style={styles.reminderMeta}>Already set for {new Date(currentNote.reminderAt).toLocaleString()}.</Text> : null}
              </ScrollView>
            ) : null}

            {panel === 'smart' ? (
              <View>
                <Text style={styles.sheetIntro}>Private, on-device actions. Nothing is sent to an AI service.</Text>
                {helperResult ? (
                  <View style={styles.resultBox}>
                    <Text style={styles.resultText}>{helperResult}</Text>
                    <View style={styles.resultButtons}>
                      <Pressable onPress={() => setHelperResult('')} style={styles.resultCancel}><Text style={styles.resultCancelText}>Discard</Text></Pressable>
                      <Pressable onPress={() => {
                        if (currentNote) {
                          dispatchHistory({ type: 'RECORD', value: content });
                          updateNote(currentNote.id, { content: helperResult });
                        }
                        dispatchHelper({ type: 'APPLY' });
                        setPanel(null);
                      }} style={styles.resultApply}><Text style={styles.resultApplyText}>Replace note</Text></Pressable>
                    </View>
                  </View>
                ) : (
                  <View>
                    <PanelAction icon={PenLine} title="Polish punctuation" detail="Preview a light spacing and punctuation tidy." onPress={polishText} disabled={!content.trim()} />
                    <PanelAction icon={FileText} title="Create a short summary" detail="Make a quick excerpt from the opening lines." onPress={() => setHelperResult(smartSummary())} disabled={!content.trim()} />
                    <PanelAction
                      icon={List}
                      title="Collect action lines"
                      detail="Find lines with TODO, should, need to or remember."
                      onPress={() => {
                        const actions = lineItems();
                        if (actions.length) setHelperResult(actions.join('\n'));
                        else Alert.alert('No action lines found', 'Add a line containing TODO, need to, should, remember to or action: and try again.');
                      }}
                      disabled={!content.trim()}
                    />
                    <PanelAction icon={Heading2} title="Suggest a title" detail="Use the first meaningful line as the page title." onPress={() => {
                      const firstLine = content.split('\n').map((line) => line.trim()).find(Boolean);
                      if (firstLine && currentNote) updateNote(currentNote.id, { title: firstLine.slice(0, 42) });
                      setPanel(null);
                    }} disabled={!content.trim()} />
                  </View>
                )}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </ThemeContext.Provider>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  brandWordmark: { color: colors.text, fontSize: 23, letterSpacing: 1.1, fontWeight: '500' },
  loadingCaption: { marginTop: 8, color: colors.muted, fontSize: 11, letterSpacing: 1.2 },
  keyboardShell: { flex: 1 },
  appFrame: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: colors.background },
  topBar: { minHeight: 48, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.paperStage },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  counter: { color: colors.secondaryText, fontSize: 11, letterSpacing: 1.1, fontVariant: ['tabular-nums'] },
  toolButton: { width: 32, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  toolButtonActive: { backgroundColor: colors.accent },
  disabledControl: { opacity: 0.42 },
  pressed: { transform: [{ scale: 0.92 }], opacity: 0.78 },
  paperStage: { flex: 1, minHeight: 230, position: 'relative', backgroundColor: colors.paperStage, overflow: 'hidden' },
  editorInput: {
    position: 'absolute', top: 26, left: 25, right: 25, bottom: 72,
    color: colors.text, fontFamily: 'CourierPrime_400Regular', fontSize: 15, lineHeight: 27,
    letterSpacing: 0.75, padding: 0, margin: 0, includeFontPadding: false,
    textAlignVertical: 'bottom',
  },
  editorTypography: { fontFamily: 'monospace', fontSize: 15, lineHeight: 27, letterSpacing: 0.75, includeFontPadding: false, color: colors.text },
  previewScroll: { position: 'absolute', top: 20, left: 24, right: 24, bottom: 72 },
  previewContent: { paddingBottom: 24 },
  previewHeading: { color: colors.text, fontFamily: 'CourierPrime_400Regular', fontSize: 25, lineHeight: 33, fontWeight: '700', marginBottom: 9, marginTop: 3 },
  previewBody: { color: colors.text, fontFamily: 'CourierPrime_400Regular', fontSize: 15, lineHeight: 27, letterSpacing: 0.5 },
  previewQuote: { borderLeftWidth: 3, borderLeftColor: colors.amber, paddingLeft: 12, marginVertical: 7 },
  previewQuoteText: { color: colors.secondaryText, fontFamily: 'CourierPrime_400Regular', fontSize: 14, lineHeight: 24, fontStyle: 'italic' },
  previewBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 2 },
  previewBulletMark: { color: colors.accent, fontSize: 16, lineHeight: 27 },
  previewDivider: { height: 1, backgroundColor: colors.paperEdge, marginVertical: 14, opacity: 0.8 },
  previewSpacer: { height: 12 },
  previewEmpty: { color: colors.muted, fontSize: 13, fontStyle: 'italic' },
  glyphMeasure: { position: 'absolute', left: -1000, top: -1000, opacity: 0 },
  attachmentShelf: { minHeight: 76, paddingHorizontal: 22, paddingTop: 7, paddingBottom: 8, borderTopWidth: 1, borderTopColor: colors.panelBorder, backgroundColor: colors.surface },
  attachmentShelfTitle: { color: colors.muted, fontSize: 8, letterSpacing: 1.2, marginBottom: 6 },
  attachmentShelfItems: { gap: 9, paddingRight: 12 },
  attachmentItem: { width: 56, height: 56, position: 'relative' },
  attachmentImage: { width: 56, height: 56, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  attachmentRemove: { position: 'absolute', right: -5, top: -5, height: 18, width: 18, borderRadius: 9, backgroundColor: colors.carriageBorder, alignItems: 'center', justifyContent: 'center' },
  bulbLightWash: { position: 'absolute', width: 340, height: 340, borderRadius: 170, backgroundColor: colors.amber, bottom: -142, alignSelf: 'center', shadowColor: colors.amber, shadowOpacity: 0.95, shadowRadius: 80, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  bulbLightCore: { position: 'absolute', width: 210, height: 260, borderRadius: 130, backgroundColor: colors.amber, bottom: -82, alignSelf: 'center', shadowColor: colors.amber, shadowOpacity: 0.9, shadowRadius: 50, shadowOffset: { width: 0, height: 0 }, elevation: 5 },
  railTrack: { position: 'absolute', left: 18, right: 18, bottom: 28, height: 6, justifyContent: 'center' },
  railShadow: { position: 'absolute', left: 0, right: 0, height: 5, borderRadius: 3, backgroundColor: colors.rail, shadowColor: colors.shadow, shadowOpacity: 0.24, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  railHighlight: { position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundColor: colors.railHighlight, opacity: 0.7 },
  carriage: { position: 'absolute', left: 0, top: -10, width: 62, height: 24, borderRadius: 8, backgroundColor: colors.carriage, borderWidth: 1, borderColor: colors.carriageBorder, alignItems: 'center', justifyContent: 'center', shadowColor: colors.shadow, shadowOpacity: 0.22, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  keyBulb: { position: 'absolute', top: -20, left: 21, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  typebar: { position: 'absolute', bottom: 17, left: 27, height: 35, width: 2, backgroundColor: colors.typebar, transform: [{ rotate: '4deg' }] },
  typebarTip: { position: 'absolute', bottom: 49, left: 24, width: 8, height: 5, borderRadius: 2, backgroundColor: colors.typebar, transform: [{ rotate: '15deg' }] },
  carriageDots: { flexDirection: 'row', gap: 4 },
  carriageDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.amber, shadowColor: colors.amber, shadowOpacity: 0.55, shadowRadius: 2, elevation: 1 },
  paperEdge: { position: 'absolute', bottom: 0, left: 24, right: 24, height: 1, backgroundColor: colors.paperEdge, opacity: 0.55 },
  toolbarDock: { minHeight: 62, paddingHorizontal: 14, paddingTop: 5, paddingBottom: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paperStage },
  toolbarDockKeyboard: { paddingBottom: 5, minHeight: 56 },
  toolbarPill: { height: 44, maxWidth: 460, width: '100%', borderRadius: 23, backgroundColor: colors.toolbar, borderColor: colors.paperEdge, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, shadowColor: colors.shadow, shadowOpacity: 0.15, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 2 },
  toolbarEndMark: { width: 22, alignItems: 'center', justifyContent: 'center' },
  toolbarEndDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent, opacity: 0.85 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalScrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 22, paddingTop: 9, maxHeight: '72%', borderTopWidth: 1, borderColor: colors.border },
  sheetHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 3, backgroundColor: colors.sheetHandle, marginBottom: 14 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: colors.text, fontSize: 16, letterSpacing: 0.2, fontWeight: '500' },
  sheetIntro: { color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  panelAction: { minHeight: 61, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.panelBorder, gap: 12, paddingVertical: 9 },
  panelActionPressed: { opacity: 0.56 },
  panelIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.panelIcon, alignItems: 'center', justifyContent: 'center' },
  panelIconDanger: { backgroundColor: colors.panelIconDanger },
  panelActionText: { flex: 1, gap: 3 },
  panelActionTitle: { color: colors.text, fontSize: 13, letterSpacing: 0.1 },
  panelActionDetail: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  searchInputWrap: { height: 46, borderRadius: 13, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 0 },
  primaryPanelButton: { backgroundColor: colors.toolbar, borderRadius: 13, height: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 10 },
  primaryPanelButtonText: { color: colors.inverseText, fontSize: 13, letterSpacing: 0.2 },
  formatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  formatButton: { flexGrow: 1, flexBasis: '22%', minHeight: 70, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 13, borderWidth: 1, borderColor: colors.cardBorder },
  formatLabel: { color: colors.icon, fontSize: 11 },
  undoRow: { flexDirection: 'row', gap: 12, marginTop: 13 },
  undoButton: { flex: 1, height: 40, borderRadius: 12, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  undoText: { color: colors.icon, fontSize: 12 },
  toggleRow: { minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.panelBorder, flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchTrack: { width: 42, height: 24, borderRadius: 14, backgroundColor: colors.switchOff, padding: 3, justifyContent: 'center' },
  switchTrackOn: { backgroundColor: colors.switchOn },
  switchThumb: { height: 18, width: 18, borderRadius: 9, backgroundColor: colors.switchThumb },
  switchThumbOn: { alignSelf: 'flex-end', backgroundColor: colors.switchThumb },
  settingsFootnote: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 13, marginBottom: 6 },
  reminderMeta: { color: colors.muted, fontSize: 11, paddingVertical: 10 },
  customReminderSection: { borderTopWidth: 1, borderTopColor: colors.panelBorder, marginTop: 7, paddingTop: 11 },
  customReminderToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  customReminderText: { flex: 1 },
  customReminderTitle: { color: colors.text, fontSize: 13 },
  customReminderValue: { color: colors.muted, fontSize: 11, marginTop: 4 },
  customReminderSchedule: { minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.toolbar, marginTop: 12, marginBottom: 5 },
  customReminderScheduleText: { color: colors.inverseText, fontSize: 12, fontWeight: '500' },
  resultBox: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 14 },
  resultText: { color: colors.text, fontSize: 13, lineHeight: 20, fontFamily: 'monospace' },
  resultButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 13 },
  resultCancel: { paddingVertical: 9, paddingHorizontal: 13 },
  resultCancelText: { color: colors.muted, fontSize: 12 },
  resultApply: { backgroundColor: colors.toolbar, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10 },
  resultApplyText: { color: colors.inverseText, fontSize: 12 },
  library: { flex: 1, width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 26, paddingTop: 18 },
  libraryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 },
  libraryActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingsHomeButton: { minHeight: 40, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 7 },
  settingsHomeLabel: { color: colors.secondaryText, fontSize: 11 },
  librarySubtitle: { color: colors.muted, fontSize: 12, marginTop: 5, letterSpacing: 0.3 },
  newNoteButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 18 },
  newNoteLabel: { color: colors.text, fontSize: 12 },
  libraryRule: { height: 1, backgroundColor: colors.panelBorder, opacity: 0.8 },
  noteList: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 30, gap: 12 },
  noteCardRow: { gap: 12 },
  noteCard: { flex: 1, minHeight: 158, maxWidth: '50%', padding: 13, borderRadius: 15, borderWidth: 1, borderColor: colors.panelBorder, backgroundColor: colors.surface, justifyContent: 'space-between', shadowColor: colors.shadow, shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  noteCardPressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
  noteCardTitle: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  noteCardPreview: { flex: 1, color: colors.muted, fontSize: 11, lineHeight: 16 },
  noteCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.panelBorder },
  noteCardDate: { color: colors.muted, fontSize: 9, letterSpacing: 0.3 },
  libraryFooter: { marginTop: 'auto', paddingVertical: 13, borderTopWidth: 1, borderTopColor: colors.panelBorder },
  footerMeta: { color: colors.muted, fontSize: 10, letterSpacing: 0.4 },
  emptyLibrary: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '400' },
  emptySubtitle: { color: colors.muted, fontSize: 12, marginTop: 8 },
  emptyButton: { marginTop: 22, backgroundColor: colors.toolbar, borderRadius: 16, paddingHorizontal: 19, paddingVertical: 11 },
  emptyButtonText: { color: colors.inverseText, fontSize: 12 },

  loadingLogo: { width: 112, height: 112, marginBottom: 15 },
  lockScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, backgroundColor: colors.background },
  lockLogo: { width: 172, height: 172, marginBottom: 8 },
  lockTitle: { color: colors.text, fontSize: 23, lineHeight: 31, textAlign: 'center', marginTop: 24 },
  lockSubtitle: { color: colors.muted, fontSize: 13, lineHeight: 20, maxWidth: 310, textAlign: 'center', marginTop: 9 },
  lockError: { color: colors.danger, fontSize: 11, marginTop: 14, textAlign: 'center' },
  pinDotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 13, marginTop: 23, marginBottom: 22 },
  pinDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border },
  pinDotFilled: { backgroundColor: colors.accent, transform: [{ scale: 1.12 }] },
  pinKeypad: { width: 270, alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  pinKey: { width: 78, height: 55, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  pinKeyText: { color: colors.text, fontSize: 21, fontWeight: '500' },
  pinModalBackdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 22 },
  pinSetupCard: { width: '100%', maxWidth: 390, borderRadius: 24, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pinSetupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pinSetupTitle: { color: colors.text, fontSize: 18, fontWeight: '500' },
  pinSetupSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 8, textAlign: 'center' },
  pinCancelButton: { alignSelf: 'center', padding: 12, marginTop: 8 },
  pinCancelText: { color: colors.muted, fontSize: 12 },
  lockFootnote: { color: colors.muted, fontSize: 10, marginTop: 18, textAlign: 'center' },
  onboardingRoot: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 28, paddingTop: 20, paddingBottom: 22 },
  onboardingTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 38 },
  onboardingKicker: { color: colors.muted, fontSize: 9, letterSpacing: 1.35 },
  onboardingSkip: { color: colors.muted, fontSize: 12, paddingVertical: 8, paddingHorizontal: 3 },
  onboardingHero: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  onboardingLogo: { width: 258, height: 258, maxWidth: '76%' },
  onboardingProgress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12 },
  onboardingProgressDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.border },
  onboardingProgressDotActive: { width: 20, backgroundColor: colors.accent },
  onboardingCopy: { paddingTop: 8, paddingBottom: 4 },
  onboardingStep: { color: colors.icon, fontSize: 10, letterSpacing: 1.5, marginBottom: 11 },
  onboardingTitle: { color: colors.text, fontSize: 29, lineHeight: 37, letterSpacing: -0.5 },
  onboardingBody: { color: colors.muted, fontSize: 13, lineHeight: 21, marginTop: 12, maxWidth: 520 },
  onboardingActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 25 },
  onboardingBack: { minWidth: 74, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  onboardingBackText: { color: colors.muted, fontSize: 12 },
  onboardingBackPlaceholder: { minWidth: 74 },
  onboardingNext: { minHeight: 46, minWidth: 154, paddingHorizontal: 18, borderRadius: 23, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  onboardingNextText: { color: colors.accentText, fontSize: 12, fontWeight: '600' },
  onboardingPrivacy: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 15 },
  appearancePicker: { marginTop: 22 },
  appearancePickerTitle: { color: colors.muted, fontSize: 9, letterSpacing: 1.2, marginBottom: 9 },
  appearanceOptions: { flexDirection: 'row', gap: 8 },
  appearanceOption: { flex: 1, minHeight: 39, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  appearanceOptionSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  appearanceOptionText: { color: colors.secondaryText, fontSize: 11 },
  appearanceOptionTextSelected: { color: colors.accentText, fontWeight: '600' },
  settingsPage: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 10 },
  settingsPageHeader: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.panelBorder },
  settingsPageTitleWrap: { flex: 1 },
  settingsPageTitle: { color: colors.text, fontSize: 20, fontWeight: '500' },
  settingsPageSubtitle: { color: colors.muted, fontSize: 11, marginTop: 3 },
  settingsHeaderSpacer: { width: 32 },
  settingsPageContent: { paddingBottom: 34 },
  settingsSecuritySection: { marginTop: 28 },
  changePinButton: { minHeight: 47, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.panelBorder },
  changePinText: { color: colors.accent, fontSize: 12 },
  settingsSection: { color: colors.muted, fontSize: 10, letterSpacing: 1.15, marginTop: 18, marginBottom: 7 },
  themeOptions: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  themeOption: { flex: 1, minHeight: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  themeOptionSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  themeOptionText: { color: colors.secondaryText, fontSize: 11 },
  themeOptionTextSelected: { color: colors.accentText, fontWeight: '600' },
  settingsSecurityFootnote: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 9, marginBottom: 4 },
});
}

// Safe-area hooks must be rendered beneath this root provider.
export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
