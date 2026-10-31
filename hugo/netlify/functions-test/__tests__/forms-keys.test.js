/**
 * Form keys are made by the form owner, never by the server: POST /api/forms and
 * POST /api/forms/:id/regenerate-keys take a public key and refuse anything else.
 * Runs the real forms.js with in-memory storage.
 */
import { jest } from '@jest/globals';

process.env.JWT_SECRET = 'Zq8vN3pL0wR7tY2uK5mX9cB4hG6jD1sFaEoIuPeQrTyWvMnBzXc';

const forms = new Map();
jest.unstable_mockModule('../lib/storage.js', () => ({
  createForm: jest.fn(async (userId, data) => {
    const form = { id: `vf_test_${forms.size + 1}`, userId, status: 'active', createdAt: Date.now(), ...data };
    forms.set(form.id, form);
    return form;
  }),
  getForm: jest.fn(async (id) => forms.get(id) ?? null),
  updateForm: jest.fn(async (id, updates) => {
    const form = { ...forms.get(id), ...updates };
    forms.set(id, form);
    return form;
  }),
  deleteForm: jest.fn(),
  getUserForms: jest.fn(async (userId) => [...forms.values()].filter((f) => f.userId === userId)),
  getSubmissions: jest.fn(async () => ({ submissions: [] })),
  getUserById: jest.fn(async () => ({ id: 'user_1', subscription: 'free' })),
}));
jest.unstable_mockModule('../lib/auth.js', () => ({
  authenticateRequest: jest.fn(async (req) =>
    req.headers.get('authorization') === 'Bearer good'
      ? { user: { id: 'user_1', email: 'owner@example.com' } }
      : { error: 'Invalid token', status: 401 }),
}));
jest.unstable_mockModule('../lib/rate-limit.js', () => ({
  checkRateLimit: jest.fn(async () => ({ allowed: true })),
  getRateLimitHeaders: jest.fn(() => ({})),
}));
jest.unstable_mockModule('../lib/audit.js', () => ({
  logAudit: jest.fn(async () => {}),
  AuditEvents: { FORM_CREATED: 'form.created', FORM_KEYS_REGENERATED: 'form.keys_regenerated' },
  getAuditContext: jest.fn(() => ({})),
}));

const { default: handler } = await import('../forms.js');

// A key pair made the way the dashboard makes one, in the browser.
async function browserKeyPair(modulusLength = 2048) {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt']
  );
  return {
    publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey),
    privateKey: await crypto.subtle.exportKey('jwk', pair.privateKey),
  };
}

const post = (path, body, auth = 'Bearer good') =>
  handler(new Request(`https://veilforms.com${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://veilforms.com', ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(body),
  }), {});

let keys;
beforeAll(async () => { keys = await browserKeyPair(); });
beforeEach(() => forms.clear());

describe('POST /api/forms', () => {
  it('creates the form with the owner\'s public key, no CSRF cookie needed, and never returns a private key', async () => {
    const res = await post('/api/forms/', { name: 'ZTA contact', publicKey: keys.publicKey });
    expect(res.status).toBe(201);
    const { form } = await res.json();
    expect(form.privateKey).toBeUndefined();

    const stored = forms.get(form.id).publicKey;
    expect(stored).toEqual({ kty: 'RSA', n: keys.publicKey.n, e: 'AQAB', alg: 'RSA-OAEP-256', ext: true, key_ops: ['encrypt'] });
    for (const f of ['d', 'p', 'q', 'dp', 'dq', 'qi']) expect(stored[f]).toBeUndefined();
  });

  it('stores a key that encrypts submissions only the owner can decrypt', async () => {
    const res = await post('/api/forms/', { name: 'Round trip', publicKey: keys.publicKey });
    const { form } = await res.json();
    const pub = await crypto.subtle.importKey('jwk', forms.get(form.id).publicKey, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
    const priv = await crypto.subtle.importKey('jwk', keys.privateKey, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
    const secret = new TextEncoder().encode('hello from the contact form');
    const plain = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, priv, await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, secret));
    expect(new TextDecoder().decode(plain)).toBe('hello from the contact form');
  });

  it('refuses to create a form without a public key (the server no longer makes one)', async () => {
    const res = await post('/api/forms/', { name: 'No key' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/publicKey is required/);
    expect(forms.size).toBe(0);
  });

  it('refuses a private key sent by mistake, and never stores it', async () => {
    const res = await post('/api/forms/', { name: 'Oops', publicKey: keys.privateKey });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/private key/);
    expect(forms.size).toBe(0);
  });

  it('refuses weak, malformed and non-RSA keys', async () => {
    const weak = (await browserKeyPair(1024)).publicKey;
    for (const publicKey of [weak, { ...keys.publicKey, n: 'not base64url!' }, { ...keys.publicKey, e: 'Aw' }, { kty: 'EC', crv: 'P-256', x: 'a', y: 'b' }, 'a string']) {
      expect((await post('/api/forms/', { name: 'Bad key', publicKey })).status).toBe(400);
    }
    expect(forms.size).toBe(0);
  });

  it('still requires a signed-in owner or API key', async () => {
    expect((await post('/api/forms/', { name: 'Anon', publicKey: keys.publicKey }, null)).status).toBe(401);
  });
});

describe('POST /api/forms/:id/regenerate-keys', () => {
  it('swaps in the owner\'s new public key and returns no private key', async () => {
    const { form } = await (await post('/api/forms/', { name: 'Rotate me', publicKey: keys.publicKey })).json();
    const next = await browserKeyPair();
    const res = await post(`/api/forms/${form.id}/regenerate-keys`, { publicKey: next.publicKey });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.form.privateKey).toBeUndefined();
    expect(forms.get(form.id).publicKey.n).toBe(next.publicKey.n);
  });

  it('keeps the current key when no valid public key is sent', async () => {
    const { form } = await (await post('/api/forms/', { name: 'Keep me', publicKey: keys.publicKey })).json();
    expect((await post(`/api/forms/${form.id}/regenerate-keys`, {})).status).toBe(400);
    expect((await post(`/api/forms/${form.id}/regenerate-keys`, { publicKey: keys.privateKey })).status).toBe(400);
    expect(forms.get(form.id).publicKey.n).toBe(keys.publicKey.n);
  });
});
