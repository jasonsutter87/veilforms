/**
 * The SDK against what /api/submit accepts: forms have honeypot spam protection
 * on by default, so every submission must carry spamProtection.honeypot, and the
 * honeypot must never end up inside the encrypted data.
 */
import { jest } from '@jest/globals';
import { webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';

// jsdom has no Web Crypto subtle API or TextEncoder; the browser does
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
Object.assign(globalThis, { TextEncoder, TextDecoder });

const { default: VeilForms } = await import('../veilforms.js');

const algo = { name: 'RSA-OAEP', hash: 'SHA-256' };
const pair = await crypto.subtle.generateKey({ ...algo, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, true, ['encrypt', 'decrypt']);
const publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey);

const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function decrypt(payload) {
  const aesRaw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, pair.privateKey, b64(payload.key));
  const aes = await crypto.subtle.importKey('raw', aesRaw, 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(payload.iv) }, aes, b64(payload.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

let sent;
beforeEach(() => {
  sent = [];
  globalThis.fetch = jest.fn(async (url, init) => {
    sent.push({ url, body: JSON.parse(init.body) });
    return { ok: true, json: async () => ({ success: true }) };
  });
  document.body.innerHTML = `
    <form data-veilform>
      <input name="name" value="Maya">
      <input name="email" value="maya@example.com">
      <textarea name="message">I need help with my plan</textarea>
      <button type="submit">Send</button>
    </form>`;
  VeilForms.init('vf_test_form', { publicKey, piiWarning: false });
});

const form = () => document.querySelector('form');
const submitAndWait = (eventName = 'veilforms:success') =>
  new Promise((resolve) => {
    form().addEventListener(eventName, (e) => resolve(e.detail), { once: true });
    form().dispatchEvent(new Event('submit', { cancelable: true }));
  });

describe('honeypot spam protection', () => {
  it('adds one hidden, unfocusable honeypot field to bound forms', () => {
    const fields = form().querySelectorAll('input[name="_vf_hp"]');
    expect(fields).toHaveLength(1);
    expect(fields[0].tabIndex).toBe(-1);
    expect(fields[0].getAttribute('aria-hidden')).toBe('true');
    expect(fields[0].autocomplete).toBe('off');
    VeilForms.bindForms();
    expect(form().querySelectorAll('input[name="_vf_hp"]')).toHaveLength(1);
  });

  it('sends an empty honeypot for a person, and keeps it out of the encrypted data', async () => {
    await submitAndWait();
    expect(sent).toHaveLength(1);
    const { body } = sent[0];
    expect(sent[0].url).toBe('https://veilforms.com/api/submit');
    expect(body.spamProtection).toEqual({ honeypot: '' });
    expect(body.payload.encrypted).toBe(true);
    expect(JSON.stringify(body)).not.toContain('maya@example.com');
    expect(await decrypt(body.payload)).toEqual({ name: 'Maya', email: 'maya@example.com', message: 'I need help with my plan' });
  });

  it('passes on what a bot typed into the honeypot, so the server can reject it', async () => {
    form().elements._vf_hp.value = 'http://spam.example';
    await submitAndWait();
    expect(sent[0].body.spamProtection).toEqual({ honeypot: 'http://spam.example' });
  });

  it('uses a honeypot the page already has instead of adding another', () => {
    document.body.innerHTML = '<form data-veilform><input name="msg"><input type="text" name="_vf_hp" class="mine"></form>';
    VeilForms.bindForms();
    const fields = document.querySelectorAll('input[name="_vf_hp"]');
    expect(fields).toHaveLength(1);
    expect(fields[0].className).toBe('mine');
  });

  it('sends an empty honeypot for programmatic submits too', async () => {
    await VeilForms.submit({ message: 'hi' });
    expect(sent[0].body.spamProtection).toEqual({ honeypot: '' });
    expect(sent[0].body.meta.sdkVersion).toBe('1.0.1');
  });
});
