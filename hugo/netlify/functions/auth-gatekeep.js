/**
 * Sign in with Gatekeep (OpenID Connect, passkeys).
 *
 *   GET /api/auth/gatekeep/login     -> Gatekeep (code flow with PKCE, state and nonce)
 *   GET /api/auth/gatekeep/callback  <- back from Gatekeep: verify the ID token, find or
 *                                       create the account, hand the dashboard a session
 *
 * The session is the same VeilForms JWT a password login returns (createToken), so
 * every other function keeps working unchanged. It reaches the dashboard in the URL
 * fragment, which browsers never send to a server or put in a Referer header.
 *
 * Accounts are keyed by email, so only an email Gatekeep has verified may sign in;
 * otherwise someone could register your address there unverified and land in your
 * account.
 *
 * Env: JWT_SECRET (signs the short-lived login cookie), GATEKEEP_ISSUER (optional,
 * defaults to https://id.gatekeepauth.com). Register client_id "veilforms" in
 * Gatekeep's clients.toml with this site's /api/auth/gatekeep/callback.
 */

import crypto from 'crypto';
import { createToken } from './lib/auth.js';
import { getUser, createOAuthUser, updateUser } from './lib/storage.js';

const CLIENT_ID = 'veilforms';
const LOGIN_MS = 10 * 60 * 1000;
const enc = new TextEncoder();

const issuer = () => (process.env.GATEKEEP_ISSUER || 'https://id.gatekeepauth.com').replace(/\/$/, '');
const redirectUri = (origin) => `${origin}/api/auth/gatekeep/callback`;
const b64u = (bytes) => Buffer.from(bytes).toString('base64url');
const random = (n) => b64u(crypto.randomBytes(n));

// ---------------------------------------------------------------- signed login cookie

const mac = (body) => crypto.createHmac('sha256', `gatekeep-login:${process.env.JWT_SECRET}`).update(body).digest('base64url');

function seal(data) {
  const body = b64u(enc.encode(JSON.stringify(data)));
  return `${body}.${mac(body)}`;
}

function unseal(raw) {
  const [body, sig] = String(raw ?? '').split('.');
  if (!body || !sig) return null;
  const expected = Buffer.from(mac(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

const cookie = (req, name) => (req.headers.get('cookie') ?? '').split(/;\s*/).find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);
const setCookie = (name, value, maxAgeMs) => `${name}=${value}; Path=/api/auth/gatekeep; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(maxAgeMs / 1000)}`;

/** Only paths on this site, so the login can't be turned into an open redirect. */
const safeNext = (next) => (typeof next === 'string' && /^\/(?!\/)[\w\-./]*$/.test(next) ? next : '/dashboard/');

const redirect = (location, extraHeaders = {}) => {
  const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
  for (const [k, v] of Object.entries(extraHeaders)) headers.append(k, v);
  return new Response(null, { status: 302, headers });
};
const loginError = (origin, code) => redirect(`${origin}/login/?error=${code}`, { 'Set-Cookie': setCookie('vf_gk_login', '', 0) });

// ---------------------------------------------------------------- Gatekeep

async function startLogin(url) {
  const verifier = random(32);
  const state = random(16);
  const nonce = random(16);
  const challenge = b64u(crypto.createHash('sha256').update(verifier).digest());
  const q = new URLSearchParams({
    response_type: 'code', client_id: CLIENT_ID, redirect_uri: redirectUri(url.origin), scope: 'openid email',
    state, nonce, code_challenge: challenge, code_challenge_method: 'S256',
  });
  const pending = seal({ verifier, state, nonce, next: safeNext(url.searchParams.get('next')), exp: Date.now() + LOGIN_MS });
  return redirect(`${issuer()}/authorize?${q}`, { 'Set-Cookie': setCookie('vf_gk_login', pending, LOGIN_MS) });
}

let jwksCache = { at: 0, keys: [] };
async function jwks(force = false) {
  if (!force && Date.now() - jwksCache.at < 3600_000 && jwksCache.keys.length) return jwksCache.keys;
  const res = await fetch(`${issuer()}/jwks.json`);
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  jwksCache = { at: Date.now(), keys: (await res.json()).keys ?? [] };
  return jwksCache.keys;
}

/** A Gatekeep ID token's claims, after checking its EdDSA signature, issuer, audience, expiry and nonce. */
export async function verifyIdToken(token, nonce) {
  const [h, p, s] = String(token).split('.');
  const header = JSON.parse(Buffer.from(h, 'base64url').toString());
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
  if (header.alg !== 'EdDSA') return null;
  let jwk = (await jwks()).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await jwks(true)).find((k) => k.kid === header.kid); // keys rotate
  if (!jwk || jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519') return null;
  const key = await crypto.webcrypto.subtle.importKey('jwk', { kty: 'OKP', crv: 'Ed25519', x: jwk.x }, { name: 'Ed25519' }, false, ['verify']);
  const ok = await crypto.webcrypto.subtle.verify({ name: 'Ed25519' }, key, Buffer.from(s, 'base64url'), enc.encode(`${h}.${p}`));
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!ok || claims.iss !== issuer() || !aud.includes(CLIENT_ID) || !(claims.exp * 1000 > Date.now()) || claims.nonce !== nonce || !claims.sub) {
    return null;
  }
  return claims;
}

async function finishLogin(req, url) {
  const pending = unseal(cookie(req, 'vf_gk_login'));
  if (!pending || pending.state !== url.searchParams.get('state')) return loginError(url.origin, 'expired');
  const code = url.searchParams.get('code');
  if (!code) return loginError(url.origin, 'cancelled');

  const res = await fetch(`${issuer()}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(url.origin), client_id: CLIENT_ID, code_verifier: pending.verifier }),
  });
  const tokens = await res.json().catch(() => ({}));
  if (!res.ok || !tokens.id_token) return loginError(url.origin, 'signin');

  const claims = await verifyIdToken(tokens.id_token, pending.nonce);
  if (!claims) return loginError(url.origin, 'signin');
  const email = String(claims.email || '').trim().toLowerCase();
  if (!email || claims.email_verified !== true) return loginError(url.origin, 'unverified');

  // Same account whether it began with a password, GitHub/Google or Gatekeep.
  let user = await getUser(email);
  if (!user) {
    user = await createOAuthUser(email, 'gatekeep', claims.sub, claims.name || null);
  } else if (!user.emailVerified) {
    user = await updateUser(email, { emailVerified: true, emailVerifiedAt: new Date().toISOString() });
  }

  const token = createToken({ id: user.id, email: user.email });
  const profile = { id: user.id, email: user.email, subscription: user.subscription, emailVerified: true };
  const fragment = new URLSearchParams({ auth_token: token, user: b64u(enc.encode(JSON.stringify(profile))) });
  return redirect(`${url.origin}${pending.next}#${fragment}`, { 'Set-Cookie': setCookie('vf_gk_login', '', 0) });
}

export default async function handler(req) {
  const url = new URL(req.url);
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  try {
    if (url.pathname === '/api/auth/gatekeep/login') return await startLogin(url);
    if (url.pathname === '/api/auth/gatekeep/callback') return await finishLogin(req, url);
    return new Response('Not found', { status: 404 });
  } catch (err) {
    console.error('Gatekeep sign-in error:', err.message);
    return loginError(url.origin, 'unavailable');
  }
}

export const config = {
  path: ['/api/auth/gatekeep/login', '/api/auth/gatekeep/callback']
};
