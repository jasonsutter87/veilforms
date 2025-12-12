# VeilForms Product Roadmap

> Building the best privacy-first form builder that people actually want.

## Vision
Forms that respect privacy by default. Zero-knowledge architecture where even we can't see your data.

## Principles
1. **Privacy by design** - Not an afterthought
2. **Developer-first** - Great API, great SDK, great docs
3. **Zero trust** - We never see unencrypted data
4. **Simple** - Complex security, simple UX

---

# Q1 2025: Foundation & MVP

## Sprint 1: Security Hardening (Week 1-2) ✅ COMPLETED
> Make what we have production-ready

### Epic: Auth Security
- [x] **CRITICAL**: Remove hardcoded JWT secret fallback, require env var
- [x] Add rate limiting to all auth endpoints (10 req/min)
- [x] Implement account lockout after 5 failed attempts (15 min cooldown)
- [ ] Add CSRF protection to auth forms
- [x] Restrict CORS to known domains (configurable)
- [x] Add password strength requirements (12+ chars, mixed case, number)

### Epic: Email Verification
- [x] Create email verification token system
- [x] Send verification email on registration
- [x] Add /verify endpoint to validate tokens
- [x] Block login until email verified (with resend option)
- [x] Add verification status to user object

### Epic: Session Management
- [x] Reduce JWT expiry to 24 hours
- [ ] Implement refresh token rotation
- [x] Add logout endpoint (token blacklist)
- [ ] Track active sessions per user

---

## Sprint 2: Core API Completion (Week 3-4) ✅ COMPLETED
> Complete the submission flow end-to-end

### Epic: Form Submission Engine
- [x] Complete `/api/submit` endpoint
  - Accept encrypted payload
  - Validate form exists and is active
  - Store submission with timestamp
  - Return anonymous submission ID
- [x] Add submission metadata (timestamp, form version, SDK version)
- [x] Implement submission webhooks (fire-and-forget)
- [x] Add submission count limits per form

### Epic: Submission Management
- [x] GET `/api/submissions/:formId` - List submissions (encrypted)
- [x] GET `/api/submissions/:formId/:id` - Get single submission
- [x] DELETE `/api/submissions/:formId/:id` - Delete submission
- [x] DELETE `/api/submissions/:formId` - Bulk delete
- [x] Add pagination (cursor-based)
- [x] Add date range filtering

### Epic: Form Management
- [x] PUT `/api/forms/:id` - Update form settings
- [x] DELETE `/api/forms/:id` - Soft delete form
- [x] POST `/api/forms/:id/regenerate-keys` - Key rotation
- [x] GET `/api/forms/:id/stats` - Submission count, last submission

---

## Sprint 3: Dashboard MVP (Week 5-6) ✅ COMPLETED
> Users need to see and manage their data

### Epic: Dashboard Shell
- [x] Create `/dashboard` layout with sidebar nav
- [x] Implement auth guard (redirect to login if not authenticated)
- [x] Add loading states and error handling
- [x] Mobile-responsive dashboard layout

### Epic: Forms Management UI
- [x] Forms list view (cards with stats)
- [x] Form detail view (settings, embed code, stats)
- [x] Create new form modal
- [x] Delete form confirmation
- [x] Copy embed code button

### Epic: Submissions Viewer
- [x] Submissions table (paginated)
- [x] Client-side decryption flow
  - Prompt for private key (or load from localStorage)
  - Decrypt and display in table
  - Never send private key to server
- [x] Individual submission detail modal
- [x] Export to CSV (decrypted, client-side)
- [ ] Bulk delete with confirmation (deferred to future sprint)

### Epic: Key Management UI
- [x] Show public key (copyable)
- [x] Private key export (download as .json)
- [x] Private key import (for recovery/decryption)
- [x] Key backup reminder on form creation
- [x] Warning: "Lost key = lost data forever"

---

## Sprint 4: SDK Polish & DX (Week 7-8)
> Make developers love us

### Epic: SDK Improvements
- [ ] Add TypeScript definitions
- [ ] Improve error messages with actionable guidance
- [ ] Add retry logic with exponential backoff
- [ ] Support custom validation rules
- [ ] Add form field encryption options (per-field)
- [ ] Offline queue with sync on reconnect

### Epic: Framework Integrations
- [ ] React component wrapper (`@veilforms/react`)
- [ ] Vue component wrapper (`@veilforms/vue`)
- [ ] NPM package publishing
- [ ] CDN hosting (unpkg, jsDelivr)

### Epic: Documentation
- [ ] Interactive API explorer
- [ ] Code examples for all endpoints
- [ ] Framework-specific guides (React, Vue, vanilla)
- [ ] Video tutorial: "5-minute integration"
- [ ] Troubleshooting guide
- [ ] Security whitepaper

---

# Q2 2025: Product-Market Fit

## Sprint 5: Form Builder v1 (Week 9-10)
> Not everyone wants to write code

### Epic: Visual Form Builder
- [ ] Drag-and-drop field ordering
- [ ] Field types: text, email, phone, textarea, select, checkbox, radio
- [ ] Field properties panel (label, placeholder, required, PII flag)
- [ ] Live preview (side-by-side)
- [ ] Form settings (name, redirect URL, webhook URL)
- [ ] Save and publish flow

### Epic: Form Templates
- [ ] Contact form template
- [ ] Feedback form template
- [ ] Survey template
- [ ] Lead capture template
- [ ] Custom CSS support

### Epic: Embed Options
- [ ] Inline embed (div + script)
- [ ] Popup/modal embed
- [ ] Full-page hosted form (`forms.veilforms.com/f/:id`)
- [ ] Custom thank-you page

