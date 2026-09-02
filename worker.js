const corsHeaders = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'Content-Type, Authorization',
    'access-control-allow-methods': 'GET, POST, OPTIONS'
};

const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders }
});

function encode(value) {
    return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decode(value) {
    return atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4));
}

async function createToken(account, env) {
    const payload = encode(JSON.stringify({ id: account.id, exp: Date.now() + 30 * 86400000 }));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.AUTH_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = encode(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))));
    return `${payload}.${signature}`;
}

async function hashPassword(password, salt = crypto.randomUUID()) {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, material, 256);
    return { salt, hash: [...new Uint8Array(bits)].map(byte => byte.toString(16).padStart(2, '0')).join('') };
}

async function user(request, env) {
    const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!bearer) return null;
    try {
        const [payload, signature] = bearer.split('.');
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.AUTH_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
        const valid = await crypto.subtle.verify('HMAC', key, Uint8Array.from(decode(signature), character => character.charCodeAt(0)), new TextEncoder().encode(payload));
        const claims = JSON.parse(decode(payload));
        if (!valid || claims.exp < Date.now()) return null;
        return env.DB.prepare('select id, username, email from accounts where id = ?').bind(claims.id).first();
    } catch (error) {
        return null;
    }
}

async function handle(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (!url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404);

    if (url.pathname === '/api/signup' && request.method === 'POST') {
        const { username, email, password } = await request.json();
        if (!/^[A-Za-z0-9_]{3,24}$/.test(username || '') || !email || !password || password.length < 6) return json({ error: 'Username, email ou mot de passe invalide.' }, 400);
        const existing = await env.DB.prepare('select id from accounts where lower(username) = lower(?) or lower(email) = lower(?)').bind(username, email).first();
        if (existing) return json({ error: 'Username ou email déjà utilisé.' }, 409);
        const id = crypto.randomUUID();
        const passwordData = await hashPassword(password);
        await env.DB.batch([
            env.DB.prepare('insert into accounts (id, username, email, password_hash, password_salt) values (?, ?, ?, ?, ?)').bind(id, username, email.toLowerCase(), passwordData.hash, passwordData.salt)
        ]);
        return json({ token: await createToken({ id }, env), user: { id, username, email } }, 201);
    }

    if (url.pathname === '/api/login' && request.method === 'POST') {
        const { email, password } = await request.json();
        const found = await env.DB.prepare('select * from accounts where lower(email) = lower(?)').bind(email || '').first();
        if (!found || (await hashPassword(password, found.password_salt)).hash !== found.password_hash) return json({ error: 'Email ou mot de passe incorrect.' }, 401);
        return json({ token: await createToken(found, env), user: { id: found.id, username: found.username, email: found.email } });
    }

    const current = await user(request, env);
    if (!current) return json({ error: 'Authentification requise.' }, 401);
    if (url.pathname === '/api/me') return json({ user: current });
    if (url.pathname === '/api/users' && request.method === 'GET') {
        const query = (url.searchParams.get('username') || '').slice(0, 24);
        const result = await env.DB.prepare('select id, username from accounts where username like ? collate nocase and id != ? limit 10').bind(`%${query}%`, current.id).all();
        return json({ users: result.results });
    }
    if (url.pathname === '/api/friends' && request.method === 'POST') {
        const { friendId } = await request.json();
        if (!friendId || friendId === current.id) return json({ error: 'Utilisateur invalide.' }, 400);
        await env.DB.prepare('insert or ignore into friendships (user_id, friend_id, status) values (?, ?, \'accepted\')').bind(current.id, friendId).run();
        await env.DB.prepare('insert or ignore into friendships (user_id, friend_id, status) values (?, ?, \'accepted\')').bind(friendId, current.id).run();
        return json({ ok: true });
    }
    return json({ error: 'Méthode ou route inconnue.' }, 405);
}

export default { fetch: handle };
