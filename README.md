# DayFlow PWA (Installable Web App)

## What's Inside
- `index.html` — 5-section layout (Dashboard, Tasks, Calendar, Focus Timer, Summary) + PWA meta tags
- `style.css` — Electric Blue (`#3A4EFB` -> `#33A4FA`), Neon Lime (`#E3FF3B`), Deep Navy (`#252943`), Lavender-Grey (`#DEE0ED`) theme + hover spotlight/tilt/ripples + mobile bottom dock
- `script.js` — Tasks CRUD, Monthly Calendar, Pomodoro Focus Timer with audio chime, LocalStorage persistence, and PWA install prompt
- `manifest.json` — Web App Manifest for standalone mobile/desktop installation
- `sw.js` — Offline Service Worker
- `icons/icon-192.png` & `icons/icon-512.png` — Crisp app icons

## Deploy on GitHub Pages
Extract all files directly into your `DayFlow-Productivity-App` root folder and push:

```bash
git add index.html style.css script.js manifest.json sw.js icons
git commit -m "Upgrade DayFlow to Installable PWA with Calendar and Focus Timer"
git push
```
