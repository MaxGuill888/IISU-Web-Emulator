window.emulatorCore = {
    currentCoreScript: null,

    start: function(coreName, romBytes, consoleType) {
        // 1. Nettoyage de l'ancien script de cœur si présent
        if (this.currentCoreScript) {
            this.currentCoreScript.remove();
            this.currentCoreScript = null;
        }

        // 2. Récupération des éléments HTML Canvas
        const canvas = document.getElementById('game-canvas-1');
        const borderImg = document.getElementById('console-border-img');

        // Application de la bordure d'overlay selon la console
        if (borderImg) {
            borderImg.src = `assets/borders/${consoleType}.png`;
            borderImg.style.display = 'block';
        }

        // 3. Configuration globale de l'objet Module requis par Emscripten/RetroArch
        window.Module = {
            canvas: canvas,
            arguments: ["/game.rom"],
            
            // Redirection vers le dossier retroarch/ pour trouver le fichier .wasm
            locateFile: function(path) {
                if (path.endsWith('.wasm')) {
                    return `retroarch/${path}`;
                }
                return path;
            },

            // Injection de la ROM dans le système de fichier virtuel (MEMFS) avant l'exécution
            preRun: [function() {
                try {
                    Module.FS_createDataFile('/', 'game.rom', romBytes, true, true);
                    console.log("ROM chargée avec succès dans le système de fichiers virtuel.");
                } catch (err) {
                    console.error("Erreur lors de la création du fichier virtuel ROM :", err);
                }
            }],

            onRuntimeInitialized: function() {
                console.log(`Cœur ${coreName} initialisé et en cours d'exécution.`);
            },

            print: function(text) {
                console.log(`[Core Output]: ${text}`);
            },

            printErr: function(text) {
                console.error(`[Core Error]: ${text}`);
            }
        };

        // 4. Chargement dynamique du fichier JS du cœur
        const script = document.createElement('script');
        script.id = `script-core-${coreName}`;
        script.src = `retroarch/${coreName}.js`;
        this.currentCoreScript = script;

        document.body.appendChild(script);
    }
};