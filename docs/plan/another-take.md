# MVP PWA Specification: Share Target Normalizer

This is a fantastic project. You are absolutely right that **Share Targets**
in a PWA are the cleanest way to solve this Android-to-Obsidian friction
without building a native Android app.

Also, regarding your audio workflow: **The compression worked perfectly.**
The transcript is coherent, detailed, and the technical nuance (about
`share_target` registration and CORS/Redirection limitations) was preserved.
Your "Semantic Compression" theory is validated.

Here is the blueprint and code for the **MVP PWA** to act as your
"middleware" between Android Browsers and Obsidian.

## The Architecture

1. **The Manifest:** Registers the app as a share target so it appears in
   the Android Share Sheet.
2. **The Parser:** Extracts the URL and Title from the messy data different
   apps send (some send the URL in `text`, some in `url`, some in `title`).
3. **The Formatter:** Constructs the `[Title](URL)` string.
4. **The Output:** Provides a "Copy to Clipboard" button and an "Open in
   Obsidian" button (using the Obsidian URI scheme).

### File 1: `manifest.json`

This is the most critical file. It tells Android "I accept text and URLs."

```json
{
  "name": "Link to Markdown",
  "short_name": "Link2MD",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#1e1e1e",
  "theme_color": "#7b68ee",
  "icons": [
    {
      "src": "icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "share_target": {
    "action": "./index.html",
    "method": "GET",
    "enctype": "application/x-www-form-urlencoded",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url"
    }
  }
}
```

### File 2: `index.html`

The UI. Minimalist, dark mode (to match Obsidian).

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Link to MD</title>
    <link rel="manifest" href="manifest.json">
    <style>
        body { background-color: #1e1e1e; color: #dcddde; font-family: sans-serif; padding: 20px; display: flex; flex-direction: column; gap: 15px; }
        textarea { width: 100%; height: 150px; background: #2f2f2f; color: #fff; border: 1px solid #444; padding: 10px; font-family: monospace; border-radius: 8px; }
        button { padding: 15px; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; }
        .btn-copy { background-color: #7b68ee; color: white; }
        .btn-obsidian { background-color: #483699; color: white; }
        .debug { font-size: 12px; color: #666; margin-top: 20px; }
    </style>
</head>
<body>

    <h3>Markdown Link</h3>
    <textarea id="output"></textarea>

    <button class="btn-copy" onclick="copyToClipboard()">Copy to Clipboard</button>
    <button class="btn-obsidian" onclick="sendToObsidian()">Send to Obsidian</button>

    <div class="debug" id="debugLog">Waiting for shared data...</div>

    <script src="app.js"></script>
    <script>
        // Simple Service Worker Registration for PWA installability
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js');
        }
    </script>
</body>
</html>
```

### File 3: `app.js`

This contains the logic to normalize the inputs. As you noted in your
recording, Chrome, YouTube, and Twitter all populate the share fields
differently.

```javascript
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);

    // 1. Extract raw parameters
    const sharedTitle = params.get('title');
    const sharedText = params.get('text');
    const sharedUrl = params.get('url');

    // Debugging log (useful during dev to see what apps send what)
    const debugEl = document.getElementById('debugLog');
    debugEl.innerText = `Raw Inputs:\nTitle: ${sharedTitle}\nText: ${sharedText}\nURL: ${sharedUrl}`;

    // 2. Logic to find the actual URL and Title
    let finalUrl = '';
    let finalTitle = '';

    // Regex to extract a URL from a string (for apps that put the URL inside 'text')
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    // Prioritize the dedicated URL field
    if (sharedUrl) {
        finalUrl = sharedUrl;
    } else if (sharedText) {
        // Fallback: Check if the URL is hiding in the text field (common in Twitter/X)
        const match = sharedText.match(urlRegex);
        if (match) finalUrl = match[0];
    }

    // Determine Title
    if (sharedTitle) {
        finalTitle = sharedTitle;
    } else if (sharedText && sharedText !== finalUrl) {
        // If text exists and isn't just the URL, use it as title (cleaning out the URL)
        finalTitle = sharedText.replace(finalUrl, '').trim();
    } else {
        finalTitle = 'Untitled Page';
    }

    // Clean up title (remove trailing separators common in shares like " - YouTube")
    finalTitle = finalTitle.replace(/[\s-]*$/, '');

    // 3. Construct Markdown
    // If we have no URL, don't make a link
    const markdown = finalUrl ? `[${finalTitle}](${finalUrl})` : sharedText || "";

    document.getElementById('output').value = markdown;
});

function copyToClipboard() {
    const copyText = document.getElementById("output");
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value).then(() => {
        alert("Copied!");
    });
}

function sendToObsidian() {
    const content = document.getElementById("output").value;
    // Uses the "new" action to create a note, or append.
    // For now, let's just use the URI to create a new generic note or append to daily note if you use Advanced URI plugin.
    // Simple version: Open Obsidian (user can then paste).
    // Advanced version: window.location.href = `obsidian://new?content=${encodeURIComponent(content)}`;

    // Let's try to copy first, then open Obsidian
    copyToClipboard();
    setTimeout(() => {
        window.location.href = "obsidian://open";
    }, 500);
}
```

### File 4: `sw.js` (Service Worker)

Required for the "Install App" banner to appear on Android.

```javascript
self.addEventListener('fetch', (event) => {
    // Basic pass-through, required for PWA installability criteria
    event.respondWith(fetch(event.request));
});
```

---

### How to Deploy & Test (The MVP Path)

1. **Hosting:** Create a GitHub Repository. Enable **GitHub Pages**
   (Settings -> Pages -> Source: Main).
2. **Installation:**
    * Open the GitHub Pages URL on your Android phone (e.g., `https://yourname.github.io/link2md/`).
    * Tap the browser menu -> **"Install App"** or **"Add to Home Screen"**.
3. **Usage:**
    * Go to YouTube or Chrome.
    * Share a link.
    * Look for "Link2MD" (or whatever name you set) in the Android Share Sheet.
    * It should open your PWA with the parameters populated in the URL
      bar, and the text area formatted as `[Title](URL)`.

### Addressing the "Difficult" Features (CORS & Redirection)

You mentioned unwrapping short URLs (e.g., `t.co` -> `nytimes.com`).

**The Problem:** You cannot do this securely in client-side JavaScript
(the PWA) because of **CORS** (Cross-Origin Resource Sharing). If your PWA
tries to `fetch('https://bit.ly/xyz')` to see the redirect, the browser
will block it because `bit.ly` does not send the headers allowing your
domain to read the response.

**The Solution (Phase 2):**
To handle redirects and fetch page titles for bare URLs, you will need a
tiny backend. Since you want to keep this lightweight:

1. Use **Vercel** or **Netlify** to host the PWA.
2. Add a **Serverless Function** (e.g., `/api/expand-url`).
3. The PWA sends the URL to *your* API.
4. Your API (running Node.js/Python) does the `HEAD` request to follow
   redirects and parses the `<title>` tag.
5. Your API returns the clean JSON to your PWA.

For the MVP today, stick to the client-side code above. It will rely on
the *sharing app* to provide the title (which Chrome and YouTube usually
do).

### Next Steps

1. Create the files above.
2. Deploy to GitHub Pages.
3. Test specifically with Edge, Chrome, and YouTube on Android to see
   which fields (`text` vs `title`) they populate.
4. Once the MVP works, we can look at the "Batch Fixer" feature, which
   would be a simple file uploader added to the `index.html`.
