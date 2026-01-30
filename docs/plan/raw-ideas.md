# Raw Ideas to Consider

- Add as task button/option
  - using Tasks plugin URI scheme
    - `obsidian://tasks?text=...&due=...&priority=...`
  - format markdown as task
    - `- [ ] [Title](URL)`
- Add tags option
- Allow choosing between daily note vs new note
- Support multiple vaults (vault selector UI)
- Support custom templates for new notes
  - Auto selected template based on URL domain?
- Fetch page metadata (description, images) for richer notes

## Higher Priority

- Architecture for unrolling URL shorteners and other redirects
  - Use fetch with `redirect: 'follow'` to resolve final URL
  - Server side function if CORS blocks client-side fetch
  - Server side function to fetch page title if missing
  - How to handle redirects from services that require JavaScript (e.g., linktr.ee)?
  - How to handle file URLs or non-HTTP(S) schemes?
  - Handle common shorteners (bit.ly, t.co, etc.)

## Problems / Questions to Answer

- I have yet to see a single app that populates the `url` param in share target. Why? Is something broken in my PWA config? Or do apps just not do this?

- [ ] investigate length limits on protocols used (URI s, URI parameters, etc.)
  - we get URI too long error in POC app when sharing Gemini DR report
- [ ] investigate how Obsidian handles large content inserts via URI (e.g., long articles)