---

## Sprint 6: Webhooks & Integrations (Week 11-12)
> Connect to the tools people already use

### Epic: Webhook System
- [ ] Configure webhook URL per form
- [ ] Webhook payload format (encrypted or decrypted option)
- [ ] Retry logic (3 attempts, exponential backoff)
- [ ] Webhook logs (last 100 deliveries)
- [ ] Webhook secret for signature verification

### Epic: Native Integrations
- [ ] Zapier integration (trigger on submission)
- [ ] Slack notifications
- [ ] Email notifications (to form owner)
- [ ] Google Sheets export (manual)

### Epic: API Keys
- [ ] Create API keys (scoped permissions)
- [ ] List/revoke API keys
- [ ] API key usage stats
- [ ] Rate limits per key

---

## Sprint 7: Analytics & Insights (Week 13-14)
> Help users understand their forms

### Epic: Form Analytics
- [ ] Submissions over time (chart)
- [ ] Submission sources (referrer)
- [ ] Conversion rate (views → submissions)
- [ ] Average completion time
- [ ] Drop-off analysis (which fields cause abandonment)

### Epic: Privacy-Preserving Analytics
- [ ] All analytics computed on encrypted metadata
- [ ] No PII in analytics
- [ ] Differential privacy for aggregate stats
- [ ] Export analytics as CSV

---

## Sprint 8: Team & Collaboration (Week 15-16)
> Forms are often a team effort

### Epic: Team Management
- [ ] Invite team members (email)
- [ ] Role-based access (owner, admin, viewer)
- [ ] Per-form permissions
- [ ] Activity log (who did what)
- [ ] Transfer form ownership

### Epic: Shared Key Management
- [ ] Team key vault (encrypted)
- [ ] Key escrow option (for team recovery)
- [ ] Audit log for key access

---

# Q3 2025: Scale & Trust

## Sprint 9: Enterprise Features (Week 17-18)

### Epic: Compliance & Audit
- [ ] GDPR data export (all user data)
- [ ] GDPR data deletion (right to be forgotten)
- [ ] Audit logs (90-day retention)
- [ ] SOC 2 preparation documentation
- [ ] Data Processing Agreement template

### Epic: Advanced Security
- [ ] SSO (SAML, OIDC)
- [ ] 2FA (TOTP)
- [ ] IP allowlisting
- [ ] Custom data retention policies
- [ ] Encryption key rotation automation

---

## Sprint 10: Self-Hosting (Week 19-20)

### Epic: Self-Hosted Distribution
- [ ] Docker image (single container)
- [ ] Docker Compose (with database options)
- [ ] Kubernetes Helm chart
- [ ] Terraform modules (AWS, GCP, Azure)
- [ ] One-click deploys (Railway, Render, Fly.io)

### Epic: Self-Hosted Documentation
- [ ] Installation guide
- [ ] Configuration reference
- [ ] Backup & restore procedures
- [ ] Upgrade guide
- [ ] Security hardening checklist

---

## Sprint 11: Performance & Reliability (Week 21-22)

### Epic: Performance
- [ ] CDN for static assets
- [ ] Edge functions for global low-latency
- [ ] Submission batching for high-volume forms
- [ ] Lazy loading for dashboard

### Epic: Reliability
- [ ] Health check endpoints
- [ ] Automated backups
- [ ] Disaster recovery runbook
- [ ] Status page
- [ ] Uptime SLA documentation

---

## Sprint 12: Launch Prep (Week 23-24)

### Epic: Security Audit
- [ ] Third-party penetration test
- [ ] Fix all critical/high findings
- [ ] Publish security practices page
- [ ] Bug bounty program setup

### Epic: Launch Marketing
- [ ] Product Hunt launch
- [ ] Hacker News Show HN
- [ ] Dev.to / Hashnode articles
- [ ] Twitter/X launch thread
- [ ] Demo video
- [ ] Case studies (beta users)

---

# Backlog (Unprioritized)

## Future Features
- [ ] Conditional logic (show/hide fields)
- [ ] Multi-page forms
- [ ] File uploads (encrypted)
- [ ] Payment integration (Stripe)
- [ ] Scheduling forms (open/close dates)
- [ ] A/B testing for forms
- [ ] Form versioning
- [ ] Submission editing (re-encrypt)
- [ ] Mobile app for submission viewing
- [ ] Browser extension for quick form creation
- [ ] AI-powered form suggestions
- [ ] Form spam detection (ML-based)

## Technical Debt
- [ ] Migrate Sass @import to @use
- [ ] Add comprehensive E2E test suite
- [ ] API versioning strategy
- [ ] OpenAPI/Swagger spec
- [ ] SDK size optimization
- [ ] Accessibility audit (WCAG 2.1 AA)

---

# Success Metrics

## North Star
**Monthly Active Forms** - Forms that received at least 1 submission

## Supporting Metrics
- Time to first form (< 5 minutes)
- SDK integration time (< 30 minutes)
- Submission success rate (> 99%)
- Dashboard decryption success (> 99.9%)
- NPS score (> 50)

---

# How We Work

## Sprint Cadence
- 2-week sprints
- Planning on Monday
- Demo on Friday
- Retro after demo

## Definition of Done
- [ ] Code complete and reviewed
- [ ] Tests passing (unit + integration)
- [ ] Documentation updated
- [ ] Deployed to staging
- [ ] Product sign-off

## Prioritization
1. Security issues (always P0)
2. Bugs affecting users
3. Features that unblock users
4. Features users are asking for
5. Nice-to-haves

---

*Last updated: December 2024*
*Next review: End of Sprint 4*
