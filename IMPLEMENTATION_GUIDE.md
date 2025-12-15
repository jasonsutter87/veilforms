# Implementation Guide - Missing CSS Classes

This guide provides starter SCSS code for all 69 missing classes identified in the audit.

---

## 1. Create `/assets/scss/pages/compare.scss`

```scss
// ==========================================================================
// COMPARE PAGE STYLES
// ==========================================================================

@use '../shared/variables' as *;
@use '../shared/mixins' as *;

// Hero Section
.compare-hero {
  background: linear-gradient(135deg, $primary 0%, $primary-dark 100%);
  padding: 4rem 0 3rem;
  text-align: center;
  color: white;

  h1 {
    font-size: 2.5rem;
    font-weight: $font-weight-bold;
    margin-bottom: 1rem;

    @include lg {
      font-size: 3rem;
    }
  }

  .lead {
    font-size: 1.125rem;
    opacity: 0.95;
    max-width: 700px;
    margin: 0 auto;
  }
}

// Comparison Table Section
.compare-table-section {
  padding: 4rem 0;
  background: $surface;
}

.compare-table-wrapper {
  overflow-x: auto;
  border-radius: $border-radius-lg;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.compare-table {
  width: 100%;
  background: white;
  border-collapse: separate;
  border-spacing: 0;
  min-width: 800px;

  thead {
    background: $gray-50;
  }

  th, td {
    padding: 1rem;
    text-align: center;
    border-bottom: 1px solid $border;
  }

  th {
    font-weight: $font-weight-semibold;
    color: $text;
  }

  // Category row separator
  .category-row {
    background: $gray-100;
    font-weight: $font-weight-bold;
    text-align: left;

    td {
      padding: 0.75rem 1rem;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: $text-muted;
    }
  }
}

// Table Columns
.feature-col {
  text-align: left;
  min-width: 250px;

  strong {
    display: block;
    margin-bottom: 0.25rem;
    color: $text;
  }
}

.feature-desc {
  display: block;
  font-size: 0.75rem;
  color: $text-muted;
  line-height: 1.4;
}

.veilforms-col {
  background: $primary-light;
  font-weight: $font-weight-semibold;
}

// Provider Headers
.provider-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;

  &.winner {
    position: relative;

    &::before {
      content: '★';
      position: absolute;
      top: -0.5rem;
      right: -0.5rem;
      color: $warning;
      font-size: 1.5rem;
    }
  }
}

.provider-name {
  font-weight: $font-weight-bold;
  font-size: 1rem;
}

.provider-badge {
  display: inline-block;
  padding: 0.25rem 0.625rem;
  background: $primary;
  color: white;
  font-size: 0.625rem;
  font-weight: $font-weight-semibold;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.winner {
  // Winner highlight styling
  position: relative;
}

// Check marks and indicators
.check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem 0.75rem;
  border-radius: $border-radius;
  font-size: 0.875rem;
  font-weight: $font-weight-medium;

  &.yes {
    background: $success-light;
    color: $success;

    &::before {
      content: '✓ ';
      margin-right: 0.25rem;
    }
  }

  &.no {
    background: $gray-100;
    color: $text-muted;

    &::before {
      content: '✗ ';
      margin-right: 0.25rem;
    }
  }

  &.partial {
    background: $warning-light;
    color: $warning;
  }

  &.coming {
    background: $info-light;
    color: $info;
    font-style: italic;
  }
}

.value {
  font-weight: $font-weight-medium;
  color: $text;

  &.highlight {
    color: $primary;
    font-weight: $font-weight-bold;
  }
}

// Why VeilForms Section
.why-veilforms {
  padding: 4rem 0;
  background: white;

  h2 {
    text-align: center;
    font-size: 2rem;
    font-weight: $font-weight-bold;
    margin-bottom: 3rem;
  }
}

.reasons-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
}

.reason-card {
  padding: 2rem;
  border: 1px solid $border;
  border-radius: $border-radius-lg;
  text-align: center;
  transition: all $transition-normal;

  &:hover {
    border-color: $primary;
    box-shadow: 0 4px 12px rgba($primary, 0.1);
    transform: translateY(-2px);
  }

  h3 {
    font-size: 1.25rem;
    font-weight: $font-weight-bold;
    margin: 1rem 0 0.75rem;
  }

  p {
    color: $text-muted;
    line-height: 1.6;
    margin: 0;
  }
}

.reason-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  background: $primary;
  color: white;
  font-size: 1.5rem;
  font-weight: $font-weight-bold;
  border-radius: 50%;
}

// Competitor Details Section
.competitor-details {
  padding: 4rem 0;
  background: $gray-50;

  h2 {
    text-align: center;
    font-size: 2rem;
    font-weight: $font-weight-bold;
    margin-bottom: 3rem;
  }
}

.competitor-card {
  background: white;
  padding: 2rem;
  border-radius: $border-radius-lg;
  margin-bottom: 2rem;
  border: 1px solid $border;

  h3 {
    font-size: 1.5rem;
    font-weight: $font-weight-bold;
    margin-bottom: 1rem;
    color: $primary;
  }

  p {
    margin-bottom: 1rem;
    line-height: 1.6;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 1.5rem 0;

    li {
      padding: 0.5rem 0;
      padding-left: 1.5rem;
      position: relative;

      &::before {
        content: '→';
        position: absolute;
        left: 0;
        color: $primary;
      }

      strong {
        color: $text;
      }
    }
  }
}

// CTA Section
.compare-cta {
  padding: 4rem 0;
  background: white;
}

.cta-box {
  max-width: 600px;
  margin: 0 auto;
  text-align: center;
  padding: 3rem;
  background: linear-gradient(135deg, $primary 0%, $primary-dark 100%);
  border-radius: $border-radius-lg;
  color: white;

  h2 {
    font-size: 2rem;
    font-weight: $font-weight-bold;
    margin-bottom: 1rem;
  }

  p {
    font-size: 1.125rem;
    margin-bottom: 2rem;
    opacity: 0.95;
  }

  .cta-buttons {
    display: flex;
    justify-content: center;
    gap: 1rem;
    flex-wrap: wrap;

    .btn {
      min-width: 140px;
    }

    .btn-primary {
      background: white;
      color: $primary;

      &:hover {
        background: $gray-100;
      }
    }

    .btn-secondary {
      background: transparent;
      color: white;
      border: 2px solid white;

      &:hover {
        background: rgba(white, 0.1);
      }
    }
  }
}
```

