# Brainstorm: PWA Share Target for Obsidian Link Formatting

**Date:** 2026-01-24  \
**Status:** Captured  \
**Origin:** Voice memo transcription and synthesis  \
**Purpose:** Preserve problem analysis and solution concepts for future reference

---

## Problem Statement

When sharing links from mobile apps (YouTube, Chrome, Twitter, etc.) to
Obsidian on Android, the resulting markdown is malformed or unreadable. Links
appear as raw URLs without titles, often shortened URLs that convey no meaning
to human readers.

The root cause is twofold:

1. **Obsidian's behavior:** Current Android version ignores the `title` field
   in share payloads, using only `text` and `url`
2. **Source app inconsistency:** Different apps populate `title`, `text`, and
   `url` fields inconsistently

---

## Platform Behavior Analysis

### Windows: Clipboard-Based Workflow

The Windows workflow is fundamentally different—it relies on clipboard, not
share UI.

**Edge browser behavior:**

- Copying URL from address bar places multiple MIME types on clipboard
- Includes page title as metadata
- Obsidian detects this and pastes formatted `[Title](URL)` markdown

**Chrome/Firefox behavior:**

- Copy only the raw URL string
- Obsidian pastes as unformatted link

**Windows Share UI:**

- Obsidian does *not* register as a share target on Windows
- Only Firefox exposes share UI (right-click tab → Share)
- PWAs *can* register as share targets on Windows (Edge-based)

**Conclusion:** The "correct" behavior on Windows is Edge clipboard magic, not
Obsidian share handling.

### Android: Share-Based Workflow

**Obsidian share target behavior:**

- Registers as share target (appears in share sheet)
- Ignores `title` field entirely
- Uses `text` and `url` fields only
- Result: malformed or title-less links

**Source app inconsistency:**

| App | Title Field | Text Field | URL Field |
|-----|-------------|------------|-----------|
| Chrome | Page title | Description | URL |
| YouTube | Video title | (varies) | URL |
| Twitter | (varies) | Tweet text + URL | (empty) |
| Others | Unpredictable | Unpredictable | Unpredictable |

---

## Solution Concept: Intermediary PWA

Instead of waiting for Obsidian to fix their share handler, build a PWA that
normalizes incoming share data before relaying to Obsidian.

### Core Concept: The Normalizer

```text
[Source App] → [PWA Normalizer] → [Obsidian]
     ↓              ↓                  ↓
  messy data    clean markdown     pastes correctly
```

**Key insight:** Obsidian correctly handles the `text` field content as-is. If
we place pre-formatted markdown (`[Title](URL)`) in the `text` field and leave
`title` and `url` empty, Obsidian will paste it correctly.

### Normalization Logic

1. **Ingest:** Receive `title`, `text`, `url` from share payload
2. **Extract:** Find actual URL (may be in `url` or embedded in `text`)
3. **Extract:** Find actual title (may be in `title` or embedded in `text`)
4. **Format:** Construct `[Title](URL)` markdown string
5. **Relay:** Share to Obsidian with markdown in `text` field only

---

## Extended Capabilities (Future MVP)

### URL Resolution

Resolve shortened URLs to final destination:

- bit.ly, t.co, youtu.be → actual URLs
- Follow HTTP redirects to capture final destination
- Store meaningful URLs instead of opaque shortcuts

**Edge case:** JavaScript-based redirects cannot be resolved via simple HTTP
fetch. May require headless browser or accept as limitation.

### Metadata Enrichment

Fetch additional information from target page:

- Page description (meta tags)
- Open Graph data (og:title, og:description, og:image)
- Structured data if available

Compose richer markdown entries with descriptions, not just title+URL.

### Multi-Target Relay

Support sharing to multiple destinations:

- Obsidian (primary)
- Raindrop.io (bookmarking)
- Custom endpoints
- Local log/history

### Bulk Legacy Cleanup

Address existing Obsidian notes with broken links:

- Accept markdown file as input
- Scan for raw URLs (especially shortened)
- Resolve to final destinations
- Fetch page titles
- Replace raw URLs with formatted `[Title](URL)`
- Optionally generate footnotes with metadata

**Scale:** Potentially hundreds of existing documents need cleanup.

---

## Strategic Sequencing

### Phase 1: POC (Immediate)

Validate technical feasibility with minimal code:

- Can PWA register as share target?
- Can we receive and parse share data?
- Can we relay to Obsidian successfully?
- Can we resolve HTTP redirects?

**Deliverable:** Working prototype, answers to technical questions

### Phase 2: MVP (After POC Validation)

Build usable product in dedicated repo:

- Clean UI for share handling
- URL resolution
- Basic normalization
- Obsidian relay

**Deliverable:** Deployed PWA, public GitHub repo

### Phase 3: Obsidian Bug Report

File issue *after* MVP exists:

- Reference PWA as reproduction case
- Demonstrate correct share handling
- Offer PWA as temporary workaround for other users

### Phase 4: Extended Features

Based on validated MVP:

- Metadata enrichment
- Multi-target relay
- Bulk file processing
- Local history

---

## Open Questions

1. **JavaScript redirects:** How to handle URLs that redirect via client-side
   script? (May require headless browser or accept as out-of-scope)

2. **Obsidian fix timeline:** If Obsidian fixes their share handler, does PWA
   still have value? (Yes—normalization and enrichment remain useful)

3. **Windows PWA:** Should MVP support Windows share target? (Lower priority
   since clipboard workflow exists, but technically feasible)

4. **Offline capability:** Should PWA work offline? (URL resolution requires
   network, but could queue for later processing)

---

## Related Documents

- [POC Specification](poc-spec.md) - Technical validation scope
- Original source: `problem-and-roadmap.md` (raw transcript)
