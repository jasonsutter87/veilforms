# CSS Class Audit Report - VeilForms

**Date:** December 13, 2025
**Audit Focus:** CSS classes used in HTML templates but missing SCSS definitions

---

## Executive Summary

This audit analyzed all HTML templates in the `/layouts/` directory to identify CSS classes that are used in templates but don't have corresponding style definitions in the SCSS files.

### Key Findings

- **Total HTML files analyzed:** 29
- **Files with missing class definitions:** 7
- **Total missing class definitions:** 69
- **Total SCSS selectors defined:** 272

### Impact Assessment

**Priority: HIGH** - Several major pages have significant numbers of missing styles:
- Dashboard page: 33 missing classes
- Compare page: 23 missing classes
- Terms pages: 10 missing classes (combined)

---

## Detailed Findings by File

### 1. `/layouts/dashboard/baseof.html`

**Status:** Critical - 33 missing class definitions

This is the main dashboard interface. Missing styles will likely result in broken or unstyled UI elements.

**Missing Classes:**

| Class | Likely Purpose |
|-------|----------------|
| `.audit-logs-view` | Audit logs section container |
| `.canvas-actions` | Form builder toolbar actions |
| `.canvas-dropzone` | Drop area for form fields |
| `.canvas-header` | Form builder canvas header |
| `.color-input-wrapper` | Color picker input wrapper |
| `.current-plan` | User's subscription plan display |
| `.danger-item` | Danger zone action items |
| `.dropzone-hint` | Empty state hint text |
| `.field-palette` | Form field type palette sidebar |
| `.field-properties` | Field properties panel |
| `.field-type-btn` | Draggable field type buttons |
| `.field-types` | Container for field types |
| `.form-builder-layout` | Form builder grid layout |
| `.form-builder-view` | Form builder main view |
| `.form-canvas` | Form building canvas |
| `.form-canvas-wrapper` | Canvas wrapper container |
| `.hint-sub` | Subtitle hint text |
| `.modal-close-btn` | Modal close button (specific variant) |
| `.modal-lg` | Large modal size |
| `.palette-title` | Palette section title |
| `.plan-label` | Subscription plan label |
| `.preview-container` | Form preview container |
| `.properties-body` | Properties panel body |
| `.properties-close` | Properties panel close button |
| `.properties-header` | Properties panel header |
| `.settings-danger` | Danger zone section |
| `.settings-header` | Settings page header |
| `.settings-section` | Settings section container |
| `.settings-subtitle` | Settings subtitle text |
| `.settings-view` | Settings main view |
| `.subscription-actions` | Subscription action buttons |
| `.subscription-info` | Subscription info display |
| `.subscription-status` | Subscription status indicator |

**Recommendation:** Create `/assets/scss/pages/dashboard.scss` or verify it exists and add these missing class definitions. The dashboard appears to have a complex UI with drag-and-drop form building, settings management, and subscription handling.

---

### 2. `/layouts/pages/compare.html`

**Status:** High Priority - 23 missing class definitions

This comparison page is critical for marketing and conversions. Missing styles could impact user experience and brand perception.

**Missing Classes:**

| Class | Likely Purpose |
|-------|----------------|
| `.category-row` | Category header row in comparison table |
| `.coming` | "Coming soon" feature badge |
| `.compare-cta` | Call-to-action section on compare page |
| `.compare-hero` | Hero section for compare page |
| `.compare-table-section` | Comparison table wrapper section |
| `.competitor-card` | Detailed competitor comparison card |
| `.competitor-details` | Competitor details section |
| `.cta-box` | CTA container box |
| `.feature-col` | Feature column in table |
| `.feature-desc` | Feature description text |
| `.no` | "No" indicator in comparison |
| `.partial` | "Partial" support indicator |
| `.provider-badge` | Provider badge (e.g., "You're Here") |
| `.provider-header` | Provider name header in table |
| `.provider-name` | Provider name text |
| `.reason-card` | Reason card in "Why choose" section |
| `.reason-icon` | Icon for reason cards |
| `.reasons-grid` | Grid layout for reason cards |
| `.value` | Value display in comparison table |
| `.veilforms-col` | VeilForms column styling |
| `.why-veilforms` | "Why VeilForms" section |
| `.winner` | Winner badge/highlight |
| `.yes` | "Yes" indicator in comparison |

**Recommendation:** Create `/assets/scss/pages/compare.scss` with comprehensive styles for the comparison table, badges, and marketing sections. This page needs careful design attention as it's a key conversion page.

---

### 3. `/layouts/terms/privacy-policy.html`

**Status:** Medium Priority - 3 missing class definitions

**Missing Classes:**

| Class | Likely Purpose |
|-------|----------------|
| `.SubHead` | Subheading within policy sections |
| `.btn-text` | Text-style button (link button) |
| `.site-container-1340` | Container with 1340px max-width |

**Context:** Line 24 shows usage: `<p class="mb-0"><span class="SubHead">Collection of your Personal Information</span></p>`

---

### 4. `/layouts/terms/terms-of-use.html`

**Status:** Medium Priority - 3 missing class definitions

**Missing Classes:**

| Class | Likely Purpose |
|-------|----------------|
| `.SubHead` | Subheading within terms sections |
| `.btn-text` | Text-style button (link button) |
| `.site-container-1340` | Container with 1340px max-width |

**Note:** Same missing classes as privacy-policy.html - suggests these are shared styles needed across all terms pages.

---

### 5. `/layouts/terms/accessibility-statement.html`

**Status:** Medium Priority - 4 missing class definitions

**Missing Classes:**

