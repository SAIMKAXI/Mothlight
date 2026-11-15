# Mothlight website

Angular + Three.js landing page for Mothlight. The page reads the public GitHub Releases API and downloads the newest attached ARM64 Android APK, including prereleases.

## Local development

```bash
npm install
npm start
```

## Production build

```bash
npm run build -- --base-href "/Mothlight/"
```

The GitHub Pages workflow builds this folder and deploys `dist/mothlight-site/browser`. In the repository's **Settings → Pages**, set the source to **GitHub Actions** if it is not already enabled.

The 3D moth is generated with Three.js geometry and lights; it does not require a downloaded model or image.
