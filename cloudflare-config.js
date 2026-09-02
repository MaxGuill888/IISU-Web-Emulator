// En production, l'API est servie par le meme domaine Cloudflare Pages.
// Modifier uniquement si le Worker est deploye sur un autre domaine.
window.IISU_CLOUDFLARE_CONFIG = {
    // Garder /api si Pages et le Worker partagent le meme domaine.
    // Sinon mettre par exemple https://iisu-emulator-api.<compte>.workers.dev/api.
    apiBase: '/api'
};
