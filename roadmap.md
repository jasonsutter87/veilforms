# VeilForms Roadmap

> Privacy-first forms that respect your users.

## Current Status

**Version**: 1.0.0
**Tests**: 196 passing
**Lighthouse**: 92-99 all categories

---

## Completed

### Phase 1: Foundation
- [x] Hugo static site with Netlify deployment
- [x] Netlify Functions serverless API
- [x] Netlify Blob multi-tenant storage
- [x] Client-side encryption (RSA-2048 + AES-256)
- [x] JWT authentication with email verification
- [x] Password reset flow
- [x] Rate limiting and account lockout
- [x] Complete documentation site

### Phase 2: Core API
- [x] Form CRUD operations
- [x] Submission endpoints with pagination
- [x] Webhook support
- [x] API key management
- [x] Audit logging

### Phase 3: Dashboard
- [x] Dashboard with auth guard
- [x] Forms management UI
- [x] Submissions viewer with client-side decryption
- [x] Private key management
- [x] CSV export

### Phase 4: SDK
- [x] VeilForms client SDK
- [x] Automatic PII detection
- [x] Anonymous submission IDs
- [x] Event system

### Phase 5: Production Readiness
- [x] Environment variable documentation
- [x] Error handling improvements
- [x] Health check endpoint
- [x] SEO optimization (sitemap, schema, robots.txt)
- [x] Accessibility audit
- [x] Broken link fixes

---

## In Progress

### Stripe Integration
- [ ] Connect Stripe keys
- [ ] Test payment flow
- [ ] Subscription management

### Email Integration
- [ ] Connect Resend API
- [ ] Test transactional emails
- [ ] Email templates

---

## Next Up

### Architecture Migration (Hybrid Stack)
- [ ] Create Next.js app for `app.veilforms.com`
- [ ] Migrate Netlify Functions → Next.js API routes
- [ ] Migrate dashboard HTML/JS → React components
- [ ] Keep Hugo for marketing site (`veilforms.com`)
- [ ] Update auth redirects to point to app subdomain
- [ ] Benefit: Better DX, proper bundling, no CSP/module hacks

### Visual Form Builder
- [ ] Drag-and-drop field ordering
- [ ] Field types: text, email, textarea, select, checkbox, radio
- [ ] Live preview
- [ ] Custom CSS support
- [ ] Form templates

### SDK Enhancements
- [ ] TypeScript definitions
- [ ] React wrapper (`@veilforms/react`)
- [ ] Vue wrapper (`@veilforms/vue`)
- [ ] NPM package publishing

### Analytics
- [ ] Submissions over time chart
- [ ] Conversion tracking (privacy-preserving)
- [ ] Drop-off analysis

---

## Future

### Team Features
- [ ] Invite team members
- [ ] Role-based access
- [ ] Activity logs
- [ ] Shared key vault

### Enterprise
- [ ] SSO (SAML/OIDC)
- [ ] 2FA (TOTP)
- [ ] Custom data retention
- [ ] SOC 2 documentation
- [ ] HIPAA BAA

### Self-Hosting
- [ ] Docker image
- [ ] Kubernetes Helm chart
- [ ] Terraform modules
- [ ] One-click deploys (Railway, Render, Fly.io)

---

## Backlog

- [ ] Conditional logic (show/hide fields)
- [ ] Multi-page forms
- [ ] File uploads (encrypted)
- [ ] Scheduling (open/close dates)
- [ ] A/B testing
- [ ] Mobile app
- [ ] Browser extension

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Time to first form | < 5 min |
| SDK integration | < 30 min |
| Submission success rate | > 99% |
| Lighthouse scores | > 90 |
| Test coverage | > 80% |

---

*Last updated: December 2024*
