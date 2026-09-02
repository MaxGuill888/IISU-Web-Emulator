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
- Favoris et cache local des octets ROM pour relancer les jeux hors ligne
- Comptes et amis via Cloudflare Workers + D1, sans confirmation email

## Supported ROM types (detected by extension)
- NES: .nes
- SNES: .sfc, .smc
- Game Boy / Game Boy Color: .gb, .gbc
- Game Boy Advance: .gba
- Nintendo 64: .n64, .z64, .v64

(See the in-code console mapping in app.js for exact behavior.)

## Cloudflare: comptes et amis

1. Installez Wrangler : `npm install -g wrangler`, puis connectez-vous avec `wrangler login`.
2. Creez la base : `wrangler d1 create iisu-emulator`, puis copiez son `database_id` dans `wrangler.toml`.
3. Initialisez les tables : `wrangler d1 execute iisu-emulator --remote --file=schema.sql`.
4. Deployez avec `wrangler deploy`. Dans Cloudflare Pages, utilisez le meme projet Workers/Assets ou configurez le Worker comme fonction `/api/*`.
5. Dans **Workers & Pages > Settings > Variables and Secrets**, ajoutez `AUTH_SECRET` comme secret aleatoire long. L'interface utilise `cloudflare-config.js` avec `apiBase: '/api'`. Aucun secret n'est mis dans le navigateur : les mots de passe sont haches dans le Worker et les sessions sont signees par le Worker.
6. Important pour eviter HTTP 405 : le domaine ouvert dans le navigateur doit etre celui qui sert le Worker avec **Assets > run worker first** sur `/api/*`. Si Pages sert seulement les fichiers statiques, configurez une route Worker `/api/*` ou mettez l'URL Worker complete dans `cloudflare-config.js`.

L'inscription est immediate et ne demande aucune confirmation email. Les comptes, la recherche par username et les amis sont geres dans le panneau Profil. La presence temps reel necessite ensuite un Durable Object ou un service WebSocket Cloudflare; le Worker fourni gere deja les comptes et les relations D1.

## Stack
- Languages: HTML, CSS, JavaScript
- Runtime: Static web app (served over HTTP/HTTPS or localhost)
- Notable third-party:
  - EmulatorJS (loader from https://cdn.emulatorjs.org)
  - iiSU assets API for cover art
  - RetroAchievements.org API for achievements

## Repository layout (top-level)
