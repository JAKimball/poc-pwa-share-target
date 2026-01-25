document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search)

  // 1. Extract raw parameters
  const sharedTitle = params.get('title')
  const sharedText = params.get('text')
  const sharedUrl = params.get('url')

  // Debugging log (useful during dev to see what apps send what)
  const debugEl = document.getElementById('debugLog')
  debugEl.innerText = `Raw Inputs:\nTitle: ${sharedTitle}\nText: ${sharedText}\nURL: ${sharedUrl}`

  // 2. Logic to find the actual URL and Title
  let finalUrl = ''
  let finalTitle = ''

  // Regex to extract a URL from a string (for apps that put the URL inside 'text')
  const urlRegex = /(https?:\/\/[^\s]+)/g

  // Prioritize the dedicated URL field
  if (sharedUrl) {
    finalUrl = sharedUrl
  } else if (sharedText) {
    // Fallback: Check if the URL is hiding in the text field (common in Twitter/X)
    const match = sharedText.match(urlRegex)
    if (match) finalUrl = match[0]
  }

  // Determine Title
  if (sharedTitle) {
    finalTitle = sharedTitle
  } else if (sharedText && sharedText !== finalUrl) {
    // If text exists and isn't just the URL, use it as title (cleaning out the URL)
    finalTitle = sharedText.replace(finalUrl, '').trim()
  } else {
    finalTitle = 'Untitled Page'
  }

  // Clean up title (remove trailing separators common in shares like " - YouTube")
  finalTitle = finalTitle.replace(/[\s-]*$/, '')

  // 3. Construct Markdown
  // If we have no URL, don't make a link
  const markdown = finalUrl ? `[${finalTitle}](${finalUrl})` : sharedText || ''

  document.getElementById('output').value = markdown
})

function copyToClipboard() {
  const copyText = document.getElementById('output')
  copyText.select()
  copyText.setSelectionRange(0, 99999)
  navigator.clipboard.writeText(copyText.value).then(() => {
    alert('Copied!')
  })
}

function sendToObsidian() {
  const content = document.getElementById('output').value
  // Uses the "new" action to create a note, or append.
  // For now, let's just use the URI to create a new generic note or append to daily note if you use Advanced URI plugin.
  // Simple version: Open Obsidian (user can then paste).
  // Advanced version: window.location.href = `obsidian://new?content=${encodeURIComponent(content)}`;

  // Let's try to copy first, then open Obsidian
  copyToClipboard()
  setTimeout(() => {
    window.location.href = 'obsidian://open'
  }, 500)
}
