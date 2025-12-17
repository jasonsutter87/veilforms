// Demo Page Script
(function() {
  const form = document.getElementById('demo-form');
  const piiAlert = document.getElementById('pii-alert');
  const piiTypes = document.getElementById('pii-types');
  const encryptedOutput = document.getElementById('encrypted-output');
  const originalOutput = document.getElementById('original-output');
  const successMessage = document.getElementById('success-message');
  const submissionIdEl = document.getElementById('submission-id');
  const submitBtn = document.getElementById('submit-btn');
  const resetBtn = document.getElementById('reset-btn');

  if (!form) return;

  // PII Patterns
  const PII_PATTERNS = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone: /(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g,
    ssn: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
    creditCard: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g,
  };

  // Detect PII
  function detectPII(data) {
    const detected = [];
    const text = JSON.stringify(data);

    for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
      if (pattern.test(text)) {
        detected.push(type);
      }
      pattern.lastIndex = 0;
    }

    // Check field names
    if (data.name && data.name.trim()) detected.push('name');
    if (data.email && data.email.trim()) detected.push('email');

    return [...new Set(detected)];
  }

  // Simulate encryption
  function simulateEncryption(data) {
    const jsonStr = JSON.stringify(data);
    const encrypted = btoa(unescape(encodeURIComponent(jsonStr)));
    const key = btoa(Math.random().toString(36) + Date.now());
    const iv = btoa(Math.random().toString(36));

    return {
      encrypted: true,
      version: 'vf-e1',
      data: encrypted.substring(0, 60) + '...',
      key: key.substring(0, 40) + '...',
      iv: iv.substring(0, 16)
    };
  }

  // Generate anonymous ID
  function generateAnonymousId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `vf-${timestamp}-${random}`;
  }

  // Escape HTML
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Update preview
  function updatePreview() {
    const data = {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      subject: document.getElementById('subject').value,
      message: document.getElementById('message').value
    };

    // Update original
    originalOutput.innerHTML = `<code>{
  <span class="key">"name"</span>: "${escapeHtml(data.name)}",
  <span class="key">"email"</span>: "${escapeHtml(data.email)}",
  <span class="key">"subject"</span>: "${escapeHtml(data.subject)}",
  <span class="key">"message"</span>: "${escapeHtml(data.message)}"
}</code>`;

    // Detect PII
    const pii = detectPII(data);
    if (pii.length > 0) {
      piiTypes.textContent = pii.join(', ');
      piiAlert.classList.add('show');
    } else {
      piiAlert.classList.remove('show');
    }

    // Simulate encryption
    const encrypted = simulateEncryption(data);
    let output = `{
  <span class="key">"encrypted"</span>: <span class="highlight">true</span>,
  <span class="key">"version"</span>: "${encrypted.version}",
  <span class="key">"data"</span>: "${encrypted.data}",
  <span class="key">"key"</span>: "${encrypted.key}",
  <span class="key">"iv"</span>: "${encrypted.iv}"`;

    if (pii.length > 0) {
      output += `,
  <span class="key">"pii_detected"</span>: [<span class="warning">"${pii.join('", "')}"</span>]`;
    }

    output += `
}`;

    encryptedOutput.innerHTML = `<code>${output}</code>`;
  }

  // Add event listeners
  ['name', 'email', 'subject', 'message'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updatePreview);
    }
  });

  // Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Encrypting...';

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const submissionId = generateAnonymousId();
    submissionIdEl.textContent = submissionId;

    form.style.display = 'none';
    piiAlert.classList.remove('show');
    successMessage.classList.add('show');

    submitBtn.disabled = false;
    submitBtn.textContent = 'Encrypt & Submit';
  });

  // Reset button
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      form.reset();
      form.style.display = 'block';
      successMessage.classList.remove('show');
      updatePreview();
    });
  }

  // Initial update
  updatePreview();
})();