---

## 2. Create `/assets/scss/pages/terms.scss`

```scss
// ==========================================================================
// TERMS & POLICY PAGES
// ==========================================================================

@use '../shared/variables' as *;
@use '../shared/mixins' as *;

// Wide container for policy pages
.site-container-1340 {
  @include container(1340px);
}

// Inner page hero
#inner-page-hero-section {
  padding: 3rem 0 2rem;
  background: $gray-50;
  border-bottom: 1px solid $border;

  h4 {
    font-size: 0.875rem;
    font-weight: $font-weight-semibold;
    color: $primary;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }

  h1 {
    font-size: 2.5rem;
    font-weight: $font-weight-bold;
    margin: 0;
  }
}

// Main policies section
#policies-main-section {
  padding: 3rem 0;

  p {
    margin-bottom: 1.5rem;
    line-height: 1.8;
    color: $text;

    &.mb-0 {
      margin-bottom: 0;
    }
  }
}

// Subheadings in policy content
.SubHead {
  display: inline-block;
  font-size: 1.125rem;
  font-weight: $font-weight-bold;
  color: $text;
  margin-top: 2rem;
  margin-bottom: 0.5rem;
}

// Text button style (link-style button)
.btn-text {
  display: inline;
  padding: 0;
  background: none;
  border: none;
  color: $primary;
  font-weight: $font-weight-medium;
  text-decoration: underline;
  cursor: pointer;
  transition: color $transition-fast;

  &:hover {
    color: $primary-dark;
  }
}

// Heading variant
.heading-h4 {
  font-size: 1.25rem;
  font-weight: $font-weight-bold;
  color: $text;
  margin: 1.5rem 0 1rem;
}

// Standard body text links
.standard-body-links {
  a {
    color: $primary;
    text-decoration: underline;
    transition: color $transition-fast;

    &:hover {
      color: $primary-dark;
    }
  }
}
```

---

## 3. Create `/assets/scss/shared/_accessibility.scss`

```scss
// ==========================================================================
// ACCESSIBILITY STYLES
// ==========================================================================

@use 'variables' as *;
@use 'mixins' as *;

// Skip to main content link
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: $primary;
  color: white;
  padding: 0.5rem 1rem;
  text-decoration: none;
  z-index: 1000;
  border-radius: 0 0 $border-radius $border-radius;

  &:focus {
    top: 0;
  }
}

// Main content landmark
.main-content-area {
  // Add outline for focus indicator
  &:focus {
    outline: 2px dashed $primary;
    outline-offset: 4px;
  }

  // Ensure it can receive focus when needed
  &[tabindex="-1"] {
    outline: none;
  }
}
```

