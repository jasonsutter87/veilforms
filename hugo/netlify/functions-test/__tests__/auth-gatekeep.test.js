/**
 * Sign in with Gatekeep: the full code flow against a local fake Gatekeep that
 * signs real EdDSA ID tokens, with an in-memory user store.
 */
import { jest } from '@jest/globals';
import http from 'http';
import crypto from 'crypto';

const JWT_SECRET = 'Zq8vN3pL0wR7tY2uK5mX9cB4hG6jD1sFaEoIuPeQrTyWvMnBzXc';
process.env.JWT_SECRET = JWT_SECRET;

/** The claims of a VeilForms session token, after checking its HS256 signature. */
function verifySession(token) {
  const [h, p, s] = token.split('.');
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url');
  if (s !== expected) throw new Error('bad session signature');
  return JSON.parse(Buffer.from(p, 'base64url').toString());
}

// In-memory users, keyed by email like lib/storage.js.
const users = new Map();
jest.unstable_mockModule('../lib/storage.js', () => ({
  getUser: jest.fn(async (email) => users.get(email.toLowerCase()) ?? null),
  createOAuthUser: jest.fn(async (email, provider, providerId, name = null) => {
    const user = { id: `user_${users.size + 1}`, email: email.toLowerCase(), passwordHash: null, oauthProvider: provider, oauthProviderId: providerId, name, subscription: 'free', emailVerified: true };
    users.set(user.email, user);
    return user;
  }),
  updateUser: jest.fn(async (email, updates) => {
    const user = users.get(email.toLowerCase());
    if (!user) return null;
    const updated = { ...user, ...updates };
    users.set(user.email, updated);
    return updated;
  }),
}));

// ---------------------------------------------------------------- fake Gatekeep

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'EdDSA', use: 'sig' };
let nextClaims = {}; // what /token puts in the next ID token
let issuer;

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function idToken(claims) {
  const head = b64u({ alg: 'EdDSA', kid: 'k1', typ: 'JWT' });
  const body = b64u(claims);
  const sig = crypto.sign(null, Buffer.from(`${head}.${body}`), privateKey).toString('base64url');
  return `${head}.${body}.${sig}`;
}

const server = http.createServer((req, res) => {
  if (req.url === '/jwks.json') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ keys: [jwk] }));
  }
  if (req.url === '/token' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const p = new URLSearchParams(body);
      const now = Math.floor(Date.now() / 1000);
      const claims = { iss: issuer, aud: 'veilforms', sub: 'gk_sub_1', iat: now, exp: now + 900, email_verified: true, ...nextClaims };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id_token: idToken(claims), code_seen: p.get('code'), verifier: p.get('code_verifier') }));
    });
    return;
  }
  res.writeHead(404); res.end();
});

let handler;
beforeAll(async () => {
  await new Promise((r) => server.listen(0, r));
  issuer = `http://127.0.0.1:${server.address().port}`;
  process.env.GATEKEEP_ISSUER = issuer;
  ({ default: handler } = await import('../auth-gatekeep.js'));
});
afterAll(() => server.close());
beforeEach(() => { users.clear(); nextClaims = {}; });

// ---------------------------------------------------------------- helpers

const SITE = 'https://veilforms.com';
const get = (path, cookie) => handler(new Request(`${SITE}${path}`, { headers: cookie ? { cookie } : {} }));

