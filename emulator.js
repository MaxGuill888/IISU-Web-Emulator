window.emulatorCore = {
    start: function(coreName, romBytes, consoleType) {
        // 1. Récupération des éléments d'interface
        const canvasContainer = document.getElementById('canvas-container');
        const borderImg = document.getElementById('console-border-img');

        // Application de la bordure si présente
        if (borderImg) {
            borderImg.src = `assets/borders/${consoleType}.png`;
            borderImg.style.display = 'block';
        }

        // 2. Nettoyage du conteneur d'émulation
        canvasContainer.innerHTML = '<div id="game-player"></div>';

        // 3. Conversion du Uint8Array en Blob/URL pour EmulatorJS
        const romBlob = new Blob([romBytes], { type: 'application/octet-stream' });
        const romUrl = URL.createObjectURL(romBlob);

        // Map des consoles vers les identifiants d'EmulatorJS
        const systemMap = {
            'NES': 'nes',
            'SNES': 'snes',
            'GBC': 'gbc',
            'GBA': 'gba'
        };

        // 4. Configuration globale requise par EmulatorJS
        window.EJS_player = '#game-player';
        window.EJS_gameUrl = romUrl;
        window.EJS_gameID = Date.now();
        window.EJS_core = systemMap[consoleType] || 'gba';
        window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';

        // 5. Injection du script d'émulation autonome
        const script = document.createElement('script');
        script.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
        document.body.appendChild(script);
    }
};
