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

        if (consoleType === 'N64') {
            this.startN64(romBytes);
            return;
        }

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

    startN64: function(romBytes) {
        const player = document.getElementById('game-player');
        if (!player) return;
        document.querySelector('script[data-emulatorjs-loader]')?.remove();
        const canvas = document.createElement('canvas');
        canvas.id = 'n64-canvas';
        canvas.width = 640;
        canvas.height = 480;
        player.appendChild(canvas);
        window.Module = {
            canvas,
            arguments: ['/rom.n64'],
            locateFile: path => `./cores/${path}`,
            preRun: [() => window.Module.FS_createDataFile('/', 'rom.n64', romBytes, true, true)]
        };
        const script = document.createElement('script');
        script.src = './cores/n64wasm.js';
        script.dataset.n64Loader = 'true';
        script.onerror = () => {
            player.innerHTML = '<p class="emulator-error">Le coeur N64 n’a pas pu être chargé.</p>';
        };
        document.body.appendChild(script);
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
        document.querySelector('script[data-n64-loader]')?.remove();
        window.Module = undefined;
        document.body.classList.remove('game-active', 'navigation-visible');
        document.body.classList.remove('hud-disabled');
        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
    }
};
