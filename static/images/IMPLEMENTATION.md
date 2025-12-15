# Social Share Image Implementation Guide

## Files Created
- `/static/images/share-image.svg` - The social share image (1200x630)
- `/static/images/share-image-preview.html` - Preview the image in browser
- `/static/images/PNG_CONVERSION_GUIDE.md` - Guide to create PNG version

## Hugo Template Implementation

### In your `<head>` section (layouts/partials/head.html or base template):

```html
<!-- Open Graph / Facebook -->
<meta property="og:type" content="website">
<meta property="og:url" content="{{ .Permalink }}">
<meta property="og:title" content="{{ .Title }} | VeilForms">
<meta property="og:description" content="{{ with .Description }}{{ . }}{{ else }}Client-side encrypted forms. Zero-knowledge form submissions. Privacy by design.{{ end }}">
<meta property="og:image" content="{{ "images/share-image.svg" | absURL }}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="VeilForms - Client-Side Encrypted Forms">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:url" content="{{ .Permalink }}">
<meta name="twitter:title" content="{{ .Title }} | VeilForms">
<meta name="twitter:description" content="{{ with .Description }}{{ . }}{{ else }}Client-side encrypted forms. Zero-knowledge form submissions. Privacy by design.{{ end }}">
<meta name="twitter:image" content="{{ "images/share-image.svg" | absURL }}">
<meta name="twitter:image:alt" content="VeilForms - Client-Side Encrypted Forms">

<!-- LinkedIn (uses Open Graph) -->
<meta property="og:site_name" content="VeilForms">
```

## Testing Your Implementation

### 1. Preview in Browser
Open: `file:///Users/jasonsutter/Documents/Companies/VeilForms/veilforms/static/images/share-image-preview.html`

### 2. Test Social Media Cards

Once deployed, test with these tools:

**Twitter Card Validator:**
https://cards-dev.twitter.com/validator

**Facebook Sharing Debugger:**
https://developers.facebook.com/tools/debug/

**LinkedIn Post Inspector:**
https://www.linkedin.com/post-inspector/

**Generic OG Debugger:**
https://www.opengraph.xyz/

### 3. Force Cache Refresh
If you update the image, social platforms cache aggressively. To force refresh:
- Add query parameter: `share-image.svg?v=2`
- Or use the debugger tools above to scrape fresh

## Design Decisions

### Colors Used
- Background: `#0a0a0a` (VeilForms dark)
- Primary purple: `#6366f1` (Indigo 500)
- Secondary purple: `#4f46e5` (Indigo 600)
- Light purple: `#818cf8` (Indigo 400)
- Gray text: `#a1a1aa` (Zinc 400)
- Darker gray: `#71717a` (Zinc 500)
- Success green: `#22c55e` (for "Open Source" badge)

### Typography Scale
- Logo: 96px, bold (font-weight: 700)
- Tagline: 32px, regular (font-weight: 400)
- Subheadline: 24px, light (font-weight: 300)
- Badge text: 14px, medium (font-weight: 500)

### Visual Hierarchy
1. **VeilForms logo** (largest, purple/white contrast)
2. **Shield with lock** (visual anchor, encryption metaphor)
3. **Tagline** (clear value proposition)
4. **Animated data flow** (shows encryption in action)
5. **Subheadline** (additional context)
6. **Open Source badge** (trust signal)

### Accessibility Features
- High contrast text (white on dark meets WCAG AAA)
- System font stack for universal rendering
- Clear visual hierarchy
- Meaningful alt text provided in meta tags

## SVG vs PNG for Social Media

### SVG Advantages (Current Implementation)
- Sharp at any size
- Small file size (~5KB)
- Easy to update/maintain
- Vector graphics scale perfectly

### SVG Limitations
- Some platforms may not support animations
- Twitter historically had mixed SVG support
- Some social scrapers prefer PNG

### Recommendation
1. Keep SVG as source of truth
2. Generate PNG for maximum compatibility (see PNG_CONVERSION_GUIDE.md)
3. Update meta tags to use PNG: `share-image.png`
4. Regenerate PNG when you update the SVG

## Next Steps

1. **Preview the SVG**: Open `share-image-preview.html` in your browser
2. **Convert to PNG**: Follow guide in `PNG_CONVERSION_GUIDE.md`
3. **Add meta tags**: Update your Hugo base template
4. **Deploy**: Push to production
5. **Test**: Use social media debugger tools
6. **Monitor**: Check how it looks when shared on HN, Twitter, LinkedIn
