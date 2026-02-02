# Share Source Test

Test pages for validating the Link2MD PWA share target functionality.

## Quick Start

```bash
# Start local server
npx live-server

# In another terminal, expose via HTTPS (required for Web Share API)
ngrok http 8080
```

Open the ngrok HTTPS URL on your Android device, then use the share buttons to test sharing to the Link2MD PWA.

## Files

- **index.html** — Minimal test page with share buttons and custom data inputs

## What Gets Tested

The test page uses `navigator.share()` with:

- `title` — Page title or custom value
- `url` — Page URL or custom value
- `text` — Optional custom text

**Expected result:** On Android, the PWA will receive:

- ✅ `title` parameter populated
- ✅ `text` parameter populated (may contain URL)
- ❌ `url` parameter **always null** ([Android limitation](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target))

The Link2MD PWA extracts URLs from the `text` field via regex, which is the correct solution for this platform limitation.
