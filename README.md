# poc-pwa-share-target

Proof of concept PWA that acts as an intermediary "share normalizer" on Android. Receives inconsistent share data from various apps (Chrome, YouTube, Twitter), normalizes it into clean markdown (`[Title](URL)`), then allows copying or forwarding to Obsidian.

## Quick Start

1. Serve files via HTTPS (e.g., `npx serve`)
2. Open in Chrome on Android and install as PWA ("Add to Home Screen")
3. Share from another app to test normalization

## Platform Limitations

### Android: `url` Parameter Always Empty

On Android, the `url` query parameter in share target requests is **always null**. This is [documented behavior by Google](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target):

> "On Android, the url field will be empty because it's not supported in Android's share system."

The [W3C spec](https://w3c.github.io/web-share-target/) confirms this is by design—Android's Intent system puts URLs in the `text` field.

**Our solution:** Extract URLs from `text` using regex (see [app.js](app.js)).

### iOS: Not Supported

iOS Safari does not support the Web Share Target API. PWAs on iOS cannot register as share targets.

## Documentation

- [POC Validation Spec](docs/plan/poc-spec.md) — Technical validation criteria and results
- [Copilot Instructions](.github/copilot-instructions.md) — Development context for AI assistants