---

## 4. Add to `/assets/scss/pages/blog.scss`

Add this to the existing blog.scss file:

```scss
// Blog post container
.blog-post {
  background: white;
  border-radius: $border-radius-lg;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  @include md {
    padding: 3rem;
  }

  // Typography within blog post
  h1, h2, h3, h4, h5, h6 {
    margin-top: 2rem;
    margin-bottom: 1rem;
    font-weight: $font-weight-bold;
  }

  h1 {
    font-size: 2.5rem;
  }

  h2 {
    font-size: 2rem;
  }

  h3 {
    font-size: 1.5rem;
  }

  p {
    margin-bottom: 1.5rem;
    line-height: 1.8;
  }

  img {
    max-width: 100%;
    height: auto;
    border-radius: $border-radius;
    margin: 2rem 0;
  }

  ul, ol {
    margin: 1.5rem 0;
    padding-left: 2rem;

    li {
      margin-bottom: 0.5rem;
      line-height: 1.6;
    }
  }

  blockquote {
    border-left: 4px solid $primary;
    padding-left: 1.5rem;
    margin: 2rem 0;
    font-style: italic;
    color: $text-muted;
  }
}
```

---

## 5. Add to `/assets/scss/pages/dashboard.scss`

Add these classes to the existing dashboard.scss file:

```scss
// ==========================================================================
// FORM BUILDER VIEW
// ==========================================================================

.form-builder-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - #{$topbar-height});
  background: $bg;
}

.form-builder-layout {
  display: grid;
  grid-template-columns: 240px 1fr 320px;
  flex: 1;
  overflow: hidden;
  gap: 0;

  @media (max-width: 1200px) {
    grid-template-columns: 200px 1fr;

    .field-properties {
      position: fixed;
      right: 0;
      top: $topbar-height;
      height: calc(100vh - #{$topbar-height});
      z-index: 50;
      box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
    }
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;

    .field-palette {
      position: fixed;
      left: 0;
      top: $topbar-height;
      height: calc(100vh - #{$topbar-height});
      z-index: 50;
      transform: translateX(-100%);
      transition: transform $transition-normal;

      &.open {
        transform: translateX(0);
      }
    }
  }
}

// Field Palette (left sidebar)
.field-palette {
  background: $surface;
  border-right: 1px solid $border;
  padding: 1.5rem;
  overflow-y: auto;
}

.palette-title {
  font-size: 0.875rem;
  font-weight: $font-weight-bold;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: $text-muted;
  margin-bottom: 1rem;
}

.field-types {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-type-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid $border;
  border-radius: $border-radius;
  cursor: grab;
  transition: all $transition-fast;
  text-align: left;

  &:hover {
    border-color: $primary;
    background: $primary-light;
  }

  &:active {
    cursor: grabbing;
  }

  svg {
    flex-shrink: 0;
    color: $text-muted;
  }

  span {
    font-size: 0.875rem;
    font-weight: $font-weight-medium;
  }
}

// Form Canvas (center)
.form-canvas-wrapper {
  display: flex;
  flex-direction: column;
  background: $gray-50;
  overflow: hidden;
}

.canvas-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: white;
  border-bottom: 1px solid $border;
}

.canvas-actions {
  display: flex;
  gap: 0.75rem;
}

.form-canvas {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
}

.canvas-dropzone {
  min-height: 400px;
  border: 2px dashed $border;
  border-radius: $border-radius-lg;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem;

  &.drag-over {
    border-color: $primary;
    background: $primary-light;
  }

  &:not(:empty) {
    border-style: solid;
    border-color: transparent;
  }
}

.dropzone-hint {
  text-align: center;
  color: $text-muted;

  svg {
    color: $gray-400;
    margin-bottom: 1rem;
  }

  p {
    font-size: 1rem;
    margin: 0.5rem 0;
  }
}

.hint-sub {
  font-size: 0.875rem;
  color: $gray-500;
}

// Field Properties (right sidebar)
.field-properties {
  background: $surface;
  border-left: 1px solid $border;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.properties-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid $border;

  h3 {
    font-size: 1rem;
    font-weight: $font-weight-bold;
    margin: 0;
  }
}

.properties-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: $text-muted;
  cursor: pointer;
  padding: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: $text;
  }
}

.properties-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

// Preview Container
.preview-container {
  padding: 2rem;
  background: $gray-50;
  border-radius: $border-radius;
  max-height: 600px;
  overflow-y: auto;
}

// ==========================================================================
// SETTINGS VIEW
// ==========================================================================

.settings-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.settings-header {
  margin-bottom: 2rem;

  h2 {
    font-size: 2rem;
    font-weight: $font-weight-bold;
    margin-bottom: 0.5rem;
  }
}

.settings-subtitle {
  color: $text-muted;
  font-size: 1rem;
  margin: 0;
}

.settings-section {
  background: white;
  border: 1px solid $border;
  border-radius: $border-radius-lg;
  padding: 2rem;
  margin-bottom: 1.5rem;

  h3 {
    font-size: 1.25rem;
    font-weight: $font-weight-bold;
    margin-bottom: 1.5rem;
  }
}

.settings-danger {
  border-color: $danger;

  h3 {
    color: $danger;
  }
}

.danger-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border: 1px solid $border;
  border-radius: $border-radius;
  margin-bottom: 1rem;

  &:last-child {
    margin-bottom: 0;
  }

  div {
    flex: 1;

    strong {
      display: block;
      margin-bottom: 0.25rem;
    }

    p {
      margin: 0;
      font-size: 0.875rem;
      color: $text-muted;
    }
  }

  .btn {
    margin-left: 1rem;
  }
}

// Color Input Wrapper
.color-input-wrapper {
  display: flex;
  gap: 0.75rem;
  align-items: center;

  input[type="color"] {
    width: 3rem;
    height: 3rem;
    border: 1px solid $border;
    border-radius: $border-radius;
    cursor: pointer;
  }

  input[type="text"] {
    flex: 1;
  }
}

// ==========================================================================
// SUBSCRIPTION
// ==========================================================================

.subscription-info {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.current-plan {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: $primary-light;
  border-radius: $border-radius;
}

.plan-label {
  font-size: 0.875rem;
  font-weight: $font-weight-semibold;
  text-transform: uppercase;
  color: $text-muted;
}

.plan-name {
  font-size: 1.25rem;
  font-weight: $font-weight-bold;
  color: $primary;
}

.subscription-status {
  font-size: 0.875rem;
  color: $text-muted;
}

.subscription-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

// ==========================================================================
// AUDIT LOGS VIEW
// ==========================================================================

.audit-logs-view {
  padding: 2rem;

  table {
    width: 100%;
    background: white;
    border-radius: $border-radius-lg;
    overflow: hidden;

    th, td {
      padding: 1rem;
      text-align: left;
      border-bottom: 1px solid $border;
    }

    th {
      background: $gray-50;
      font-weight: $font-weight-semibold;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  }
}

// ==========================================================================
// MODAL VARIANTS
// ==========================================================================

.modal-lg {
  .modal-content {
    max-width: 900px;
  }
}

.modal-close-btn {
  // Override default modal close if needed
  min-width: 100px;
}
```