/** Start a login; returns the pending cookie and the authorize URL's parameters. */
async function start(next) {
  const res = await get(`/api/auth/gatekeep/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  const loc = new URL(res.headers.get('location'));
  const cookie = res.headers.get('set-cookie').split(';')[0];
  return { res, loc, params: loc.searchParams, cookie };
}

/** Finish a login as Gatekeep would redirect back (nonce taken from the authorize request). */
async function finish({ params, cookie }, overrides = {}) {
  nextClaims = { nonce: params.get('nonce'), ...overrides.claims };
  const state = overrides.state ?? params.get('state');
  return get(`/api/auth/gatekeep/callback?code=abc&state=${state}`, overrides.cookie ?? cookie);
}

const fragmentOf = (res) => new URLSearchParams(new URL(res.headers.get('location')).hash.slice(1));

// ---------------------------------------------------------------- tests

describe('GET /api/auth/gatekeep/login', () => {
  it('sends the browser to Gatekeep with PKCE, state and nonce', async () => {
    const { res, loc, params, cookie } = await start();
    expect(res.status).toBe(302);
    expect(`${loc.origin}${loc.pathname}`).toBe(`${issuer}/authorize`);
    expect(params.get('client_id')).toBe('veilforms');
    expect(params.get('redirect_uri')).toBe(`${SITE}/api/auth/gatekeep/callback`);
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('scope')).toBe('openid email');
    expect(params.get('state')).toBeTruthy();
    expect(params.get('nonce')).toBeTruthy();
    expect(res.headers.get('set-cookie')).toMatch(/vf_gk_login=.+; Path=\/api\/auth\/gatekeep; HttpOnly; Secure; SameSite=Lax/);
    expect(cookie).toMatch(/^vf_gk_login=/);
  });
});

describe('GET /api/auth/gatekeep/callback', () => {
  it('creates the account on first sign-in and hands the dashboard a session in the fragment', async () => {
    const login = await start();
    const res = await finish(login, { claims: { email: 'New@Example.com' } });
    const loc = new URL(res.headers.get('location'));
    expect(res.status).toBe(302);
    expect(loc.pathname).toBe('/dashboard/');
    expect(loc.search).toBe(''); // nothing sensitive in the query string
    const frag = fragmentOf(res);
    const session = verifySession(frag.get('auth_token'));
    expect(session.email).toBe('new@example.com');
    const user = JSON.parse(Buffer.from(frag.get('user'), 'base64url').toString());
    expect(user).toMatchObject({ email: 'new@example.com', subscription: 'free', emailVerified: true });
    expect(users.get('new@example.com').oauthProvider).toBe('gatekeep');
    expect(res.headers.get('set-cookie')).toMatch(/vf_gk_login=; .*Max-Age=0/);
  });

  it('signs an existing password account into the same account and marks its email verified', async () => {
    users.set('jason@example.com', { id: 'user_existing', email: 'jason@example.com', passwordHash: 'x', subscription: 'pro', emailVerified: false });
    const res = await finish(await start(), { claims: { email: 'jason@example.com' } });
    const session = verifySession(fragmentOf(res).get('auth_token'));
    expect(session.id).toBe('user_existing');
    expect(users.get('jason@example.com')).toMatchObject({ id: 'user_existing', subscription: 'pro', emailVerified: true });
    expect(users.size).toBe(1);
  });

  it('refuses an email Gatekeep has not verified, and creates nothing', async () => {
    const res = await finish(await start(), { claims: { email: 'someone@example.com', email_verified: false } });
    expect(res.headers.get('location')).toBe(`${SITE}/login/?error=unverified`);
    expect(users.size).toBe(0);
  });

  it('refuses a token minted for a different login (nonce mismatch)', async () => {
    const res = await finish(await start(), { claims: { email: 'a@example.com', nonce: 'not-the-nonce' } });
    expect(res.headers.get('location')).toBe(`${SITE}/login/?error=signin`);
    expect(users.size).toBe(0);
  });

  it('refuses a token issued to another app (audience)', async () => {
    const res = await finish(await start(), { claims: { email: 'a@example.com', aud: 'some-other-app' } });
    expect(res.headers.get('location')).toBe(`${SITE}/login/?error=signin`);
  });

  it('refuses an expired token', async () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    const res = await finish(await start(), { claims: { email: 'a@example.com', exp: past } });
    expect(res.headers.get('location')).toBe(`${SITE}/login/?error=signin`);
  });

  it('refuses a callback whose state or login cookie is wrong', async () => {
    const login = await start();
    expect((await finish(login, { state: 'forged' })).headers.get('location')).toBe(`${SITE}/login/?error=expired`);
    const [name, value] = login.cookie.split('=');
    const tampered = `${name}=${value.slice(0, -2)}xx`;
    expect((await finish(login, { cookie: tampered })).headers.get('location')).toBe(`${SITE}/login/?error=expired`);
    expect((await finish(login, { cookie: '' })).headers.get('location')).toBe(`${SITE}/login/?error=expired`);
  });

  it('only returns to paths on this site (no open redirect)', async () => {
    for (const next of ['//evil.example/', 'https://evil.example/', '/\\evil.example']) {
      const res = await finish(await start(next), { claims: { email: 'a@example.com' } });
      expect(new URL(res.headers.get('location')).origin).toBe(SITE);
      expect(new URL(res.headers.get('location')).pathname).toBe('/dashboard/');
    }
    const res = await finish(await start('/dashboard/forms/'), { claims: { email: 'a@example.com' } });
    expect(new URL(res.headers.get('location')).pathname).toBe('/dashboard/forms/');
  });
});
