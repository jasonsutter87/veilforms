# VeilForms Images

## Required Images

Before deploying, convert the SVG files to proper formats:

### share-image.jpg (1200x630)
Social media sharing image for Open Graph and Twitter Cards.

Convert from SVG:
```bash
# Using ImageMagick
convert share-image.svg -quality 90 share-image.jpg

# Or using librsvg
rsvg-convert share-image.svg -o share-image.png && convert share-image.png -quality 90 share-image.jpg
```

### favicon.ico (32x32, 16x16)
Browser favicon. The SVG version works for modern browsers.

Convert from SVG:
```bash
# Multi-size ICO
convert ../favicon.svg -resize 16x16 favicon-16.png
convert ../favicon.svg -resize 32x32 favicon-32.png
convert favicon-16.png favicon-32.png favicon.ico
```

### apple-touch-icon.png (180x180)
iOS home screen icon.

Convert from SVG:
```bash
convert ../favicon.svg -resize 180x180 apple-touch-icon.png
```

## Logo
Place your logo.png file here for JSON-LD structured data.
