window.emulatorCore = {
    romUrl: null,
    navigationTimer: null,
    activityListenerAttached: false,
    autoSaveTimer: null,

    start: function(coreName, romBytes, consoleType, gameId) {
        const canvasContainer = document.getElementById('canvas-container');
        if (!canvasContainer) return;

        document.body.classList.add('game-active');
        document.body.classList.toggle('hud-disabled', window.emulatorSettings?.showHud === false);
        if (!this.activityListenerAttached) {
            document.addEventListener('mousemove', () => this.showNavigation());
            this.activityListenerAttached = true;
        }

        canvasContainer.innerHTML = '<div id="game-player"></div>';

        if (this.romUrl) URL.revokeObjectURL(this.romUrl);
        const romBlob = new Blob([romBytes], { type: 'application/octet-stream' });
        this.romUrl = URL.createObjectURL(romBlob);

        // Map des consoles vers les identifiants d'EmulatorJS
        const systemMap = {
            'NES': 'nes',
            'SNES': 'snes',
            'GBC': 'gbc',
            'GBA': 'gba',
            'N64': 'n64'
        };

        window.EJS_player = '#game-player';
        window.EJS_gameUrl = this.romUrl;
        window.EJS_gameID = gameId || `${consoleType}-${coreName}`;
        window.EJS_core = consoleType === 'N64' ? (coreName || systemMap[consoleType]) : (systemMap[consoleType] || 'gba');
        window.EJS_pathtodata = consoleType === 'N64' ? './cores/' : 'https://cdn.emulatorjs.org/stable/data/';
        const settings = window.emulatorSettings || {};
        window.EJS_startOnLoaded = settings.autoStart !== false;
        window.EJS_volume = settings.volume ?? 80;
        window.EJS_Buttons = [];

        const previousLoader = document.querySelector('script[data-emulatorjs-loader]');
        if (previousLoader) previousLoader.remove();

        const script = document.createElement('script');
        script.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
        script.dataset.emulatorjsLoader = 'true';
        document.body.appendChild(script);

        clearInterval(this.autoSaveTimer);
        if (window.emulatorSettings?.autoSave !== false) {
            this.autoSaveTimer = setInterval(() => {
                if (window.EJS_emulator && typeof window.EJS_emulator.saveState === 'function') {
                    window.EJS_emulator.saveState();
                }
            }, 60000);
        }
    },

    showNavigation: function() {
        if (!document.body.classList.contains('game-active')) return;

        document.body.classList.add('navigation-visible');
        clearTimeout(this.navigationTimer);
        this.navigationTimer = setTimeout(() => {
            document.body.classList.remove('navigation-visible');
        }, 2500);
    },

    handleAction: function(action) {
        const emulator = window.EJS_emulator;
        if (!emulator) return;
        if (action === 'pause' && typeof emulator.pause === 'function') emulator.pause();
        if (action === 'save' && typeof emulator.saveState === 'function') emulator.saveState();
        if (action === 'load' && typeof emulator.loadState === 'function') emulator.loadState();
        if (action === 'fullscreen' && typeof emulator.toggleFullscreen === 'function') emulator.toggleFullscreen();
    },

    exit: function() {
        clearTimeout(this.navigationTimer);
        clearInterval(this.autoSaveTimer);
        document.body.classList.remove('game-active', 'navigation-visible');
        document.body.classList.remove('hud-disabled');
        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
    }
};
