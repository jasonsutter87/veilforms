# Recommended data-testid Attributes

This document lists recommended `data-testid` attributes to add to VeilForms components for more stable E2E tests.

## Why data-testid?

While the current tests use semantic HTML (IDs, roles, text), `data-testid` attributes provide more stable selectors that won't break when:
- Text content changes (internationalization, copy updates)
- CSS classes change (refactoring styles)
- DOM structure changes (refactoring components)

## Recommended Attributes by Page

### Registration Page (`/register`)

```tsx
// Form elements
data-testid="register-form"
data-testid="register-email-input"
data-testid="register-password-input"
data-testid="register-submit-button"

// Password strength indicators
data-testid="password-requirement-length"
data-testid="password-requirement-uppercase"
data-testid="password-requirement-lowercase"
data-testid="password-requirement-number"

// OAuth buttons
data-testid="oauth-github-button"
data-testid="oauth-google-button"

// Error/success messages
data-testid="auth-error-message"
data-testid="feature-list"
```

### Login Page (`/login`)

```tsx
// Form elements
data-testid="login-form"
data-testid="login-email-input"
data-testid="login-password-input"
data-testid="login-submit-button"

// Links
data-testid="forgot-password-link"
data-testid="signup-link"

// OAuth buttons
data-testid="oauth-github-button"
data-testid="oauth-google-button"

// Error messages
data-testid="auth-error-message"
```

### Dashboard (`/dashboard`)

```tsx
// States
data-testid="dashboard-loading"
data-testid="dashboard-empty-state"
data-testid="dashboard-forms-grid"

// Empty state
data-testid="empty-state-icon"
data-testid="empty-state-title"
data-testid="empty-state-description"
data-testid="empty-state-create-button"

// Form cards
data-testid="form-card"  // or "form-card-{id}"
data-testid="form-card-title"
data-testid="form-card-status"
data-testid="form-card-submissions-count"
data-testid="form-card-last-submission"
data-testid="form-card-view-button"
data-testid="form-card-delete-button"

// New form card
data-testid="create-form-card"

// Error state
data-testid="error-state"
data-testid="error-message"
data-testid="error-retry-button"
```

### Create Form Modal

```tsx
// Modal
data-testid="create-form-modal"
data-testid="modal-backdrop"
data-testid="modal-close-button"

// Form fields
data-testid="form-name-input"
data-testid="form-pii-strip-checkbox"
data-testid="form-webhook-input"

// Actions
data-testid="modal-cancel-button"
data-testid="modal-submit-button"

// Error message
data-testid="form-error-message"
```

### Private Key Modal

```tsx
// Modal
data-testid="private-key-modal"
data-testid="private-key-warning"

// Key display
data-testid="private-key-textarea"

// Actions
data-testid="copy-key-button"
data-testid="download-key-button"
data-testid="key-saved-checkbox"
data-testid="key-continue-button"
```

### Delete Confirmation Modal

```tsx
data-testid="delete-modal"
data-testid="delete-modal-title"
data-testid="delete-modal-form-name"
data-testid="delete-modal-cancel"
data-testid="delete-modal-confirm"
```

## Implementation Example

### Before
```tsx
<button className="btn btn-primary" onClick={handleSubmit}>
  Create Account
</button>
```

### After
```tsx
<button
  className="btn btn-primary"
  onClick={handleSubmit}
  data-testid="register-submit-button"
>
  Create Account
</button>
```

## Usage in Tests

### Before (using ID)
```typescript
await page.click('#email');
```

### After (using data-testid)
```typescript
await page.click('[data-testid="register-email-input"]');
```

Or using Playwright's getByTestId:
```typescript
await page.getByTestId('register-email-input').click();
```

## Best Practices

1. **Use kebab-case**: `data-testid="form-submit-button"`
2. **Be descriptive but concise**: `data-testid="user-profile-edit-button"`
3. **Include context**: `data-testid="login-email-input"` not just `data-testid="email"`
4. **Dynamic IDs for lists**: `data-testid="form-card-{id}"` for unique items
5. **Group related elements**: All form fields in login use `login-` prefix

## When to Add data-testid

Priority order:
1. **High**: Form inputs, submit buttons, critical user actions
2. **Medium**: Navigation elements, modal triggers, status indicators
3. **Low**: Static content, decorative elements

## Migration Plan

You don't need to add all of these at once. Add them:
- When tests become flaky due to selector changes
- When adding new features
- When refactoring components
- As part of regular maintenance

The current tests work well with semantic HTML, but these attributes will make them more resilient to future changes.
