document.addEventListener('DOMContentLoaded', () => {
    // Éléments du DOM
    const navButtons = document.querySelectorAll('.iisu-btn');
    const sections = document.querySelectorAll('.view-section');
    const themeSelect = document.getElementById('theme-selector');
    const scanBtnHome = document.getElementById('scan-btn-home');
    const scanBtnSettings = document.getElementById('scan-btn-settings');
    const folderStatus = document.getElementById('folder-status');

    // Mapping des extensions vers la console et les cœurs RetroArch de ton dossier
    const consoleConfig = {
        'nes': { name: 'NES', core: 'fceumm_libretro' },
        'smc': { name: 'SNES', core: 'snes9x_libretro' },
        'sfc': { name: 'SNES', core: 'snes9x_libretro' },
        'gbc': { name: 'GBC', core: 'gambatte_libretro' },
        'gb':  { name: 'GBC', core: 'gambatte_libretro' },
        'gba': { name: 'GBA', core: 'mgba_libretro' }
    };

    let scannedRoms = [];

    // --- NAVIGATION SPA ---
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');

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

    // --- GESTION DU THÈME ---
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            document.body.className = e.target.value;
        });
    }

    // --- FILE SYSTEM ACCESS API ---
    async function selectRomFolder() {
        if (!('showDirectoryPicker' in window)) {
            alert("Votre navigateur ne supporte pas l'API File System Access. Utilisez Chrome, Edge ou Opera.");
            return;
        }

        try {
            const dirHandle = await window.showDirectoryPicker();
            scannedRoms = [];
            
            if (folderStatus) {
                folderStatus.textContent = `Dossier actif : ${dirHandle.name}`;
            }

            await scanDirectory(dirHandle);

            renderHomeGrid();
            renderGamesList();
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("Erreur lors de l'accès au dossier :", err);
            }
        }
    }

    async function scanDirectory(dirHandle) {
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'directory') {
                await scanDirectory(entry);
            } else if (entry.kind === 'file') {
                const ext = entry.name.split('.').pop().toLowerCase();
                if (consoleConfig[ext]) {
                    const file = await entry.getFile();
                    scannedRoms.push({
                        name: entry.name.substring(0, entry.name.lastIndexOf('.')),
                        console: consoleConfig[ext].name,
                        coreName: consoleConfig[ext].core,
                        file: file
                    });
                }
            }
        }
    }

    // --- GRILLE D'ACCUEIL (2x3 DYNAMIQUE) ---
    function renderHomeGrid() {
        const grid = document.getElementById('home-grid');
        if (!grid) return;

        grid.innerHTML = '';

        if (scannedRoms.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <p>Aucune ROM compatible trouvée dans le dossier.</p>
                    <button id="scan-btn-home" class="action-btn">Sélectionner le dossier ROMS</button>
                </div>`;
            document.getElementById('scan-btn-home').addEventListener('click', selectRomFolder);
            return;
        }

        const featuredRoms = scannedRoms.slice(0, 6);
        featuredRoms.forEach(rom => {
            const tile = document.createElement('div');
            tile.className = 'game-tile';
            tile.innerHTML = `
                <span class="tile-console">${rom.console}</span>
                <span class="tile-title">${rom.name}</span>
            `;
            tile.addEventListener('click', () => launchGame(rom));
            grid.appendChild(tile);
        });
    }

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
                .map((rom, index) => `<li data-index="${index}">${rom.name}</li>`)
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

            container.appendChild(block);
        });
    }

    // --- LANCEMENT DE L'ÉMULATEUR ---
    async function launchGame(rom) {
        sections.forEach(sec => sec.classList.add('hidden'));
        document.getElementById('emulator-screen').classList.remove('hidden');

        try {
            const arrayBuffer = await rom.file.arrayBuffer();
            const romBytes = new Uint8Array(arrayBuffer);

            if (window.emulatorCore) {
                window.emulatorCore.start(rom.coreName, romBytes, rom.console);
            }
        } catch (error) {
            console.error("Erreur d'ouverture du fichier ROM :", error);
        }
    }

    // Attachement des événements de sélection
    if (scanBtnHome) scanBtnHome.addEventListener('click', selectRomFolder);
    if (scanBtnSettings) scanBtnSettings.addEventListener('click', selectRomFolder);
});