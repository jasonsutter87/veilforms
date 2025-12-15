# Missing CSS Classes - Quick Reference

**Generated:** December 13, 2025
**Total Missing:** 69 classes across 7 HTML files

---

## By File (Prioritized)

### 1. Dashboard (`layouts/dashboard/baseof.html`) - 33 missing ⚠️

```scss
// Form Builder
.form-builder-view
.form-builder-layout
.field-palette
.palette-title
.field-types
.field-type-btn
.form-canvas-wrapper
.canvas-header
.canvas-actions
.form-canvas
.canvas-dropzone
.dropzone-hint
.hint-sub
.field-properties
.properties-header
.properties-body
.properties-close
.preview-container

// Settings
.settings-view
.settings-header
.settings-subtitle
.settings-section
.settings-danger
.danger-item
.color-input-wrapper

// Subscription
.current-plan
.plan-label
.subscription-info
.subscription-status
.subscription-actions

// Other
.audit-logs-view
.modal-lg
.modal-close-btn
```

**File:** `/assets/scss/pages/dashboard.scss` (exists - needs additions)

---

### 2. Compare Page (`layouts/pages/compare.html`) - 23 missing ⚠️

```scss
// Hero & Sections
.compare-hero
.compare-table-section
.why-veilforms
.competitor-details
.compare-cta

// Table Components
.feature-col
.feature-desc
.veilforms-col
.provider-header
.provider-name
.provider-badge
.category-row
.winner

// Indicators
.yes
.no
.partial
.coming
.value

// Cards & Layout
.competitor-card
.reasons-grid
.reason-card
.reason-icon
.cta-box
```

**File:** `/assets/scss/pages/compare.scss` (NEEDS TO BE CREATED)

---

### 3. Terms Pages (3 files) - 10 missing total

**privacy-policy.html (3):**
```scss
.SubHead
.btn-text
.site-container-1340
```

**terms-of-use.html (3):**
```scss
.SubHead
.btn-text
.site-container-1340
```

**accessibility-statement.html (4):**
```scss
.btn-text
.heading-h4
.site-container-1340
.standard-body-links
```

**File:** `/assets/scss/pages/terms.scss` (NEEDS TO BE CREATED)

---

### 4. Base Template (`layouts/_default/baseof.html`) - 2 missing

```scss
.skip-link
.main-content-area
```

**File:** `/assets/scss/shared/_accessibility.scss` (NEEDS TO BE CREATED)

---

### 5. Blog (`layouts/blog/single.html`) - 1 missing

```scss
.blog-post
```

**File:** `/assets/scss/pages/blog.scss` (exists - needs addition)

---

## Quick Action Checklist

### Step 1: Create New SCSS Files

- [ ] `/assets/scss/pages/compare.scss`
- [ ] `/assets/scss/pages/terms.scss`
- [ ] `/assets/scss/shared/_accessibility.scss`

### Step 2: Add Classes to Existing Files

- [ ] Add 33 classes to `/assets/scss/pages/dashboard.scss`
- [ ] Add `.blog-post` to `/assets/scss/pages/blog.scss`

### Step 3: Update main.scss

Add imports to `/assets/scss/main.scss`:

```scss
// Add to shared section
@use 'shared/accessibility' as *;

// Add to pages section
@use 'pages/compare';
@use 'pages/terms';
```

---

## Class Categories (by Purpose)

### Layout & Containers
- `.site-container-1340` (3 uses - terms pages)
- `.main-content-area` (baseof.html)
- `.form-builder-layout` (dashboard)

### Form Builder UI
- `.form-builder-view`, `.field-palette`, `.field-types`, `.field-type-btn`
- `.form-canvas`, `.canvas-header`, `.canvas-actions`, `.canvas-dropzone`
- `.field-properties`, `.properties-header`, `.properties-body`, `.properties-close`
- `.dropzone-hint`, `.hint-sub`, `.preview-container`

### Comparison Page
- `.compare-hero`, `.compare-table-section`, `.compare-cta`
- `.feature-col`, `.feature-desc`, `.veilforms-col`
- `.provider-header`, `.provider-name`, `.provider-badge`
- `.yes`, `.no`, `.partial`, `.coming`, `.value`
- `.winner`, `.category-row`

### Cards & Sections
- `.competitor-card`, `.competitor-details`
- `.reason-card`, `.reason-icon`, `.reasons-grid`
- `.why-veilforms`, `.cta-box`

### Settings & Subscription
- `.settings-view`, `.settings-header`, `.settings-subtitle`, `.settings-section`
- `.settings-danger`, `.danger-item`
- `.current-plan`, `.plan-label`
- `.subscription-info`, `.subscription-status`, `.subscription-actions`
- `.color-input-wrapper`

### Typography & Text
- `.SubHead` (terms pages)
- `.heading-h4` (accessibility statement)
- `.standard-body-links` (accessibility statement)

### Buttons & Links
- `.btn-text` (4 uses - all terms pages)
- `.modal-close-btn` (dashboard)

### Accessibility
- `.skip-link` (baseof)
- `.main-content-area` (baseof)

### Other
- `.audit-logs-view` (dashboard)
- `.modal-lg` (dashboard)
- `.blog-post` (blog single)

---

## File Impact Analysis

| File | Missing Classes | Impact | Priority |
|------|----------------|--------|----------|
| dashboard/baseof.html | 33 | Critical - Core app functionality | 🔴 High |
| pages/compare.html | 23 | High - Marketing/conversion page | 🟠 High |
| terms/privacy-policy.html | 3 | Medium - Legal compliance | 🟡 Medium |
| terms/terms-of-use.html | 3 | Medium - Legal compliance | 🟡 Medium |
| terms/accessibility-statement.html | 4 | Medium - A11y compliance | 🟡 Medium |
| _default/baseof.html | 2 | Medium - Affects all pages | 🟡 Medium |
| blog/single.html | 1 | Low - Blog styling | 🟢 Low |

---

## Estimated Effort

| Task | Effort | Lines of SCSS |
|------|--------|---------------|
| Compare page styles | 2-3 hours | ~200-300 |
| Dashboard additions | 3-4 hours | ~300-400 |
| Terms page styles | 1 hour | ~100 |
| Accessibility styles | 30 min | ~50 |
| Blog post class | 15 min | ~20 |
| **TOTAL** | **6-9 hours** | **~670-870 lines** |

---

## Notes

### Currently Defined SCSS Files

✅ **Shared:**
- `_variables.scss` (design tokens)
- `_mixins.scss` (reusable mixins)
- `_header.scss` (header styles)

✅ **Pages:**
- `auth.scss` (login, register, etc.)
- `blog.scss` (needs `.blog-post` addition)
- `contact.scss`
- `dashboard.scss` (needs 33 additions)
- `demo.scss`
- `docs.scss`
- `features.scss`
- `home.scss`
- `pricing.scss`

❌ **Missing:**
- `compare.scss` (NEW - 23 classes)
- `terms.scss` (NEW - ~7 classes)
- `shared/_accessibility.scss` (NEW - 2 classes)

### Main.scss Structure

The main.scss file currently:
- Uses Tailwind layers (@tailwind base, components, utilities)
- Imports shared variables and mixins
- Defines base styles, components, header, footer, and CTA in the main file
- Does NOT appear to import page-specific SCSS files

**Action Required:** Update main.scss to import page-specific stylesheets or ensure they're compiled separately by the build system.
