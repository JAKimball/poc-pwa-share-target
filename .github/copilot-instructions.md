# Copilot Instructions for poc-pwa-share-target

## Project Overview

A **validated PWA prototype** that acts as an intermediary "share normalizer" on Android. It receives inconsistent share data from various apps (Chrome, YouTube, Twitter), normalizes it into clean markdown (`[Title](URL)`), then allows copying or forwarding to Obsidian.
**Status:** POC validated ✓ — technically proven and useful as-is. A polished MVP will be developed in a separate repo; this repo remains an **experimentation platform** for quick feature testing without UI polish overhead.
**Architecture Flow:**

```text
[Source App] → Share → [This PWA] → Normalize → [Obsidian/Clipboard]
```

## Key Files

| File                              | Purpose                                                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [manifest.json](../manifest.json) | PWA manifest with `share_target` configuration—defines how Android share sheet data is received via GET params |
| [app.js](../app.js)               | Core normalization logic—parses URL params, extracts URL/title from inconsistent fields, formats markdown      |
| [index.html](../index.html)       | Minimal UI with textarea output and action buttons; registers service worker                                   |
| [sw.js](../sw.js)                 | Minimal service worker (pass-through fetch) required for PWA installability                                    |

## Critical Patterns

### Share Data Normalization

Apps send share data inconsistently—the URL may be in `url` OR embedded in `text`. The normalization logic in [app.js](../app.js) prioritizes the `url` param, then extracts from `text` using regex:

```javascript
const urlRegex = /(https?:\/\/[^\s]+)/g
if (sharedUrl) {
  finalUrl = sharedUrl
} else if (sharedText) {
  const match = sharedText.match(urlRegex)
  if (match) finalUrl = match[0]
}
```

### PWA Share Target Config

The `share_target` in [manifest.json](../manifest.json) uses GET method—share data arrives as URL query params (`?title=...&text=...&url=...`).

## Obsidian URI Integration

Reference: [Obsidian URI](https://help.obsidian.md/Extending+Obsidian/Obsidian+URI)

**Key actions to explore:**

| Action  | URI Pattern                                     | Use Case                                     |
| ------- | ----------------------------------------------- | -------------------------------------------- |
| `daily` | `obsidian://daily?vault=...&content=...&append` | Append link to daily note (primary interest) |
| `new`   | `obsidian://new?vault=...&name=...&content=...` | Create new note with content                 |
| `open`  | `obsidian://open?vault=...&file=...`            | Open specific note                           |

**Critical parameters:**

- `content` — the markdown to insert (must be URI encoded)
- `append` — add to end of file (for daily notes)
- `vault` — vault name or 16-char vault ID (optional in POC—uses last focused vault; MVP will need proper vault selection)

**Example for daily note append:**

```javascript
const markdown = `[${title}](${url})`
// Omit vault param for POC (uses last focused); omit silent to see note as confirmation
const uri = `obsidian://daily?content=${encodeURIComponent(markdown)}&append`
window.location.href = uri
```

## Development Workflow

**Testing requires a real Android device or emulator:**

1. Serve files via HTTPS (required for PWA installation)—use `npx serve` or similar
2. Open in Chrome on Android and install as PWA ("Add to Home Screen")
3. Share from another app (YouTube, Chrome) to test normalization
4. Debug by checking the `#debugLog` div which shows raw input params

**No build step**—this is vanilla HTML/JS/CSS. Edit and refresh.

## Local History Logging

Share data is logged to localStorage (`shareLog` key) for analysis. Each entry includes:

- `timestamp`, `sharedTitle`, `sharedText`, `sharedUrl` — raw inputs from share
- `finalTitle`, `finalUrl` — normalized outputs

The log has a rolling limit of 100 entries. Use "Export Log to Obsidian" to create a note with the full log as a JSON code block, or "Clear Log" to reset.

## Known Platform Limitations

### Android `url` Parameter Always Null (By Design)

On Android, the `url` query parameter in share target requests is **always empty**. This is documented behavior, not a bug:

> "For example, on Android, **the url field will be empty because it's not supported in Android's share system**." — [Chrome for Developers](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target)
>
> "The host share system may not have a dedicated URL field, but a convention that both plain text and URLs are sometimes transmitted in a 'text' field. **This is the case on Android**." — [W3C Web Share Target API Spec](https://w3c.github.io/web-share-target/)

**Why this happens:** Android's Intent system uses `EXTRA_TEXT` for both text and URLs—there's no separate URL field. When Chrome translates Web Share data to an Android Intent, the URL gets placed in `text`, not `url`.

**Solution:** Extract URLs from the `text` field using regex (already implemented in [app.js](../app.js)).

### iOS Does Not Support Web Share Target API

iOS Safari **does not support the Web Share Target API** at all. PWAs on iOS cannot register as share targets.

> "It's impossible to capture URLs on PWAs installed on iOS and iPadOS from Safari." — [web.dev](https://web.dev/learn/pwa/os-integration)

This means Obsidian on iOS uses a different mechanism (native share extensions), not the Web Share Target API.

### POST Method Has Same Android Limitation

Using `method: "POST"` instead of `method: "GET"` does **not** fix the `url` parameter issue. The limitation is in Android's Intent system, not the HTTP method.

## Current Limitations

- No offline caching (service worker is minimal pass-through)
- No URL redirect resolution (shortened URLs stay shortened)
- No error handling beyond debug logging
- Vault name currently not configurable (would need settings UI)

## Markdown Style Guide

This project follows the markdown conventions from [JAKimball/ai-collaboration-guides](https://github.com/JAKimball/ai-collaboration-guides):

- **Style Essentials:** [style-essentials.md](https://github.com/JAKimball/ai-collaboration-guides/blob/main/markdown/style-essentials.md) — Core formatting conventions
- **Code Blocks:** [code-blocks.md](https://github.com/JAKimball/ai-collaboration-guides/blob/main/markdown/code-blocks.md) — Fenced blocks, language tags, nesting
- **Linter Config:** [.markdownlint.jsonc](../.markdownlint.jsonc) — Automated validation rules
  **Key Rules:**

- Line length: 80 chars for prose (code/tables exempt)
- Hard breaks: Use backslash (`\`), not two trailing spaces
- Lists: Use hyphens (`-`) for unordered
- Blank lines: One line around headings, lists, code blocks
- Code blocks: Always use fenced with language tags (never empty)
- Headings: ATX-style (`#`), hierarchical (no skipping levels)

## Planning Documents

- [docs/plan/poc-spec.md](../docs/plan/poc-spec.md) — Original validation criteria (all passed)
- [docs/plan/brainstorm-pwa-share-target.md](../docs/plan/brainstorm-pwa-share-target.md) — Full problem analysis and MVP roadmap
