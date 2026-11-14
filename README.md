# Mothlight

A quiet typewriter-inspired writing space for notes and unfinished thoughts.

Mothlight is built with Expo and React Native so writing happens in a native text field: the operating-system keyboard, selection handles, paste, autocorrect, dictation and language switching remain native. The layout is tuned for tall phones, tablets and resizable foldable displays.

## Run locally

`npm install`
`npx expo start`

For a native Android development build, run `npx expo run:android`. For iOS, run `npx expo run:ios` on macOS with Xcode installed.

## Included

- 3,000-character editor with a live counter and local autosave.
- Courier Prime typewriter typography on a warm paper surface.
- A mechanical rail, two-dot sliding carriage and striking typebar driven by the native cursor selection and measured monospaced glyph width.
- Quiet typewriter audio variations for normal keys, spaces, backspace and carriage return, plus independent sound and haptic settings.
- Compact contextual tools for attachments, local writing suggestions, page actions, in-note search, text prefixes, undo/redo, settings, reminders and smart actions.
- Local note storage, create/duplicate/delete, plain-text share and scheduled local notifications.
- The system keyboard is never simulated; Android uses resize behavior so the editor and toolbar stay above it.

## Privacy

Notes, settings and compressed image attachments are stored locally using AsyncStorage. Writing helpers are deterministic on-device text operations; note content is not sent to an AI service.

## Reference palette

Paper `#D4D0CD` · secondary `#BDB9B8` · toolbar `#777477` · keyboard `#373538` · key surface `#AAA7AC` · ink `#29272A` · sage `#C2D3A9`.