| Class | Likely Purpose |
|-------|----------------|
| `.btn-text` | Text-style button (link button) |
| `.heading-h4` | H4-styled heading |
| `.site-container-1340` | Container with 1340px max-width |
| `.standard-body-links` | Standard link styling for body text |

---

### 6. `/layouts/_default/baseof.html`

**Status:** Medium Priority - 2 missing class definitions

This is the base template, so missing styles here affect many pages.

**Missing Classes:**

| Class | Likely Purpose |
|-------|----------------|
| `.main-content-area` | Main content landmark for accessibility |
| `.skip-link` | Skip navigation link for accessibility |

**Recommendation:** Add to `/assets/scss/shared/_common.scss` or create an accessibility-specific partial. These are important for WCAG compliance.

---

### 7. `/layouts/blog/single.html`

**Status:** Low Priority - 1 missing class definition

**Missing Classes:**

| Class | Likely Purpose |
|-------|----------------|
| `.blog-post` | Blog post container/wrapper |

**Note:** Check if `/assets/scss/pages/blog.scss` exists and add this class if needed.

---

## Recommendations by Priority

### Priority 1: Critical (Complete First)

1. **Dashboard Styles** (`/assets/scss/pages/dashboard.scss`)
   - Add all 33 missing classes for the dashboard interface
   - Focus on form builder, settings, and subscription UI
   - Ensure drag-and-drop interactions are properly styled

2. **Compare Page Styles** (`/assets/scss/pages/compare.scss`)
   - Add all 23 missing classes for the comparison page
   - Design comparison table with clear visual hierarchy
   - Style badges and indicators for "Yes", "No", "Partial", "Coming Soon"
   - Create attractive reason cards and CTA sections

### Priority 2: High (Complete Second)

3. **Shared Container Styles** (`/assets/scss/shared/_containers.scss` or similar)
   - `.site-container-1340` - Used across multiple terms pages
   - Consider creating standardized container classes

4. **Shared Typography & Links** (`/assets/scss/shared/_typography.scss`)
   - `.SubHead` - Subheading style used in policy pages
   - `.heading-h4` - H4 heading variant
   - `.standard-body-links` - Standard link styling

5. **Shared Button Styles** (`/assets/scss/shared/_buttons.scss`)
   - `.btn-text` - Text-style button used in terms pages

### Priority 3: Medium (Complete Third)

6. **Accessibility Styles** (`/assets/scss/shared/_accessibility.scss`)
   - `.skip-link` - Skip navigation
   - `.main-content-area` - Main content landmark

7. **Blog Styles** (`/assets/scss/pages/blog.scss`)
   - `.blog-post` - Blog post container

---

## SCSS File Structure Recommendation

Based on this audit, here's the recommended structure:

```
assets/scss/
├── main.scss                    # Main import file
├── shared/
│   ├── _variables.scss         # Design tokens (exists)
│   ├── _mixins.scss            # Reusable mixins (exists)
│   ├── _header.scss            # Header styles (exists)
│   ├── _containers.scss        # NEW: Container utilities
│   ├── _typography.scss        # NEW: Typography styles
│   ├── _buttons.scss           # NEW: Button variants
│   └── _accessibility.scss     # NEW: A11y styles
└── pages/
    ├── auth.scss               # (exists)
    ├── blog.scss               # (exists - needs .blog-post)
    ├── contact.scss            # (exists)
    ├── dashboard.scss          # (exists - needs 33 classes!)
    ├── demo.scss               # (exists)
    ├── docs.scss               # (exists)
    ├── features.scss           # (exists)
    ├── home.scss               # (exists)
    ├── pricing.scss            # (exists)
    ├── compare.scss            # NEW: Comparison page
    └── terms.scss              # NEW: Terms/policy pages
```

---

## Action Items

- [ ] Create `/assets/scss/pages/compare.scss` with 23 class definitions
- [ ] Add 33 missing classes to `/assets/scss/pages/dashboard.scss`
- [ ] Create `/assets/scss/pages/terms.scss` for terms page styles (SubHead, btn-text, site-container-1340, etc.)
- [ ] Create `/assets/scss/shared/_containers.scss` for container utilities
- [ ] Create `/assets/scss/shared/_typography.scss` for typography classes
- [ ] Create `/assets/scss/shared/_buttons.scss` for button variants
- [ ] Create `/assets/scss/shared/_accessibility.scss` for a11y classes
- [ ] Add `.blog-post` to `/assets/scss/pages/blog.scss`
- [ ] Update `/assets/scss/main.scss` to import all new partials

---

## Notes

### Classes Correctly Ignored

The audit correctly filtered out:
- Tailwind utility classes (flex, p-4, text-center, etc.)
- Bootstrap grid classes (row, col-12, col-lg-9, etc.)
- Responsive breakpoint classes (md:*, lg:*, etc.)
- State classes (hover:*, focus:*, etc.)

### SCSS Files Analyzed

Both SCSS locations were checked:
- `/assets/scss/` (refactored location) - 13 files
- `/assets/src/scss/` (legacy location) - 16 files

Total of 272 class selectors were found across all SCSS files.

---

## Conclusion

The audit reveals that **69 CSS classes are used in HTML templates but lack SCSS definitions**. The most critical gaps are in the dashboard (33 classes) and comparison page (23 classes).

These missing styles should be prioritized based on:
1. **User impact** - Dashboard is core functionality
2. **Business impact** - Compare page drives conversions
3. **Accessibility** - Skip links and semantic markup
4. **Code maintainability** - Shared components reduce duplication

Implementing these styles will ensure visual consistency, improve user experience, and maintain design system integrity across the VeilForms application.
