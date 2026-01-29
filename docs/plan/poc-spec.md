# POC: PWA Share Target Technical Validation

**Date:** 2026-01-24  \
**Status:** ✅ Validated  \
**Purpose:** Validate technical feasibility before investing in MVP architecture

---

## Validation Results

| Question | Result | Notes |
|----------|--------|-------|
| Q1: Share Target Registration | ✅ Pass | PWA appears in Android share sheet after installation |
| Q2: Data Reception | ✅ Pass | Successfully logs `title`, `text`, `url` from Chrome, YouTube, Twitter/X |
| Q3: Outbound Relay to Obsidian | ✅ Pass | Clipboard workaround works; Obsidian URI integration in progress |
| Q4: URL Redirect Resolution | ⏸️ Deferred | Not implemented in POC; acceptable per success criteria |

**Implementation Note:** The current `sendToObsidian()` uses a clipboard workaround (copy + open Obsidian) rather than the spec's `navigator.share({ text: markdown })`. This works but Obsidian URI integration (`obsidian://daily?content=...&append`) is the preferred approach for MVP.

---

## Objective

Confirm that a Progressive Web App can:

1. Register as a share target on Android
2. Receive share data (title, URL, text) from other apps
3. Normalize inconsistent incoming data
4. Relay formatted content to Obsidian via share

This POC answers technical questions only. It is not the product.

---

## Technical Questions to Answer

### Q1: Share Target Registration

**Question:** Can a PWA register as a share target on Android?

**Validation:** App appears in Android share sheet when sharing from Chrome/YouTube.

**Known:** Yes, this is documented capability. Confirm it works in practice.

### Q2: Data Reception

**Question:** What data fields are populated when receiving shares from various
apps?

**Validation:** Log incoming `title`, `text`, and `url` fields from:

- Chrome (web page)
- YouTube (video)
- Twitter/X (post)
- LinkedIn (post)

**Expected finding:** Inconsistent field usage across apps.

### Q3: Outbound Relay to Obsidian

**Question:** Can we share *to* Obsidian with controlled field content?

**Validation:** Construct a share payload with formatted markdown in `text`
field only, invoke share to Obsidian, confirm it pastes correctly.

**Critical:** This is the core hypothesis—that placing `[Title](URL)` in the
`text` field (with empty `title` and `url`) produces correct Obsidian behavior.

### Q4: URL Redirect Resolution

**Question:** Can we resolve shortened URLs (bit.ly, youtu.be, etc.) to final
destination?

**Validation:** Fetch URL, follow redirects, capture final URL.

**Edge case:** JavaScript-based redirects may not resolve via simple HTTP
fetch. Document which URL types work and which don't.

---

## Out of Scope for POC

- Polished UI
- Metadata enrichment (fetching page descriptions, images)
- Multi-target relay (Raindrop, etc.)
- Local history/logging
- Bulk file processing
- Windows share target (defer to MVP)
- Error handling beyond basic logging

---

## Success Criteria

| Question | Success | Failure |
|----------|---------|---------|
| Q1 | PWA appears in share sheet | Does not appear |
| Q2 | Can log all three fields from 2+ apps | Cannot access share data |
| Q3 | Obsidian renders `[Title](URL)` correctly | Obsidian ignores or mangles content |
| Q4 | HTTP redirects resolve | Cannot follow redirects |

**Overall:** If Q1-Q3 succeed, proceed to MVP. Q4 failure is acceptable (can be
deferred or worked around).

---

## Minimal Implementation

### Required Files

```text
poc-pwa-share/
├── index.html          # Minimal UI (display received data, trigger relay)
├── manifest.json       # PWA manifest with share_target configuration
├── sw.js               # Service worker (required for installable PWA)
└── app.js              # Core logic (receive, normalize, relay)
```

### Key Manifest Configuration

```json
{
  "share_target": {
    "action": "/share",
    "method": "GET",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url"
    }
  }
}
```

### Core Logic (Pseudocode)

```javascript
// 1. Parse incoming share data from URL params
const title = params.get('title');
const text = params.get('text');
const url = params.get('url');

// 2. Normalize: extract URL from wherever it landed
const actualUrl = url || extractUrlFrom(text);
const actualTitle = title || extractTitleFrom(text) || 'Untitled';

// 3. Format markdown
const markdown = `[${actualTitle}](${actualUrl})`;

// 4. Relay to Obsidian (text field only)
navigator.share({ text: markdown });
```

---

## Next Steps

### Completed

- ✅ Q1-Q3 validated—PWA receives share data and normalizes correctly
- ✅ Clipboard workaround functional for Obsidian relay

### In Progress

- 🔄 Local history logging—store share data in localStorage for analysis
- 🔄 Obsidian URI integration—use `obsidian://daily?content=...&append` for direct relay

### Future (MVP)

- Proper Obsidian URI integration with vault selection
- URL redirect resolution for shortened URLs
- Metadata enrichment (page descriptions, Open Graph data)
- Multi-target relay (Raindrop, etc.)
- Polished UI in separate repo

---

## References

- [Web Share Target API](https://developer.mozilla.org/en-US/docs/Web/Manifest/share_target)
- [PWA Installation Requirements](https://web.dev/install-criteria/)
- Original brainstorm: [brainstorm-pwa-share-target.md](brainstorm-pwa-share-target.md)
