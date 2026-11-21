# SnapForge

> **Featherweight Screenshot, PII Blur Annotator & Tab Recorder**

A fast, privacy-first Chrome Manifest V3 extension built by **ARIS PARTY LLC** to outperform **Scrnli Screen Recorder & Screenshot** (`ijejnggjjphlenbhmjhhgcdpehhacaal`, 1M+ users, 4.8★).

## Competitive Advantages
- Replaces Scrnli (1M users, 13.1MB bloated bundle with debugger permission & FingerprintJS)
- Over 200x smaller (~60KB vs 13.1MB) with instant popup load and zero browser slowdown
- First-class PII Blur/Redact tool for safe bug reports and documentation screenshots
- Transparent 1-click audio toggle for tab/screen recordings

## Free vs SnapForge Pro
### Free
- Instant visible-tab and drag-to-select region screenshot capture
- Built-in crisp canvas editor: Arrow, Rectangle, Freehand, Text, Highlighter, and PII Pixelate/Blur
- Undo/Redo stack, 1-click Copy to Clipboard, and instant PNG download
- Zero debugger permission warnings and zero FingerprintJS tracking

### Pro (Monetized via Stripe)
- Full-page scrolling screenshot capture & automatic vertical stitch
- Built-in tab/screen WebM video recorder with 1-click tab/mic audio toggle
- Numbered step callouts & gradient showcase padding frames
- WebP / JPEG / print-to-PDF export & local capture gallery

| Plan | Price | Stripe Product / Price ID | Live Checkout Link |
|---|---|---|---|
| Monthly | $2.99/mo | `price_1UeE3HFtqvN4GZH3eenTsoXa` | [Checkout](https://buy.stripe.com/4gM7sLfnVbS92TRcD0g3605) |
| Yearly | $19.99/yr | `price_1UeE49FtqvN4GZH3ZhPFviQZ` | [Checkout](https://buy.stripe.com/00w9ATgrZ7BT7a7auSg360f) |
| Lifetime | $29.99 one-time | `price_1UeE5PFtqvN4GZH3ACgjpTVz` | [Checkout](https://buy.stripe.com/3cI3cvfnV4pH51Z1Ymg360p) |

- **Stripe Product ID:** `prod_VfZA1TFydJxw96`

## Local Installation (Chrome)
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this repository root

## Verification & Chrome Web Store Packaging
```bash
node tests/verify.mjs .
```
Outputs a store-ready archive at `dist/snapforge-extension-v1.0.0.zip`.
