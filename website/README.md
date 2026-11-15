# Mothlight website

An Angular standalone application with a Three.js hero scene.

## Run locally

```bash
cd website
npm install
npm start
```

## Build

```bash
npm run build
```

The site resolves the newest published GitHub release that contains an ARM64 APK at runtime, then points both download buttons directly to that release asset. The last known release URL is retained as a fallback if GitHub's release API is temporarily unavailable.

The production build is configured for the repository's GitHub Pages path: `/Mothlight/`.
