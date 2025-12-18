# VeilForms

Privacy-first form builder with client-side encryption. Your users' data is encrypted before it leaves their browser.

## Features

- **Client-Side Encryption** - RSA-2048 + AES-256 encryption happens in the browser
- **Zero Knowledge** - We never see unencrypted form data
- **Automatic PII Detection** - Identifies and protects sensitive fields
- **Anonymous Submissions** - No user tracking, no fingerprinting
- **GDPR Compliant** - Privacy by design, not afterthought

## Quick Start

### 1. Create an Account

Sign up at [veilforms.com/register](https://veilforms.com/register)

### 2. Add the SDK

```html
<script src="https://veilforms.com/js/veilforms.min.js"></script>
```

Or via npm:

```bash
npm install @veilforms/sdk
```

### 3. Initialize

```javascript
const vf = new VeilForms({
  formId: 'your-form-id',
  publicKey: 'your-public-key'
});

vf.on('submit', (data) => {
  console.log('Encrypted and submitted:', data.submissionId);
});
```

### 4. Add to Your Form

```html
<form id="contact-form" data-veilforms>
  <input type="text" name="name" required>
  <input type="email" name="email" required>
  <textarea name="message"></textarea>
  <button type="submit">Send</button>
</form>
```

## How It Works

1. User fills out your form
2. SDK encrypts data client-side with your public key
3. Encrypted payload sent to VeilForms
4. Only you can decrypt with your private key

```
[User's Browser] → Encrypt → [VeilForms Server] → [Your Dashboard] → Decrypt with Private Key
```

## Documentation

- [SDK Installation](https://veilforms.com/docs/sdk/installation/)
- [API Reference](https://veilforms.com/docs/api/authentication/)
- [GDPR Compliance](https://veilforms.com/docs/guides/gdpr/)
- [Self-Hosting Guide](https://veilforms.com/docs/guides/self-hosting/)

## Development

### Prerequisites

- Node.js 18+
- Hugo (extended version)

### Setup

```bash
# Clone the repository
git clone https://github.com/jasonsutter87/veilforms.git
cd veilforms

# Install dependencies
npm install
cd netlify/functions && npm install && cd ../..

# Copy environment template
cp .env.example .env

# Start development server
npm run dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm test` | Run test suite |
| `npm run test:coverage` | Run tests with coverage report |

### Project Structure

```
veilforms/
├── assets/           # SCSS source files
├── content/          # Hugo content (pages, blog, docs)
├── layouts/          # Hugo templates
├── netlify/functions/# Serverless API endpoints
├── src/
│   ├── client/       # VeilForms SDK
│   └── core/         # Shared encryption/PII modules
├── static/           # Static assets (JS, CSS, images)
└── hugo.toml         # Hugo configuration
```

## Tech Stack

- **Frontend**: Hugo static site generator
- **Backend**: Netlify Functions (serverless)
- **Storage**: Netlify Blob Store (multi-tenant)
- **Email**: Resend
- **Payments**: Stripe
- **Encryption**: Web Crypto API (RSA-2048 + AES-256-GCM)

## Security

- All form data encrypted client-side before transmission
- Private keys never leave your browser/device
- No PII stored on our servers (zero-knowledge)
- HTTPS everywhere, HSTS enabled
- Regular security audits

Found a vulnerability? Email security@veilforms.com

## Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

Current status: **617 tests passing** (Next.js app)

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- [Website](https://veilforms.com)
- [Documentation](https://veilforms.com/docs/)
- [Blog](https://veilforms.com/blog/)
- [GitHub](https://github.com/jasonsutter87/veilforms)
