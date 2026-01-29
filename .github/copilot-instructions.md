# Copilot Instructions for poc-pwa-share-target

## Project Overview

A **Proof of Concept PWA** that acts as an intermediary "share normalizer" on Android. It receives inconsistent share data from various apps (Chrome, YouTube, Twitter), normalizes it into clean markdown (`[Title](URL)`), then allows copying or forwarding to Obsidian.

**Architecture Flow:**
```
[Source App] → Share → [This PWA] → Normalize → [Obsidian/Clipboard]
```

## Key Files

| File | Purpose |
|------|---------|
| [manifest.json](../manifest.json) | PWA manifest with `share_target` configuration—defines how Android share sheet data is received via GET params |
| [app.js](../app.js) | Core normalization logic—parses URL params, extracts URL/title from inconsistent fields, formats markdown |
| [index.html](../index.html) | Minimal UI with textarea output and action buttons; registers service worker |
| [sw.js](../sw.js) | Minimal service worker (pass-through fetch) required for PWA installability |

## Critical Patterns

### Share Data Normalization
Apps send share data inconsistently—the URL may be in `url` OR embedded in `text`. The normalization logic in [app.js](../app.js) prioritizes the `url` param, then extracts from `text` using regex:
```javascript
const urlRegex = /(https?:\/\/[^\s]+)/g
if (sharedUrl) { finalUrl = sharedUrl }
else if (sharedText) { const match = sharedText.match(urlRegex); if (match) finalUrl = match[0] }
```

### PWA Share Target Config
The `share_target` in [manifest.json](../manifest.json) uses GET method—share data arrives as URL query params (`?title=...&text=...&url=...`).

## Development Workflow

**Testing requires a real Android device or emulator:**
1. Serve files via HTTPS (required for PWA installation)—use `npx serve` or similar
2. Open in Chrome on Android and install as PWA ("Add to Home Screen")
3. Share from another app (YouTube, Chrome) to test normalization
4. Debug by checking the `#debugLog` div which shows raw input params

**No build step**—this is vanilla HTML/JS/CSS. Edit and refresh.

## Current Limitations (POC Scope)

- No offline caching (service worker is minimal pass-through)
- No URL redirect resolution (shortened URLs like `bit.ly` stay shortened)
- Obsidian integration is clipboard-based workaround (copies then opens app)
- No error handling beyond debug logging

## Future Direction

See [docs/plan/poc-spec.md](../docs/plan/poc-spec.md) for validation criteria and [docs/plan/brainstorm-pwa-share-target.md](../docs/plan/brainstorm-pwa-share-target.md) for the full problem analysis. If POC succeeds, MVP will add:
- Proper Obsidian URI integration
- URL redirect resolution
- Metadata enrichment
- Multi-target relay (Raindrop, etc.)
