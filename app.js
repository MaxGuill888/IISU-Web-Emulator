document.addEventListener('DOMContentLoaded', () => {
    // Éléments du DOM
    const navButtons = document.querySelectorAll('.iisu-btn');
    const sections = document.querySelectorAll('.view-section');
    const themeSelect = document.getElementById('theme-selector');
    const scanBtnHome = document.getElementById('scan-btn-home');
    const scanBtnSettings = document.getElementById('scan-btn-settings');
    const folderStatus = document.getElementById('folder-status');
    const raUsernameInput = document.getElementById('ra-username');
    const raApiKeyInput = document.getElementById('ra-api-key');
    const raStatus = document.getElementById('ra-status');
    const emulatorVolume = document.getElementById('emulator-volume');
    const emulatorVolumeValue = document.getElementById('emulator-volume-value');
    const autoFullscreen = document.getElementById('auto-fullscreen');
    const autoStart = document.getElementById('auto-start');
    const showGameHud = document.getElementById('show-game-hud');
    const autoSave = document.getElementById('auto-save');
    const romPages = document.getElementById('rom-pages');
    const previousRomPage = document.getElementById('rom-page-prev');
    const nextRomPage = document.getElementById('rom-page-next');

    // Mapping des extensions vers la console et les cœurs RetroArch de ton dossier
    const consoleConfig = {
        'nes': { name: 'NES', core: 'fceumm_libretro', platformName: 'Nintendo Entertainment System' },
        'smc': { name: 'SNES', core: 'snes9x_libretro', platformName: 'Super Nintendo Entertainment System' },
        'sfc': { name: 'SNES', core: 'snes9x_libretro', platformName: 'Super Nintendo Entertainment System' },
        'gbc': { name: 'GBC', core: 'gambatte_libretro', platformName: 'Game Boy Color' },
        'gb':  { name: 'GBC', core: 'gambatte_libretro', platformName: 'Game Boy Color' },
        'gba': { name: 'GBA', core: 'mgba_libretro', platformName: 'Game Boy Advance' },
        'n64': { name: 'N64', core: 'n64wasm', platformName: 'Nintendo 64' },
        'z64': { name: 'N64', core: 'n64wasm', platformName: 'Nintendo 64' },
        'v64': { name: 'N64', core: 'n64wasm', platformName: 'Nintendo 64' }
    };

    const coverCache = new Map();
    const coverChoices = new Map();
    let pickerRom = null;
    let exitConfirmationResolver = null;
    let batteryManager = null;
    let activeRaPoll = null;
    let activeRaGameId = null;
    let cloudflareApi = null;
    let currentCloudflareUser = null;

    let scannedRoms = [];
    let romPage = 0;
    const romsPerPage = 8;
    const storageName = 'iisu-emulator-storage';
    const storageVersion = 5;
    const directoryStore = 'settings';
    const coverStore = 'covers';
    const romStore = 'roms';

    function openStorage() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(storageName, storageVersion);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(directoryStore)) db.createObjectStore(directoryStore);
                if (!db.objectStoreNames.contains(coverStore)) db.createObjectStore(coverStore);
                if (!db.objectStoreNames.contains(romStore)) db.createObjectStore(romStore);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function saveDirectoryHandle(dirHandle) {
        const db = await openStorage();
        await new Promise((resolve, reject) => {
            const request = db.transaction(directoryStore, 'readwrite')
                .objectStore(directoryStore)
                .put(dirHandle, 'rom-directory');
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
        });
        db.close();
    }

    async function loadDirectoryHandle() {
        const db = await openStorage();
        const dirHandle = await new Promise((resolve, reject) => {
            const request = db.transaction(directoryStore, 'readonly')
                .objectStore(directoryStore)
                .get('rom-directory');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        db.close();
        return dirHandle;
    }

    async function saveSetting(key, value) {
        const db = await openStorage();
        await new Promise((resolve, reject) => {
            const request = db.transaction(directoryStore, 'readwrite').objectStore(directoryStore).put(value, key);
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
        });
        db.close();
    }

    async function loadSetting(key) {
        const db = await openStorage();
        const value = await new Promise((resolve, reject) => {
            const request = db.transaction(directoryStore, 'readonly').objectStore(directoryStore).get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        db.close();
        return value;
    }

    async function saveCachedRom(rom, bytes) {
        const db = await openStorage();
        await new Promise((resolve, reject) => {
            const request = db.transaction(romStore, 'readwrite').objectStore(romStore).put({
                ...rom, file: undefined, bytes, favorite: Boolean(rom.favorite)
            }, rom.id);
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
        });
        db.close();
    }

    async function loadCachedRoms() {
        const db = await openStorage();
        const cached = await new Promise((resolve, reject) => {
            const request = db.transaction(romStore, 'readonly').objectStore(romStore).getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
        db.close();
        return cached.map(rom => ({ ...rom, file: null }));
    }

    async function toggleFavorite(rom) {
        rom.favorite = !rom.favorite;
        try {
            const cached = (await loadCachedRoms()).find(item => item.id === rom.id);
            if (cached) await saveCachedRom(rom, cached.bytes);
        } catch (error) {
            console.warn('Impossible de sauvegarder le favori :', error);
        }
        renderHomeGrid();
        renderGamesList();
    }

    async function loadEmulatorSettings() {
        try {
            const settings = await loadSetting('emulator-settings') || {};
            if (emulatorVolume) emulatorVolume.value = settings.volume ?? 80;
            if (autoFullscreen) autoFullscreen.checked = settings.autoFullscreen ?? true;
            if (autoStart) autoStart.checked = settings.autoStart ?? true;
            if (showGameHud) showGameHud.checked = settings.showHud ?? true;
            if (autoSave) autoSave.checked = settings.autoSave ?? true;
            updateVolumeLabel();
        } catch (error) {
            console.warn('Impossible de charger les options émulateur :', error);
        }
    }

    async function loadTheme() {
        try {
            const theme = await loadSetting('theme');
            if (!theme || !themeSelect) return;
            themeSelect.value = theme;
            document.body.classList.remove('theme-light', 'theme-dark', 'theme-ocean', 'theme-sunset', 'theme-forest', 'theme-rose');
            document.body.classList.add(theme);
        } catch (error) {
            console.warn('Impossible de charger le thème :', error);
        }
    }

    function updateVolumeLabel() {
        if (emulatorVolumeValue && emulatorVolume) emulatorVolumeValue.value = `${emulatorVolume.value}%`;
    }

    async function saveEmulatorSettings() {
        const settings = {
            volume: Number(emulatorVolume?.value ?? 80),
            autoFullscreen: autoFullscreen?.checked ?? true,
            autoStart: autoStart?.checked ?? true,
            showHud: showGameHud?.checked ?? true,
            autoSave: autoSave?.checked ?? true
        };
        try {
            await saveSetting('emulator-settings', settings);
            window.emulatorSettings = settings;
        } catch (error) {
            console.warn('Impossible de sauvegarder les options émulateur :', error);
        }
    }

    async function readSavedCover(key) {
        const db = await openStorage();
        const cover = await new Promise((resolve, reject) => {
            const request = db.transaction(coverStore, 'readonly').objectStore(coverStore).get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        db.close();
        return cover;
    }

    async function saveCover(key, blob) {
        const db = await openStorage();
        await new Promise((resolve, reject) => {
            const request = db.transaction(coverStore, 'readwrite').objectStore(coverStore).put(blob, key);
            request.onsuccess = resolve;
            request.onerror = () => reject(request.error);
        });
        db.close();
    }

    // --- NAVIGATION SPA ---
    navButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const targetId = btn.getAttribute('data-target');

            if (document.body.classList.contains('game-active')) {
                const confirmed = await requestGameExit();
                if (!confirmed) return;
                if (window.emulatorCore) window.emulatorCore.exit();
            } else if (window.emulatorCore) {
                window.emulatorCore.exit();
            }

            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            sections.forEach(sec => {
                if (sec.id === targetId) {
                    sec.classList.remove('hidden');
                } else {
                    sec.classList.add('hidden');
                }
            });
        });
    });

    function requestGameExit() {
        const dialog = document.getElementById('exit-confirmation');
        if (!dialog) return Promise.resolve(true);
        dialog.classList.remove('hidden');
        return new Promise(resolve => {
            exitConfirmationResolver = resolve;
        });
    }

    function resolveGameExit(confirmed) {
        document.getElementById('exit-confirmation')?.classList.add('hidden');
        if (exitConfirmationResolver) exitConfirmationResolver(confirmed);
        exitConfirmationResolver = null;
    }

    // --- GESTION DU THÈME ---
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            document.body.classList.remove('theme-light', 'theme-dark', 'theme-ocean', 'theme-sunset', 'theme-forest', 'theme-rose');
            document.body.classList.add(e.target.value);
            saveSetting('theme', e.target.value);
        });
    }

    emulatorVolume?.addEventListener('input', () => {
        updateVolumeLabel();
        saveEmulatorSettings();
    });
    [autoFullscreen, autoStart, showGameHud, autoSave].forEach(input => {
        input?.addEventListener('change', saveEmulatorSettings);
    });

    async function loadRetroAchievementsSettings() {
        try {
            const settings = await loadSetting('retro-achievements');
            if (settings) {
                if (raUsernameInput) raUsernameInput.value = settings.username || '';
                if (raApiKeyInput) raApiKeyInput.value = settings.apiKey || '';
                if (raStatus) raStatus.textContent = settings.username ? `Compte RA configuré : ${settings.username}` : 'RetroAchievements non configuré';
            }
        } catch (error) {
            console.warn('Impossible de charger la configuration RA :', error);
        }
    }

    // --- FILE SYSTEM ACCESS API ---
    async function selectRomFolder() {
        if (!('showDirectoryPicker' in window)) {
            alert("Votre navigateur ne supporte pas l'API File System Access. Utilisez Chrome, Edge ou Opera.");
            return;
        }

        try {
            const dirHandle = await window.showDirectoryPicker();
            if ('indexedDB' in window) {
                try {
                    await saveDirectoryHandle(dirHandle);
                } catch (storageError) {
                    console.warn('Impossible de mémoriser le dossier ROMs :', storageError);
                }
            }
            
            if (folderStatus) {
                folderStatus.textContent = `Dossier actif : ${dirHandle.name}`;
            }

            scannedRoms = [];
            await scanDirectory(dirHandle);

            renderHomeGrid();
            renderGamesList();
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("Erreur lors de l'accès au dossier :", err);
            }
        }
    }

    async function scanDirectory(dirHandle, relativePath = '') {
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'directory') {
                await scanDirectory(entry, `${relativePath}${entry.name}/`);
            } else if (entry.kind === 'file') {
                const ext = entry.name.split('.').pop().toLowerCase();
                if (consoleConfig[ext]) {
                    const file = await entry.getFile();
                    const romPath = `${relativePath}${entry.name}`;
                    const name = entry.name.substring(0, entry.name.lastIndexOf('.'));
                    scannedRoms.push({
                        name: name,
                        console: consoleConfig[ext].name,
                        coreName: consoleConfig[ext].core,
                        platformName: consoleConfig[ext].platformName || 'Nintendo Entertainment System',
                        id: romPath,
                        cover: `assets/borders/${consoleConfig[ext].name}.png`,
                        file: file,
                        favorite: Boolean((await loadCachedRoms()).find(cached => cached.id === romPath)?.favorite)
                    });
                    await saveCachedRom(scannedRoms[scannedRoms.length - 1], new Uint8Array(await file.arrayBuffer()));
                }
            }
        }
    }

    function getRaCredentials() {
        return {
            username: raUsernameInput?.value.trim(),
            apiKey: raApiKeyInput?.value.trim()
        };
    }

    async function hashRom(romBytes) {
        const table = Array.from({ length: 64 }, (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 2 ** 32));
        const shifts = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
        const bytes = Array.from(romBytes);
        const bitLength = bytes.length * 8;
        bytes.push(128);
        while (bytes.length % 64 !== 56) bytes.push(0);
        for (let index = 0; index < 8; index++) bytes.push((bitLength / 2 ** (8 * index)) & 255);
        let a0 = 0x67452301; let b0 = 0xefcdab89; let c0 = 0x98badcfe; let d0 = 0x10325476;
        const leftRotate = (value, amount) => (value << amount) | (value >>> (32 - amount));
        for (let offset = 0; offset < bytes.length; offset += 64) {
            const words = Array.from({ length: 16 }, (_, index) => bytes.slice(offset + index * 4, offset + index * 4 + 4)
                .reduce((value, byte, shift) => value | (byte << (shift * 8)), 0));
            let a = a0; let b = b0; let c = c0; let d = d0;
            for (let index = 0; index < 64; index++) {
                let f; let g;
                if (index < 16) { f = (b & c) | (~b & d); g = index; }
                else if (index < 32) { f = (d & b) | (~d & c); g = (5 * index + 1) % 16; }
                else if (index < 48) { f = b ^ c ^ d; g = (3 * index + 5) % 16; }
                else { f = c ^ (b | ~d); g = (7 * index) % 16; }
                const next = d;
                d = c; c = b;
                const shift = shifts[Math.floor(index / 16) * 4 + index % 4];
                b = (b + leftRotate((a + f + table[index] + words[g]) | 0, shift)) | 0;
                a = next;
            }
            a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0;
        }
        return [a0, b0, c0, d0].map(value => Array.from({ length: 4 }, (_, index) => (value >>> (index * 8)) & 255)
            .map(byte => byte.toString(16).padStart(2, '0')).join('')).join('');
    }

    async function raRequest(endpoint, params) {
        const response = await fetch(`https://retroachievements.org/API/${endpoint}?${new URLSearchParams(params)}`);
        if (!response.ok) throw new Error(`RetroAchievements HTTP ${response.status}`);
        const data = await response.json();
        if (data.Error) throw new Error(data.Error);
        return data;
    }

    async function updateAchievements(gameId) {
        const credentials = getRaCredentials();
        const achievementsButton = document.getElementById('achievements-button');
        if (!credentials.username || !credentials.apiKey || !gameId) return;

        try {
            const data = await raRequest('API_GetGameInfoAndUserProgress.php', {
                z: credentials.username,
                y: credentials.apiKey,
                g: gameId
            });
            const achievements = Object.values(data.Achievements || {});
            const earned = achievements.filter(achievement => achievement.DateEarned).length;
            if (achievementsButton) achievementsButton.innerHTML = `<span>Succès</span><strong>${earned} / ${achievements.length}</strong>`;
            const panel = document.getElementById('achievements-panel');
            if (panel) panel.innerHTML = `<strong>${data.Title || 'Succès'}</strong><p>${earned} succès débloqué(s) sur ${achievements.length}.</p><ul class="achievement-list">${achievements.map(achievement => `<li class="${achievement.DateEarned ? 'earned' : ''}"><span>${achievement.Title}</span><small>${achievement.DateEarned ? `Obtenu le ${new Date(achievement.DateEarned).toLocaleDateString('fr-FR')}` : 'À débloquer'}</small></li>`).join('')}</ul>`;
            await saveSetting(`achievements-${gameId}`, { title: data.Title, achievements, earned });
            renderAchievementsPage(data.Title, achievements, earned);
        } catch (error) {
            const saved = await loadSetting(`achievements-${gameId}`).catch(() => null);
            if (saved) renderAchievementsPage(saved.title, saved.achievements, saved.earned);
            if (raStatus) raStatus.textContent = 'Impossible de récupérer les succès RA.';
        }
    }

    function renderAchievementsPage(title, achievements, earned) {
        const content = document.querySelector('#page-trophies .trophy-content');
        if (!content) return;
        content.innerHTML = `<h3>${title || 'Succès'}</h3><p>${earned} succès débloqué(s) sur ${achievements.length}.</p><ul class="achievement-page-list">${achievements.map(achievement => `<li class="${achievement.DateEarned ? 'earned' : ''}"><strong>${achievement.Title}</strong><span>${achievement.Description || ''}</span><small>${achievement.DateEarned ? `Obtenu le ${new Date(achievement.DateEarned).toLocaleString('fr-FR')}` : 'Non obtenu'}</small></li>`).join('')}</ul>`;
    }

    async function configureAchievements(rom, romBytes) {
        const credentials = getRaCredentials();
        if (!credentials.username || !credentials.apiKey) return;

        try {
            const hash = await hashRom(romBytes);
            if (!hash) throw new Error('Hash MD5 indisponible');
            const data = await raRequest('API_GetGameID.php', {
                z: credentials.username,
                y: credentials.apiKey,
                m: hash
            });
            activeRaGameId = data.GameID || data.ID || data;
            if (!activeRaGameId) throw new Error('Jeu absent de RetroAchievements');
            await updateAchievements(activeRaGameId);
            clearInterval(activeRaPoll);
            activeRaPoll = setInterval(() => updateAchievements(activeRaGameId), 15000);
        } catch (error) {
            activeRaGameId = null;
            if (raStatus) raStatus.textContent = 'Jeu non reconnu par RetroAchievements ou identifiants invalides.';
        }
    }

    function stopAchievementPolling() {
        clearInterval(activeRaPoll);
        activeRaPoll = null;
        activeRaGameId = null;
    }

    async function restoreSavedFolder() {
        if (!('indexedDB' in window)) return;

        try {
            const dirHandle = await loadDirectoryHandle();
            if (!dirHandle) {
                scannedRoms = await loadCachedRoms();
                renderHomeGrid();
                renderGamesList();
                return;
            }

            const permission = await dirHandle.queryPermission({ mode: 'read' });
            if (permission !== 'granted') {
                if (folderStatus) {
                    folderStatus.textContent = `Dossier mémorisé : ${dirHandle.name}. Cliquez pour réautoriser l'accès.`;
                }
                scannedRoms = await loadCachedRoms();
                renderHomeGrid();
                renderGamesList();
                return;
            }

                                stopAchievementPolling();
            scannedRoms = [];
            await scanDirectory(dirHandle);
            if (folderStatus) folderStatus.textContent = `Dossier actif : ${dirHandle.name}`;
            renderHomeGrid();
            renderGamesList();
        } catch (error) {
            console.warn('Impossible de restaurer le dossier ROMs :', error);
        }
    }

    function consoleBorder(consoleName) {
        return `assets/borders/${consoleName}.png`;
    }

    function coverKey(rom) {
        return encodeURIComponent(rom.id);
    }

    function normalizeTitle(title) {
        return title
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function romTitle(fileName) {
        return fileName
            .replace(/\.[^.]+$/, '')
            .replace(/\([^)]*\)/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    async function findGameCover(rom) {
        if (coverCache.has(rom.name)) return coverCache.get(rom.name);

        const fallback = `assets/borders/${rom.console}.png`;
        const searchName = romTitle(rom.name)
            .replace(/,\s*The\s*-/i, ' ')
            .replace(/^Legend of Zelda\s+The\s+/i, 'The Legend of Zelda ');

        try {
            if ('indexedDB' in window) {
                const savedCover = await readSavedCover(rom.id);
                if (savedCover) {
                    const savedUrl = URL.createObjectURL(savedCover);
                    coverCache.set(rom.name, savedUrl);
                    return savedUrl;
                }
            }

            const choices = await findCoverChoices(rom);
            const cover = choices[0]?.url;
            if (!cover) throw new Error('Aucune boîte trouvée');
            coverCache.set(rom.name, cover);
            return cover;
        } catch (error) {
            coverCache.set(rom.name, fallback);
            return fallback;
        }
    }

    async function findCoverChoices(rom) {
        const searchName = romTitle(rom.name)
            .replace(/,\s*The\s*-/i, ' ')
            .replace(/^Legend of Zelda\s+The\s+/i, 'The Legend of Zelda ');
        const searchParams = new URLSearchParams({
            q: searchName,
            skip: '0',
            limit: '20',
            assets_only: 'true'
        });
        let choices = [];
        try {
            const response = await fetch(`https://iidb-api.iisu.network/api/v1/parents/search/enriched?${searchParams}`);
            const results = await response.json();
            choices = results
                .filter(result => result.boxart_filename)
                .map(result => ({
                    name: result.name,
                    platform: result.primary_platform,
                    source: 'iiSU Database',
                    url: `https://assets.iisu.network/${result.boxart_filename}`
                }));
        } catch (error) {
            console.warn('iiSU inaccessible depuis le navigateur, fallback Wikipédia.', error);
        }

        if (!choices.length) {
            const wikiParams = new URLSearchParams({
                action: 'query',
                generator: 'search',
                gsrsearch: `${searchName} video game`,
                gsrnamespace: '0',
                gsrlimit: '5',
                prop: 'pageimages',
                piprop: 'thumbnail|original',
                pithumbsize: '800',
                format: 'json',
                origin: '*'
            });
            const wikiResponse = await fetch(`https://en.wikipedia.org/w/api.php?${wikiParams}`);
            const wikiData = await wikiResponse.json();
            const normalizedSearch = normalizeTitle(searchName);
            const searchWords = new Set(normalizedSearch.split(' '));
            const wikiPages = await Promise.all(Object.values(wikiData.query?.pages || {}).map(async page => {
                try {
                    const summaryResponse = await fetch(
                        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title.replace(/ /g, '_'))}`
                    );
                    const summary = await summaryResponse.json();
                    const url = summary.originalimage?.source || summary.thumbnail?.source;
                    if (!url) return null;
                    const title = normalizeTitle(page.title);
                    const matchingWords = title.split(' ').filter(word => searchWords.has(word)).length;
                    return { name: page.title, platform: 'Wikipédia', source: 'Wikipédia', url, score: matchingWords + (title === normalizedSearch ? 100 : 0) };
                } catch (error) {
                    return null;
                }
            }));
            choices = wikiPages.filter(Boolean).sort((first, second) => second.score - first.score);
        }
        coverChoices.set(rom.id, choices);
        return choices;
    }

    async function openCoverPicker(rom) {
        const picker = document.getElementById('cover-picker');
        const grid = document.getElementById('cover-picker-grid');
        const status = document.getElementById('cover-picker-status');
        if (!picker || !grid || !status) return;

        pickerRom = rom;
        picker.classList.remove('hidden');
        grid.innerHTML = '';
        status.textContent = 'Recherche des box arts iiSU...';
        try {
            const choices = coverChoices.get(rom.id) || await findCoverChoices(rom);
            grid.innerHTML = choices.map((choice, index) => `
                <button class="cover-choice" type="button" data-cover-index="${index}">
                    <img src="${choice.url}" alt="">
                    <span>${choice.name}</span>
                    <small>${choice.source || choice.platform || 'Source inconnue'}</small>
                </button>`).join('');
            status.textContent = choices.length ? 'Sélectionnez une box art.' : 'Aucune box art trouvée pour ce jeu.';
            grid.querySelectorAll('[data-cover-index]').forEach(button => {
                button.addEventListener('click', () => {
                    const choice = choices[button.dataset.coverIndex];
                    rom.cover = choice.url;
                    coverCache.set(rom.name, choice.url);
                    updateCoverImages(rom, choice.url);
                    picker.classList.add('hidden');
                });
            });
        } catch (error) {
            status.textContent = 'Impossible de charger les box arts iiSU.';
        }
    }

    function updateCoverImages(rom, cover) {
        document.querySelectorAll(`[data-rom-key="${coverKey(rom)}"]`).forEach(image => {
            image.src = cover;
        });
    }

    function resolveCovers() {
        scannedRoms.forEach(async rom => {
            const cover = await findGameCover(rom);
            updateCoverImages(rom, cover);
        });
    }

    function updateGameClock() {
        const clock = document.getElementById('game-clock');
        if (clock) clock.textContent = new Intl.DateTimeFormat('fr-FR', {
            hour: '2-digit', minute: '2-digit'
        }).format(new Date());
    }

    function cloudflareConfigured() {
        return Boolean(window.IISU_CLOUDFLARE_CONFIG?.apiBase);
    }

    function renderOnlineFriends(presenceState) {
        const friends = Object.values(presenceState || {}).flat().filter(friend => friend.user_id !== currentCloudflareUser?.id);
        const count = document.getElementById('online-friends-count');
        const content = document.getElementById('friends-panel-content');
        if (count) count.textContent = String(friends.length);
        if (content) content.innerHTML = friends.length ? friends.map(friend => `<span class="online-friend"><strong>${friend.username || 'Ami'}</strong><small>${friend.romName ? ` joue a ${friend.romName}` : ' en ligne'}</small></span>`).join('') : 'Aucun ami connecte pour le moment.';
    }

    async function cloudflareRequest(path, options = {}) {
        const headers = { 'content-type': 'application/json', ...(options.headers || {}) };
        const sessionToken = localStorage.getItem('iisu-cloudflare-session');
        if (sessionToken) headers.authorization = `Bearer ${sessionToken}`;
        const response = await fetch(`${cloudflareApi}${path}`, { ...options, headers });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Cloudflare HTTP ${response.status}`);
        return data;
    }

    async function setupCloudflare() {
        if (!cloudflareConfigured()) return;
        cloudflareApi = window.IISU_CLOUDFLARE_CONFIG.apiBase;
        try {
            const data = await cloudflareRequest('/me');
            currentCloudflareUser = data.user;
        } catch (error) {
            localStorage.removeItem('iisu-cloudflare-session');
        }
        updateProfileUi();
    }

    function updateProfileUi() {
        const status = document.getElementById('profile-status');
        const form = document.getElementById('profile-auth-form');
        const friendForm = document.getElementById('friend-search-form');
        if (currentCloudflareUser) {
            if (status) status.textContent = `Connecté : ${currentCloudflareUser.email}`;
            form?.classList.add('hidden');
            friendForm?.classList.remove('hidden');
        } else {
            if (status) status.textContent = 'Connectez-vous ou créez un compte Cloudflare.';
            form?.classList.remove('hidden');
            friendForm?.classList.add('hidden');
        }
    }

    async function searchFriends(username) {
        const results = document.getElementById('friend-search-results');
        if (!results || !cloudflareApi || !currentCloudflareUser) return;
        results.textContent = 'Recherche...';
        let data;
        try { data = (await cloudflareRequest(`/users?username=${encodeURIComponent(username)}`)).users; } catch (error) {
            results.textContent = `Recherche impossible : ${error.message}`;
            return;
        }
        results.innerHTML = data.length ? data.map(profile => `<div class="friend-result"><strong>${profile.username}</strong><button type="button" data-friend-id="${profile.id}">Ajouter</button></div>`).join('') : 'Aucun utilisateur trouvé.';
        results.querySelectorAll('[data-friend-id]').forEach(button => button.addEventListener('click', async () => {
            button.disabled = true;
            try {
                await cloudflareRequest('/friends', { method: 'POST', body: JSON.stringify({ friendId: button.dataset.friendId }) });
                button.textContent = 'Ami ajouté';
            } catch (error) {
                button.textContent = 'Erreur';
            }
        }));
    }

    async function startPresence() {
        renderOnlineFriends({});
    }

    async function updatePresenceRom(romName) {
        return romName;
    }

    async function updateBattery() {
        const battery = document.getElementById('game-battery');
        if (!battery) return;
        if (!navigator.getBattery) {
            battery.textContent = 'Batterie indisponible';
            return;
        }
        batteryManager = batteryManager || await navigator.getBattery();
        const charging = batteryManager.charging ? ' + ' : '';
        battery.textContent = `Batterie ${Math.round(batteryManager.level * 100)}%${charging}`;
    }

    function setupGameHeader() {
        updateGameClock();
        updateBattery();
        setInterval(updateGameClock, 30000);
        if (navigator.getBattery) {
            navigator.getBattery().then(manager => {
                batteryManager = manager;
                manager.addEventListener('levelchange', updateBattery);
                manager.addEventListener('chargingchange', updateBattery);
            }).catch(() => {});
        }
    }

    document.getElementById('online-friends-button')?.addEventListener('click', event => {
        const panel = document.getElementById('friends-panel');
        const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
        event.currentTarget.setAttribute('aria-expanded', String(!expanded));
        panel?.classList.toggle('hidden', expanded);
    });

    document.getElementById('achievements-button')?.addEventListener('click', event => {
        const panel = document.getElementById('achievements-panel');
        const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
        event.currentTarget.setAttribute('aria-expanded', String(!expanded));
        panel?.classList.toggle('hidden', expanded);
    });

    document.getElementById('profile-button')?.addEventListener('click', event => {
        const panel = document.getElementById('profile-panel');
        const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
        event.currentTarget.setAttribute('aria-expanded', String(!expanded));
        panel?.classList.toggle('hidden', expanded);
    });

    document.getElementById('profile-auth-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const panel = document.getElementById('profile-panel');
        if (!cloudflareApi) {
            document.getElementById('profile-status').textContent = 'Configurez cloudflare-config.js puis rechargez la page.';
            return;
        }
        const username = document.getElementById('profile-username').value.trim();
        const email = document.getElementById('profile-email').value.trim();
        const password = document.getElementById('profile-password').value;
        try {
            const data = await cloudflareRequest('/signup', { method: 'POST', body: JSON.stringify({ username, email, password }) });
            localStorage.setItem('iisu-cloudflare-session', data.token);
            currentCloudflareUser = data.user;
            updateProfileUi();
        } catch (error) {
            document.getElementById('profile-status').textContent = `Inscription impossible : ${error.message}`;
            return;
        }
        if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    });

    document.getElementById('profile-sign-in')?.addEventListener('click', async () => {
        const panel = document.getElementById('profile-panel');
        if (!cloudflareApi) {
            document.getElementById('profile-status').textContent = 'Configurez cloudflare-config.js puis rechargez la page.';
            return;
        }
        const email = document.getElementById('profile-email').value.trim();
        const password = document.getElementById('profile-password').value;
        if (!email || !password) {
            document.getElementById('profile-status').textContent = 'Renseignez votre email et votre mot de passe.';
            return;
        }
        try {
            const data = await cloudflareRequest('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
            localStorage.setItem('iisu-cloudflare-session', data.token);
            currentCloudflareUser = data.user;
            document.getElementById('profile-status').textContent = `Connecté : ${email}`;
            updateProfileUi();
                if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
        } catch (error) {
            document.getElementById('profile-status').textContent = `Connexion impossible : ${error.message}`;
        }
    });

    document.getElementById('friend-search-form')?.addEventListener('submit', event => {
        event.preventDefault();
        searchFriends(document.getElementById('friend-search-input').value.trim());
    });

    document.getElementById('game-battery')?.addEventListener('click', updateBattery);
    document.getElementById('ra-save-settings')?.addEventListener('click', async () => {
        const credentials = getRaCredentials();
        if (!credentials.username || !credentials.apiKey) {
            if (raStatus) raStatus.textContent = 'Renseignez votre nom et votre clé API RA.';
            return;
        }
        try {
            await saveSetting('retro-achievements', credentials);
            if (raStatus) raStatus.textContent = `Compte RA configuré : ${credentials.username}`;
        } catch (error) {
            if (raStatus) raStatus.textContent = 'Impossible de sauvegarder la configuration RA.';
        }
    });
    document.getElementById('exit-confirmation-cancel')?.addEventListener('click', () => resolveGameExit(false));
    document.getElementById('exit-confirmation-accept')?.addEventListener('click', () => resolveGameExit(true));
    // --- GRILLE D'ACCUEIL (2x3 DYNAMIQUE) ---
    function renderHomeGrid() {
        const grid = document.getElementById('home-grid');
        if (!grid) return;

        grid.innerHTML = '';

        grid.innerHTML = '';
        const pageCount = Math.max(1, Math.ceil(scannedRoms.length / romsPerPage));
        romPage = Math.min(romPage, pageCount - 1);
        const pageStart = romPage * romsPerPage;
        const pageRoms = scannedRoms.slice(pageStart, pageStart + romsPerPage);

        pageRoms.forEach(rom => {
            const tile = document.createElement('div');
            tile.setAttribute('role', 'button');
            tile.tabIndex = 0;
            tile.className = 'game-tile rom-slot';
            tile.innerHTML = `
                <div class="game-tile-image">
                    <img class="game-cover" data-rom-key="${coverKey(rom)}" src="${rom.cover}" alt="Boîte de ${rom.name}">
                    <img class="game-border" src="${consoleBorder(rom.console)}" alt="">
                    <span class="favorite-mark" aria-hidden="true">${rom.favorite ? '★' : '☆'}</span>
                    <span class="tile-title">${rom.name}</span>
                </div>
            `;
            tile.addEventListener('click', () => launchGame(rom));
            tile.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    launchGame(rom);
                }
            });
            const favoriteButton = document.createElement('button');
            favoriteButton.type = 'button';
            favoriteButton.className = `favorite-button${rom.favorite ? ' is-favorite' : ''}`;
            favoriteButton.textContent = rom.favorite ? '★' : '☆';
            favoriteButton.title = rom.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris';
            favoriteButton.setAttribute('aria-label', favoriteButton.title);
            favoriteButton.addEventListener('click', event => {
                event.stopPropagation();
                toggleFavorite(rom);
            });
            tile.appendChild(favoriteButton);
            tile.addEventListener('mouseenter', () => showHoveredGameName(rom.name));
            tile.addEventListener('mouseleave', clearHoveredGameName);
            tile.addEventListener('focus', () => showHoveredGameName(rom.name));
            tile.addEventListener('blur', clearHoveredGameName);
            grid.appendChild(tile);
        });
        addEmptyRomSlots(grid, romsPerPage - pageRoms.length);
        updateRomPageControls(pageCount);
    }

    function updateRomPageControls(pageCount) {
        const hasPrevious = romPage > 0;
        const hasNext = romPage < pageCount - 1;
        [previousRomPage, nextRomPage].forEach(button => {
            if (!button) return;
            button.disabled = button === previousRomPage ? !hasPrevious : !hasNext;
            button.setAttribute('aria-hidden', String(button.disabled));
        });
    }

    function showHoveredGameName(name) {
        const title = document.getElementById('active-game-title');
        if (title) title.textContent = name;
    }

    function clearHoveredGameName() {
        const title = document.getElementById('active-game-title');
        if (title && !document.body.classList.contains('game-active')) {
            title.textContent = 'Aucun jeu sélectionné';
        }
    }

    function addEmptyRomSlots(grid, count) {
        for (let index = 0; index < count; index++) {
            const slot = document.createElement('button');
            slot.type = 'button';
            slot.className = 'rom-slot empty-slot';
            slot.innerHTML = '<span class="rom-slot-plus">+</span><span>Ajouter une ROM</span>';
            slot.addEventListener('click', selectRomFolder);
            grid.appendChild(slot);
        }
    }

    function showRomPageArrow(button) {
        if (button && !button.disabled) button.classList.add('is-visible');
    }

    function hideRomPageArrows() {
        [previousRomPage, nextRomPage].forEach(button => button?.classList.remove('is-visible'));
    }

    previousRomPage?.addEventListener('click', () => {
        if (romPage === 0) return;
        romPage -= 1;
        renderHomeGrid();
    });

    nextRomPage?.addEventListener('click', () => {
        const pageCount = Math.max(1, Math.ceil(scannedRoms.length / romsPerPage));
        if (romPage >= pageCount - 1) return;
        romPage += 1;
        renderHomeGrid();
    });

    romPages?.addEventListener('mousemove', event => {
        const bounds = romPages.getBoundingClientRect();
        const distanceFromLeft = event.clientX - bounds.left;
        const distanceFromRight = bounds.right - event.clientX;
        if (distanceFromLeft <= 270) showRomPageArrow(previousRomPage);
        if (distanceFromRight <= 270) showRomPageArrow(nextRomPage);
        if (distanceFromLeft > 300 && distanceFromRight > 300) hideRomPageArrows();
    });

    romPages?.addEventListener('mouseleave', hideRomPageArrows);

    // --- LISTE DES JEUX PAR CONSOLE ---
    function renderGamesList() {
        const container = document.getElementById('console-categories');
        if (!container) return;

        container.innerHTML = '';

        if (scannedRoms.length === 0) {
            container.innerHTML = `<p class="empty-state-text">Aucun jeu trouvé. Choisissez votre dossier dans l'accueil ou les paramètres.</p>`;
            return;
        }

        const grouped = {};
        scannedRoms.forEach(rom => {
            if (!grouped[rom.console]) grouped[rom.console] = [];
            grouped[rom.console].push(rom);
        });

        Object.keys(grouped).sort().forEach(consoleName => {
            const block = document.createElement('div');
            block.className = 'console-block';

            const listItems = grouped[consoleName]
                .map((rom, index) => `
                    <li data-index="${index}">
                        <img class="game-list-image" data-rom-key="${coverKey(rom)}" src="${rom.cover}" alt="">
                        <span>${rom.name}</span>
                        <button class="favorite-button${rom.favorite ? ' is-favorite' : ''}" type="button" aria-label="${rom.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${rom.favorite ? '★' : '☆'}</button>
                        <button class="cover-settings" type="button" data-rom-index="${index}" aria-label="Choisir la box art">
                            <img src="assets/icons/settings.png" alt="">
                        </button>
                    </li>`)
                .join('');

            block.innerHTML = `
                <h3>${consoleName}</h3>
                <ul>${listItems}</ul>
            `;

            block.querySelectorAll('li').forEach(li => {
                li.addEventListener('click', () => {
                    const romIndex = li.getAttribute('data-index');
                    launchGame(grouped[consoleName][romIndex]);
                });
            });

            block.querySelectorAll('.cover-settings').forEach(button => {
                button.addEventListener('click', event => {
                    event.stopPropagation();
                    openCoverPicker(grouped[consoleName][button.dataset.romIndex]);
                });
            });
            block.querySelectorAll('.favorite-button').forEach((button, index) => {
                button.addEventListener('click', event => {
                    event.stopPropagation();
                    toggleFavorite(grouped[consoleName][index]);
                });
            });

            container.appendChild(block);
        });
        resolveCovers();
    }

    // --- LANCEMENT DE L'ÉMULATEUR ---
    async function launchGame(rom) {
        sections.forEach(sec => sec.classList.add('hidden'));
        document.getElementById('emulator-screen').classList.remove('hidden');
        const activeGameTitle = document.getElementById('active-game-title');
        if (activeGameTitle) activeGameTitle.textContent = rom.name;

        if ((window.emulatorSettings?.autoFullscreen ?? true) && document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
        }

        try {
            const romBytes = rom.file ? new Uint8Array(await rom.file.arrayBuffer()) : new Uint8Array(rom.bytes);

            if (window.emulatorCore) {
                window.emulatorCore.start(rom.coreName, romBytes, rom.console, rom.id);
            }
            updatePresenceRom(rom.name);
            configureAchievements(rom, romBytes);
        } catch (error) {
            console.error("Erreur d'ouverture du fichier ROM :", error);
        }
    }

    // Attachement des événements de sélection
    if (scanBtnHome) scanBtnHome.addEventListener('click', selectRomFolder);
    if (scanBtnSettings) scanBtnSettings.addEventListener('click', selectRomFolder);
    document.getElementById('cover-picker-close')?.addEventListener('click', () => {
        document.getElementById('cover-picker')?.classList.add('hidden');
    });
    document.getElementById('cover-upload-input')?.addEventListener('change', async event => {
        const file = event.target.files?.[0];
        if (!file || !pickerRom) return;
        const cover = URL.createObjectURL(file);
        pickerRom.cover = cover;
        coverCache.set(pickerRom.name, cover);
        updateCoverImages(pickerRom, cover);
        if ('indexedDB' in window) {
            try {
                await saveCover(pickerRom.id, file);
            } catch (error) {
                console.warn('Impossible de mémoriser la box art importée :', error);
            }
        }
        document.getElementById('cover-picker')?.classList.add('hidden');
        event.target.value = '';
    });
    setupGameHeader();
    setupCloudflare();
    loadEmulatorSettings();
    loadTheme();
    loadRetroAchievementsSettings();
    restoreSavedFolder();
});
