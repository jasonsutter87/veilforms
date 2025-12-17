# Converting share-image.svg to PNG

Since you don't have SVG conversion tools installed locally, here are several options to create a PNG version:

## Option 1: Online Converter (Quickest)
1. Visit: https://cloudconvert.com/svg-to-png
2. Upload `share-image.svg`
3. Set output dimensions to 1200x630
4. Download as `share-image.png`

## Option 2: Browser Method (No tools needed)
1. Open `share-image-preview.html` in Chrome/Firefox
2. Right-click on the image → "Save image as..."
3. Note: Some browsers may save as SVG, not PNG

## Option 3: Install rsvg-convert (Recommended for automation)
```bash
# macOS with Homebrew
brew install librsvg

# Then convert
rsvg-convert -w 1200 -h 630 share-image.svg -o share-image.png
```

## Option 4: Install ImageMagick
```bash
# macOS with Homebrew
brew install imagemagick

# Then convert
convert -background none -resize 1200x630 share-image.svg share-image.png
```

## Option 5: Use Inkscape (GUI or CLI)
```bash
# macOS with Homebrew
brew install --cask inkscape

# Command line
inkscape share-image.svg --export-type=png --export-width=1200 --export-height=630
```

## Option 6: Node.js Script
If you have Node.js installed:

```bash
npm install -g sharp-cli
sharp -i share-image.svg -o share-image.png resize 1200 630
```

## Why PNG?
While modern social platforms support SVG, PNG ensures:
- Universal compatibility (Twitter, Facebook, LinkedIn, etc.)
- Faster processing by social media scrapers
- Consistent rendering across all platforms
- No JavaScript/animation concerns (social platforms strip animations anyway)

## Recommended Workflow
1. Keep `share-image.svg` as the source of truth (editable, scalable)
2. Generate `share-image.png` for production use
3. Use PNG in your Open Graph meta tags
4. Regenerate PNG whenever you update the SVG

## File Size Expectations
- SVG: ~5-6 KB (current)
- PNG: ~50-150 KB (typical for this design)
- Both are well within social media limits (usually 5-8 MB)
