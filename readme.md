# iisu Web Emulator UI

A lightweight, browser-based front-end for running console ROMs with EmulatorJS and optional RetroAchievements integration. Designed as a static web UI (French-language interface) that scans a local ROM directory, fetches cover art, and launches games using EmulatorJS loaded from a CDN.

## Key features
- Browse ROMs in a 2xN grid and a console-sorted list
- Uses the File System Access API to select and remember a ROM folder
- IndexedDB storage for settings, chosen ROM folder handle and imported covers
- Automatic cover-art lookup from the iiSU database with a Wikipedia fallback
- RetroAchievements support (username + API key) with periodic polling for achievement progress
- Emulator integration via EmulatorJS (loader pulled from CDN)
- Several UI themes and emulator settings (volume, auto fullscreen, auto-save, auto-start)
- Service worker for offline support

## Supported ROM types (detected by extension)
- NES: .nes
- SNES: .sfc, .smc
- Game Boy / Game Boy Color: .gb, .gbc
- Game Boy Advance: .gba

(See the in-code console mapping in app.js for exact behavior.)

## Stack
- Languages: HTML, CSS, JavaScript
- Runtime: Static web app (served over HTTP/HTTPS or localhost)
- Notable third-party:
  - EmulatorJS (loader from https://cdn.emulatorjs.org)
  - iiSU assets API for cover art
  - RetroAchievements.org API for achievements

## Repository layout (top-level)
