const CACHE_NAME = 'iisu-emulator-v19';
const APP_SHELL = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './emulator.js',
    './cloudflare-config.js',
    './cores/n64wasm.js',
    './cores/n64wasm.wasm'
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    event.respondWith((async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        try {
            const response = await fetch(event.request);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
            return response;
        } catch (error) {
            return caches.match('./index.html');
        }
    })());
});