---

## 6. Update `/assets/scss/main.scss`

Add these imports to your main.scss file:

```scss
// Add after existing shared imports
@use 'shared/accessibility' as *;

// Add page imports (if not using separate compilation)
@use 'pages/compare';
@use 'pages/terms';
@use 'pages/blog';
@use 'pages/dashboard';
```

**OR** if pages are compiled separately, ensure your build system processes them.

---

## Testing Checklist

After implementing these styles:

### Visual Testing
- [ ] Compare page displays correctly with proper table layout
- [ ] Dashboard form builder is functional and styled
- [ ] Terms pages have proper typography and spacing
- [ ] Skip link appears on focus
- [ ] Blog posts render with proper formatting

### Responsive Testing
- [ ] Compare table scrolls horizontally on mobile
- [ ] Dashboard layout adapts on tablet and mobile
- [ ] Form builder sidebars become toggleable on small screens
- [ ] All buttons and CTAs are touch-friendly

### Accessibility Testing
- [ ] Skip link works with keyboard (Tab key)
- [ ] All interactive elements have focus indicators
- [ ] Color contrast meets WCAG AA standards
- [ ] Heading hierarchy is logical

### Browser Testing
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

---

## Notes

1. **Variables used:** All code assumes you're using the variables defined in `_variables.scss` (like `$primary`, `$border`, `$text`, etc.)

2. **Mixins used:** Code uses mixins from `_mixins.scss` (like `@include container()`, `@include btn-base()`, etc.)

3. **Tailwind integration:** These custom classes work alongside Tailwind utilities defined in `main.scss`

4. **Build process:** Ensure your Hugo/SCSS build process compiles these new files

5. **Responsiveness:** Most layouts use CSS Grid and Flexbox for responsive behavior

6. **Performance:** Consider lazy-loading page-specific styles if bundle size becomes an issue
