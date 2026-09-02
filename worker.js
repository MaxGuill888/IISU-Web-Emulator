const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
});

function token() {
    return crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
}

async function hashPassword(password, salt = crypto.randomUUID()) {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, material, 256);
    return { salt, hash: [...new Uint8Array(bits)].map(byte => byte.toString(16).padStart(2, '0')).join('') };
}

async function user(request, env) {
    const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!bearer) return null;
    return env.DB.prepare(`select p.id, p.username, p.email from sessions s join profiles p on p.id = s.user_id where s.token = ? and s.expires_at > datetime('now')`).bind(bearer).first();
}

async function handle(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Content-Type, Authorization' } });
    if (!url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404);

    if (url.pathname === '/api/signup' && request.method === 'POST') {
        const { username, email, password } = await request.json();
        if (!/^[A-Za-z0-9_]{3,24}$/.test(username || '') || !email || !password || password.length < 6) return json({ error: 'Username, email ou mot de passe invalide.' }, 400);
        const existing = await env.DB.prepare('select id from profiles where lower(username) = lower(?) or lower(email) = lower(?)').bind(username, email).first();
        if (existing) return json({ error: 'Username ou email déjà utilisé.' }, 409);
        const id = crypto.randomUUID();
        const passwordData = await hashPassword(password);
        const session = token();
        await env.DB.batch([
            env.DB.prepare('insert into profiles (id, username, email, password_hash, password_salt) values (?, ?, ?, ?, ?)').bind(id, username, email.toLowerCase(), passwordData.hash, passwordData.salt),
            env.DB.prepare("insert into sessions (token, user_id, expires_at) values (?, ?, datetime('now', '+30 days'))").bind(session, id)
        ]);
        return json({ token: session, user: { id, username, email } }, 201);
    }

    if (url.pathname === '/api/login' && request.method === 'POST') {
        const { email, password } = await request.json();
        const found = await env.DB.prepare('select * from profiles where lower(email) = lower(?)').bind(email || '').first();
        if (!found || (await hashPassword(password, found.password_salt)).hash !== found.password_hash) return json({ error: 'Email ou mot de passe incorrect.' }, 401);
        const session = token();
        await env.DB.prepare("insert into sessions (token, user_id, expires_at) values (?, ?, datetime('now', '+30 days'))").bind(session, found.id).run();
        return json({ token: session, user: { id: found.id, username: found.username, email: found.email } });
    }

    const current = await user(request, env);
    if (!current) return json({ error: 'Authentification requise.' }, 401);
    if (url.pathname === '/api/me') return json({ user: current });
    if (url.pathname === '/api/users' && request.method === 'GET') {
        const query = (url.searchParams.get('username') || '').slice(0, 24);
        const result = await env.DB.prepare('select id, username from profiles where username like ? collate nocase and id != ? limit 10').bind(`%${query}%`, current.id).all();
        return json({ users: result.results });
    }
    if (url.pathname === '/api/friends' && request.method === 'POST') {
        const { friendId } = await request.json();
        if (!friendId || friendId === current.id) return json({ error: 'Utilisateur invalide.' }, 400);
        await env.DB.prepare('insert or ignore into friendships (user_id, friend_id, status) values (?, ?, \'accepted\')').bind(current.id, friendId).run();
        await env.DB.prepare('insert or ignore into friendships (user_id, friend_id, status) values (?, ?, \'accepted\')').bind(friendId, current.id).run();
        return json({ ok: true });
    }
    return json({ error: 'Route inconnue.' }, 404);
}

export default { fetch: handle };
