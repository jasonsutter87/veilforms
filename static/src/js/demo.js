// VeilForms Demo JavaScript (Features page)

function initDemo() {
  const demoName = document.getElementById('demo-name');
  const demoEmail = document.getElementById('demo-email');
  const demoMessage = document.getElementById('demo-message');
  const demoResult = document.getElementById('demo-result');
  const demoEncrypt = document.getElementById('demo-encrypt');

  if (!demoName || !demoEmail || !demoMessage || !demoResult) return;

  function updatePreview() {
    const data = {
      name: demoName.value || '',
      email: demoEmail.value || '',
      message: demoMessage.value || ''
    };

    // Detect PII
    const piiDetected = [];
    if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(data.email)) {
      piiDetected.push('email');
    }
    if (/(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/.test(data.message)) {
      piiDetected.push('phone');
    }

    // Simulate encryption
    const fakeEncrypted = btoa(JSON.stringify(data)).substring(0, 40) + '...';
    const fakeKey = btoa(Math.random().toString()).substring(0, 30) + '...';
    const fakeIv = btoa(Math.random().toString()).substring(0, 16);

    let output = `{
  <span class="key">"encrypted"</span>: <span class="highlight">true</span>,
  <span class="key">"version"</span>: "vf-e1",
  <span class="key">"data"</span>: "${fakeEncrypted}",
  <span class="key">"key"</span>: "${fakeKey}",
  <span class="key">"iv"</span>: "${fakeIv}"`;

    if (piiDetected.length > 0) {
      output += `,
  <span class="key">"pii_detected"</span>: [<span class="highlight">"${piiDetected.join('", "')}"</span>]`;
    }

    output += `
}`;

    demoResult.innerHTML = `<code>${output}</code>`;
  }

  if (demoEncrypt) {
    demoEncrypt.addEventListener('click', updatePreview);
  }
  demoName.addEventListener('input', updatePreview);
  demoEmail.addEventListener('input', updatePreview);
  demoMessage.addEventListener('input', updatePreview);
}

document.addEventListener('DOMContentLoaded', initDemo);
