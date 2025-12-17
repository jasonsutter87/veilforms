/**
 * VeilForms Interactive Demo
 * Real client-side encryption demonstration
 */

(function() {
  'use strict';

  // State
  let keyPair = null;
  let encryptedPayload = null;
  let metrics = {
    keygenTime: 0,
    encryptTime: 0,
    decryptTime: 0,
    originalSize: 0,
    encryptedSize: 0
  };

  // DOM Elements
  const elements = {};

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    // Cache DOM elements
    elements.generateKeysBtn = document.getElementById('generate-keys');
    elements.keyDisplay = document.getElementById('key-display');
    elements.publicKeyPreview = document.getElementById('public-key-preview');
    elements.privateKeyPreview = document.getElementById('private-key-preview');
    elements.keygenMetrics = document.getElementById('keygen-metrics');
    elements.keygenTime = document.getElementById('keygen-time');
    
    elements.stepInput = document.getElementById('step-input');
    elements.stepEncrypt = document.getElementById('step-encrypt');
    elements.stepDecrypt = document.getElementById('step-decrypt');
    
    elements.inputName = document.getElementById('input-name');
    elements.inputEmail = document.getElementById('input-email');
    elements.inputSsn = document.getElementById('input-ssn');
    elements.inputMessage = document.getElementById('input-message');
    elements.piiDetection = document.getElementById('pii-detection');
    elements.piiTags = document.getElementById('pii-tags');
    
    elements.encryptBtn = document.getElementById('encrypt-btn');
    elements.encryptionViz = document.getElementById('encryption-viz');
    elements.outputTabs = document.getElementById('output-tabs');
    elements.outputPanel = document.getElementById('output-panel');
    elements.encryptedOutput = document.getElementById('encrypted-output');
    elements.networkOutput = document.getElementById('network-output');
    elements.rawOutput = document.getElementById('raw-output');
    elements.encryptMetrics = document.getElementById('encrypt-metrics');
    elements.encryptTime = document.getElementById('encrypt-time');
    elements.payloadSize = document.getElementById('payload-size');
    elements.overhead = document.getElementById('overhead');
    elements.serverCallout = document.getElementById('server-callout');
    
    elements.decryptBtn = document.getElementById('decrypt-btn');
    elements.decryptedOutput = document.getElementById('decrypted-output');
    elements.decryptedData = document.getElementById('decrypted-data');
    elements.decryptMetrics = document.getElementById('decrypt-metrics');
    elements.decryptTime = document.getElementById('decrypt-time');
    elements.totalTime = document.getElementById('total-time');
    
    elements.demoSummary = document.getElementById('demo-summary');
    
    // Benchmark elements
    elements.benchKeygen = document.getElementById('bench-keygen');
    elements.benchEncrypt = document.getElementById('bench-encrypt');
    elements.benchDecrypt = document.getElementById('bench-decrypt');
    elements.benchSize = document.getElementById('bench-size');

    // Bind events
    if (elements.generateKeysBtn) {
      elements.generateKeysBtn.addEventListener('click', handleGenerateKeys);
    }
    
    if (elements.encryptBtn) {
      elements.encryptBtn.addEventListener('click', handleEncrypt);
    }
    
    if (elements.decryptBtn) {
      elements.decryptBtn.addEventListener('click', handleDecrypt);
    }

    // Input change handlers for PII detection
    const inputs = [elements.inputName, elements.inputEmail, elements.inputSsn, elements.inputMessage];
    inputs.forEach(input => {
      if (input) {
        input.addEventListener('input', detectPII);
      }
    });

    // Tab switching
    if (elements.outputTabs) {
      elements.outputTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab')) {
          switchTab(e.target.dataset.tab);
        }
      });
    }
  }

  // Generate RSA-2048 keypair
  async function handleGenerateKeys() {
    elements.generateKeysBtn.disabled = true;
    elements.generateKeysBtn.innerHTML = '<span class="spinner"></span> Generating...';

    const startTime = performance.now();

    try {
      const cryptoKeyPair = await crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256'
        },
        true,
        ['encrypt', 'decrypt']
      );

      const publicKey = await crypto.subtle.exportKey('jwk', cryptoKeyPair.publicKey);
      const privateKey = await crypto.subtle.exportKey('jwk', cryptoKeyPair.privateKey);

      keyPair = { publicKey, privateKey, cryptoKeyPair };

      const endTime = performance.now();
      metrics.keygenTime = endTime - startTime;

      // Update UI
      elements.publicKeyPreview.textContent = JSON.stringify(publicKey, null, 2).substring(0, 200) + '...';
      elements.privateKeyPreview.textContent = JSON.stringify(privateKey, null, 2).substring(0, 200) + '...';
      elements.keygenTime.textContent = metrics.keygenTime.toFixed(1) + 'ms';

      elements.keyDisplay.style.display = 'grid';
      elements.keygenMetrics.style.display = 'flex';

      // Enable next step
      elements.stepInput.classList.remove('disabled');
      elements.stepInput.classList.add('active');
      document.getElementById('step-keys').classList.remove('active');
      document.getElementById('step-keys').classList.add('completed');

      // Enable form inputs
      [elements.inputName, elements.inputEmail, elements.inputSsn, elements.inputMessage].forEach(el => {
        if (el) el.disabled = false;
      });

      elements.generateKeysBtn.innerHTML = '✓ Keypair Generated';
      elements.generateKeysBtn.classList.add('completed');

      // Update benchmark
      elements.benchKeygen.textContent = metrics.keygenTime.toFixed(1) + 'ms';
      elements.benchKeygen.classList.add('measured');

    } catch (err) {
      console.error('Key generation failed:', err);
      elements.generateKeysBtn.innerHTML = 'Error - Try Again';
      elements.generateKeysBtn.disabled = false;
    }
  }

  // Detect PII in form inputs
  function detectPII() {
    const pii = [];
    
    const email = elements.inputEmail?.value || '';
    const ssn = elements.inputSsn?.value || '';
    const message = elements.inputMessage?.value || '';
    const name = elements.inputName?.value || '';

    if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(email)) {
      pii.push('Email Address');
    }
    
    if (/\d{3}[-.]?\d{2}[-.]?\d{4}/.test(ssn)) {
      pii.push('SSN');
    }
    
    if (/(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/.test(message)) {
      pii.push('Phone Number');
    }
    
    if (/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/.test(message)) {
      pii.push('Credit Card');
    }

    if (name.trim().split(/\s+/).length >= 2) {
      pii.push('Full Name');
    }

    if (pii.length > 0) {
      elements.piiDetection.style.display = 'block';
      elements.piiTags.innerHTML = pii.map(p => `<span class="pii-tag">${p}</span>`).join('');
    } else {
      elements.piiDetection.style.display = 'none';
    }

    // Enable encrypt button if there's any data
    const hasData = name || email || ssn || message;
    if (hasData && keyPair) {
      elements.encryptBtn.disabled = false;
      elements.stepEncrypt.classList.remove('disabled');
    }
  }

  // Encrypt form data
  async function handleEncrypt() {
    elements.encryptBtn.disabled = true;
    elements.encryptBtn.innerHTML = '<span class="spinner"></span> Encrypting...';

    const formData = {
      name: elements.inputName?.value || '',
      email: elements.inputEmail?.value || '',
      ssn: elements.inputSsn?.value || '',
      message: elements.inputMessage?.value || '',
      timestamp: new Date().toISOString()
    };

    metrics.originalSize = new Blob([JSON.stringify(formData)]).size;

    // Show visualization
    elements.encryptionViz.style.display = 'flex';
    await animateEncryption();

    const startTime = performance.now();

    try {
      // Generate symmetric key
      const symmetricKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      // Encrypt data with AES
      const encoder = new TextEncoder();
      const dataBytes = encoder.encode(JSON.stringify(formData));
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        symmetricKey,
        dataBytes
      );

      // Wrap symmetric key with RSA
      const symmetricKeyBytes = await crypto.subtle.exportKey('raw', symmetricKey);
      const encryptedKey = await crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        keyPair.cryptoKeyPair.publicKey,
        symmetricKeyBytes
      );

      encryptedPayload = {
        encrypted: true,
        version: 'vf-e1',
        data: arrayBufferToBase64(encryptedData),
        key: arrayBufferToBase64(encryptedKey),
        iv: arrayBufferToBase64(iv)
      };

      const endTime = performance.now();
      metrics.encryptTime = endTime - startTime;
      metrics.encryptedSize = new Blob([JSON.stringify(encryptedPayload)]).size;

      // Update outputs
      updateEncryptedOutputs(formData);

      // Update metrics
      elements.encryptTime.textContent = metrics.encryptTime.toFixed(1) + 'ms';
      elements.payloadSize.textContent = formatBytes(metrics.encryptedSize);
      const overheadPercent = ((metrics.encryptedSize / metrics.originalSize - 1) * 100).toFixed(0);
      elements.overhead.textContent = '+' + overheadPercent + '%';

      // Show UI elements
      elements.outputTabs.style.display = 'flex';
      elements.outputPanel.style.display = 'block';
      elements.encryptMetrics.style.display = 'flex';
      elements.serverCallout.style.display = 'flex';

      // Enable decrypt step
      elements.stepEncrypt.classList.remove('active');
      elements.stepEncrypt.classList.add('completed');
      elements.stepDecrypt.classList.remove('disabled');
      elements.stepDecrypt.classList.add('active');
      elements.decryptBtn.disabled = false;

      elements.encryptBtn.innerHTML = '✓ Encrypted';

      // Update benchmarks
      elements.benchEncrypt.textContent = metrics.encryptTime.toFixed(1) + 'ms';
      elements.benchEncrypt.classList.add('measured');
      elements.benchSize.textContent = '+' + overheadPercent + '%';
      elements.benchSize.classList.add('measured');

    } catch (err) {
      console.error('Encryption failed:', err);
      elements.encryptBtn.innerHTML = 'Error - Try Again';
      elements.encryptBtn.disabled = false;
    }
  }

  // Animate encryption visualization
  async function animateEncryption() {
    const steps = ['viz-step-1', 'viz-step-2', 'viz-step-3', 'viz-step-4'];
    
    for (let i = 0; i < steps.length; i++) {
      const step = document.getElementById(steps[i]);
      if (step) {
        step.classList.add('active');
        await sleep(300);
        step.classList.remove('active');
        step.classList.add('complete');
      }
    }
  }

  // Update encrypted output displays
  function updateEncryptedOutputs(originalData) {
    // Formatted JSON output
    const formatted = JSON.stringify(encryptedPayload, null, 2)
      .replace(/"([^"]+)":/g, '<span class="key">"$1"</span>:')
      .replace(/: "([^"]+)"/g, ': <span class="string">"$1"</span>')
      .replace(/: (true|false)/g, ': <span class="highlight">$1</span>');
    elements.encryptedOutput.innerHTML = formatted;

    // Network request simulation
    const networkRequest = `POST /api/submit HTTP/1.1
Host: api.veilforms.com
Content-Type: application/json
X-Form-ID: demo_form_123

${JSON.stringify(encryptedPayload, null, 2)}`;
    elements.networkOutput.textContent = networkRequest;

    // Raw ciphertext
    elements.rawOutput.textContent = encryptedPayload.data;
  }

  // Decrypt data
  async function handleDecrypt() {
    elements.decryptBtn.disabled = true;
    elements.decryptBtn.innerHTML = '<span class="spinner"></span> Decrypting...';

    const startTime = performance.now();

    try {
      // Decode the encrypted components
      const encryptedData = base64ToArrayBuffer(encryptedPayload.data);
      const encryptedKey = base64ToArrayBuffer(encryptedPayload.key);
      const iv = base64ToArrayBuffer(encryptedPayload.iv);

      // Unwrap the symmetric key with RSA
      const symmetricKeyBytes = await crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        keyPair.cryptoKeyPair.privateKey,
        encryptedKey
      );

      // Import the symmetric key
      const symmetricKey = await crypto.subtle.importKey(
        'raw',
        symmetricKeyBytes,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      // Decrypt the data
      const decryptedBytes = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        symmetricKey,
        encryptedData
      );

      const decoder = new TextDecoder();
      const decryptedData = JSON.parse(decoder.decode(decryptedBytes));

      const endTime = performance.now();
      metrics.decryptTime = endTime - startTime;

      // Update UI
      elements.decryptedData.textContent = JSON.stringify(decryptedData, null, 2);
      elements.decryptedOutput.style.display = 'block';
      elements.decryptTime.textContent = metrics.decryptTime.toFixed(1) + 'ms';
      elements.totalTime.textContent = (metrics.encryptTime + metrics.decryptTime).toFixed(1) + 'ms';
      elements.decryptMetrics.style.display = 'flex';

      // Mark step complete
      elements.stepDecrypt.classList.remove('active');
      elements.stepDecrypt.classList.add('completed');

      // Show summary
      elements.demoSummary.style.display = 'block';
      elements.demoSummary.scrollIntoView({ behavior: 'smooth', block: 'center' });

      elements.decryptBtn.innerHTML = '✓ Decrypted';

      // Update benchmark
      elements.benchDecrypt.textContent = metrics.decryptTime.toFixed(1) + 'ms';
      elements.benchDecrypt.classList.add('measured');

    } catch (err) {
      console.error('Decryption failed:', err);
      elements.decryptBtn.innerHTML = 'Error - Try Again';
      elements.decryptBtn.disabled = false;
    }
  }

  // Switch output tabs
  function switchTab(tabId) {
    document.querySelectorAll('.output-tabs .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`.tab[data-tab="${tabId}"]`)?.classList.add('active');
    document.getElementById(`tab-${tabId}`)?.classList.add('active');
  }

  // Utility functions
  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
})();
