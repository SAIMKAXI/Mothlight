# Mothlight

A quiet typewriter-inspired writing space for notes and unfinished thoughts, with a moth-and-page identity.

Mothlight is built with Expo and React Native so writing happens in a native text field: the operating-system keyboard, selection handles, paste, autocorrect, dictation and language switching remain native. The layout is tuned for tall phones, tablets and resizable foldable displays.

## Run locally

`npm install`
`npx expo start`

For a native Android development build, run `npx expo run:android`. For iOS, run `npx expo run:ios` on macOS with Xcode installed.

## Included

- 6,000-character editor with a live counter and local autosave.
- Courier Prime typewriter typography on a warm paper surface.
- A mechanical rail, two-dot sliding carriage and striking typebar driven by the native cursor selection and measured monospaced glyph width.
- Quiet typewriter audio variations for normal keys, spaces, backspace and carriage return, plus independent sound and haptic settings.
- Compact contextual tools for attachments, local writing suggestions, page actions, in-note search, text prefixes, undo/redo, settings, reminders and smart actions.
- Local note storage, create/duplicate/delete, plain-text share and scheduled local notifications with quick presets and a custom date/time picker.
- A three-step first-run onboarding flow, a native branded splash screen, and a reusable moth/page app mark.
- A Home screen with an explicit New note action and a separate Settings screen; System / Light / Dark appearance settings live outside the editor.
- Optional six-digit in-app PIN lock stored securely on-device; it is an access gate, not at-rest note encryption.
- The system keyboard is never simulated; Android uses resize behavior so the editor and toolbar stay above it.

## Appearance and app lock

The app defaults to following the system appearance. Users can choose Light or Dark in Settings; the choice is persisted locally. First-run onboarding appears once for new installations, while existing installations with stored notes are taken directly to their library/editor.

App lock is optional and delegates authentication to iOS/Android through Expo LocalAuthentication. It uses enrolled device biometrics, with system passcode fallback where supported, and does not store a separate PIN. This is an access-control screen only: notes continue to use the existing AsyncStorage store and are not encrypted at rest.

## Privacy

Notes, settings and compressed image attachments are stored locally using AsyncStorage. Writing helpers are deterministic on-device text operations; note content is not sent to an AI service.

## Reference palette

Paper `#D4D0CD` · secondary `#BDB9B8` · toolbar `#777477` · keyboard `#373538` · key surface `#AAA7AC` · ink `#29272A` · sage `#C2D3A9`.

## Explicit state machines

Interactive and asynchronous flows are modeled in `src/stateMachines.ts` and consumed by the app through reducers. The models define allowed transitions for startup recovery, navigation and panels, keyboard visibility, toolbar expansion, editor history, typewriter strikes, autosave revisions, image attachments, reminders, in-note search, and writing-helper previews.

Pure transition tests run with `npm run test:states`. The CI workflow runs those tests in addition to Expo dependency validation and TypeScript checks. See [docs/STATE_MACHINES.md](docs/STATE_MACHINES.md) for state diagrams and invariants.

## Website

The Angular + Three.js landing page lives in `website/`. Run it with `cd website && npm install && npm start`. GitHub Pages deployment is configured in `.github/workflows/site-pages.yml`.

## Android preview signing

See [docs/ANDROID_TEST_SIGNING.md](docs/ANDROID_TEST_SIGNING.md) for the persistent test-keystore setup and the one-time v0.2.7 migration note.
