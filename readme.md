# iisu Web Emulator UI

A lightweight, browser-based front-end for running console ROMs in the browser using EmulatorJS with optional RetroAchievements support. Intended as a static UI for browsing ROM folders, selecting covers, and launching games using WebAssembly cores or EmulatorJS loader.

## Key features
- Browse ROMs in a 2xN grid and a console-sorted list
- Uses the File System Access API to select and remember a ROM folder
- IndexedDB storage for settings, chosen ROM folder handle and imported covers
- Automatic cover-art lookup from the iiSU database with a Wikipedia fallback
- RetroAchievements support (username + API key) with periodic polling for achievement progress
- Emulator integration via EmulatorJS (loader pulled from CDN) and included libretro cores for offline use
- Several UI themes and emulator settings (volume, auto fullscreen, auto-save, auto-start)
- Service worker for offline support


## Supported ROM types (detected by extension)
- NES: .nes
- SNES: .sfc, .smc
- Game Boy / Game Boy Color: .gb, .gbc
- Game Boy Advance: .gba

(See the console/core mapping in app.js for exact behavior and to add new mappings.)

## Console <-> Core mapping
The built-in mapping (in app.js) associates file extensions with a console name and a libretro core identifier. By default:
- nes -> NES (fceumm_libretro)
- sfc / smc -> SNES (snes9x_libretro)
- gb / gbc -> GBC (gambatte_libretro)
- gba -> GBA (mgba_libretro)

The repository also includes prebuilt cores in the `cores/` directory (WebAssembly + JS shims) which can be used for local/offline setups.

## Stack
- Languages: HTML, CSS, JavaScript
- Runtime: Static web app (served over HTTP/HTTPS or localhost)
- Notable third-party:
  - EmulatorJS (loader: https://cdn.emulatorjs.org)
  - iiSU assets API for cover art (https://iidb-api.iisu.network)
  - RetroAchievements.org API for achievement metadata and progress

## Repository layout (top-level)
```
ROMS/                   Example ROM files included for demonstration (not required)
assets/                 UI images, icons, borders and placeholder covers
  ├─ borders/           console border images used around covers
  ├─ icons/             navigation and action icons
  └─ covers/            (covers storage / README inside)
cores/                  Prebuilt libretro cores (.js + .wasm) for offline usage
app.js                  Main application logic (UI, scanning, settings, RA integration)
emulator.js             Lightweight shim to start/stop EmulatorJS and manage navigation
index.html              Single-page app HTML (French UI copy)
readme.md               This file (project README)
service-worker.js       Service worker that provides offline caching and assets
styles.css              All visual styles and themes used by the UI
```

How it fits together: The web UI (index.html + styles.css + app.js) is a small single-page application. app.js scans a user-selected ROM folder (File System Access API) and maintains ROM metadata in memory and IndexedDB, then launches the emulator via the emulatorCore shim (emulator.js) which configures EmulatorJS or local cores to load the ROM bytes. Cover lookup and RetroAchievements integration happen client-side via public APIs.

## How to run (shortest path)
This is a static web app. For full functionality you should serve it over HTTP/HTTPS rather than opening the file:// URL (browsers restrict the File System Access API and service workers on file://).

Quick local server options:

- Python 3 (simple):

  python -m http.server 8000

  Then open http://localhost:8000 in a modern Chromium-based browser (Chrome, Edge, Opera).

- Node (http-server):

  npx http-server -c-1 . -p 8000

- Serve (npm):

  npx serve . -l 8000

Open the site and choose "Ajouter une ROM" to select a ROM folder.

Notes:
- For the File System Access API (remembering the folder handle) use Chromium-based browsers (Chrome, Edge, Opera). Firefox currently doesn't provide the same directory picker API.
- The app registers a service worker to enable offline caching. If you change service-worker.js, update the cache version referenced in index.html (currently `?v=18`).

## Browser permissions and requirements
- File System Access API (showDirectoryPicker()) is required to scan and remember ROM folders — use a Chromium-based browser
- IndexedDB is used to save settings and imported cover art
- The app uses fetch() to reach iiSU and Wikipedia for cover art lookups and the RetroAchievements API (optional — requires credentials)

## RetroAchievements
To enable RetroAchievements features (game lookup and progress polling) provide your RetroAchievements username and API key in Settings. The app will compute a ROM hash client-side and query the RetroAchievements API to find and poll progress for the running game.

## Development notes
- app.js contains the main app logic. Key areas:
  - scanDirectory / selectRomFolder: File scanning and ROM discovery
  - findGameCover / findCoverChoices: cover lookup using iiSU and Wikipedia
  - configureAchievements / raRequest: RetroAchievements integration
- emulator.js provides a minimal wrapper to initialize EmulatorJS (or use included cores found in `cores/`) and to manage auto-save + navigation UI
- index.html contains the UI markup and references to assets and scripts
- styles.css contains the theme system (light/dark/ocean/sunset/forest/rose)

If you want to test offline cores instead of the CDN loader, review emulator.js and the paths it sets (window.EJS_pathtodata and loader URL). The repo includes `.wasm` and `.js` glues in `cores/` for some platforms.

## Troubleshooting
- If folder selection does not work: ensure you're on a Chromium-based browser and not using file://
- If covers are missing: iiSU rate-limits or CORS may prevent direct requests; the app falls back to Wikipedia thumbnails
- If EmulatorJS fails to load: check your network, or adjust emulator.js to point to local cores instead of the CDN loader
- RetroAchievements errors: incorrect username/API key or the ROM hash may not match the RA database

## Contributing
Contributions are welcome. If you plan to add features:
- Keep UI strings consistent (the current UI is French)
- Update app.js consoleConfig if you add new ROM extensions or cores
- Add tests or usage examples for any new network integration (iiSU, RA)

## License
No license specified. Please add a LICENSE file if you want to grant reuse permissions (MIT, Apache-2.0, etc.).

## Credits
- EmulatorJS project for the in-browser emulator loader
- iiSU assets database for cover-art lookup
- RetroAchievements for achievement data


