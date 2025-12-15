# Security Quick Reference - VeilForms

## XSS Prevention Cheat Sheet

### ✅ DO THIS
```javascript
// Import sanitization functions
import { setSafeInnerHTML, sanitizeJson, sanitizeHtml } from './modules/index.js';

// Safe innerHTML assignment
const html = `<p>User content: ${escapeHtml(userInput)}</p>`;
setSafeInnerHTML(element, html);

// Safe JSON display
const jsonHtml = `<pre>${sanitizeJson(userData)}</pre>`;
setSafeInnerHTML(element, jsonHtml);

// Safe text content (always safe)
element.textContent = userInput;

// Safe attribute values
element.setAttribute('title', escapeHtml(userInput));
```

### ❌ DON'T DO THIS
```javascript
// DANGEROUS - Direct innerHTML with user data
element.innerHTML = `<p>${userData}</p>`; // ❌

// DANGEROUS - Unescaped JSON
element.innerHTML = `<pre>${JSON.stringify(data)}</pre>`; // ❌

// DANGEROUS - Direct attribute
element.innerHTML = `<img alt="${userInput}">`; // ❌
```

## Quick Function Guide

### When to Use What

| Use Case | Function | Example |
|----------|----------|---------|
| Display HTML from templates | `setSafeInnerHTML()` | Form cards, modals |
| Display JSON data | `sanitizeJson()` | Submissions, API responses |
| Display plain text | Use `.textContent` | User names, simple values |
| Validate URLs | `sanitizeUrl()` | Webhook URLs, links |
| Escape for attributes | `escapeHtml()` | Already exists, use it |

## Common XSS Vectors to Prevent

```javascript
// These are all BLOCKED by our sanitization:

// 1. Script tags
"<script>alert(1)</script>"

// 2. Event handlers
"<img src=x onerror=alert(1)>"
"<div onclick=alert(1)>Click</div>"

// 3. JavaScript URLs
"<a href='javascript:alert(1)'>Click</a>"

// 4. Data URLs
"<a href='data:text/html,<script>alert(1)</script>'>Click</a>"

// 5. SVG attacks
"<svg onload=alert(1)>"

// 6. Form hijacking
"<form><button formaction='javascript:alert(1)'>Submit</button></form>"
```

## Testing Your Code

### Before Commit
1. Search your code for `innerHTML =`
2. Ensure all innerHTML uses `setSafeInnerHTML()`
3. Test with malicious input: `<script>alert('XSS')</script>`
4. Open `/xss-test.html` and verify all tests pass

### Test Commands
```bash
# Search for unsafe innerHTML usage
grep -n "innerHTML =" static/src/js/dashboard.js

# Should show ONLY setSafeInnerHTML calls
```

## Emergency Response

### If XSS is Reported
1. **Verify**: Try to reproduce with exact payload
2. **Check**: Is it in sanitized code path?
3. **Test**: Run `/xss-test.html` to verify protection
4. **Fix**: If real, add `setSafeInnerHTML()` wrapper
5. **Deploy**: Immediate hotfix if critical

### Debug Mode
```javascript
// Enable DOMPurify hooks for debugging
import { DOMPurify } from './modules/sanitize.js';

DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  console.log('Sanitizing:', data.tagName, node);
});
```

## Code Review Checklist

When reviewing PRs:
- [ ] No direct `innerHTML =` assignments
- [ ] User input is escaped or sanitized
- [ ] JSON output uses `sanitizeJson()`
- [ ] URLs are validated with `sanitizeUrl()`
- [ ] Event handlers are attached via addEventListener, not inline
- [ ] No `eval()` or `Function()` with user input
- [ ] No `setTimeout()` with string arguments

## Resources

- Full docs: `/XSS-PROTECTION-SUMMARY.md`
- Test suite: `/xss-test.html`
- Sanitize module: `/static/src/js/modules/sanitize.js`

---

**Remember**: When in doubt, sanitize! Better safe than sorry.
