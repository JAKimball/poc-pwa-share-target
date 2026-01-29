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

  // 4. Log share data to localStorage (only if we received share data)
  if (sharedTitle || sharedText || sharedUrl) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      sharedTitle,
      sharedText,
      sharedUrl,
      finalTitle,
      finalUrl
    }
    let shareLog = JSON.parse(localStorage.getItem('shareLog') || '[]')
    shareLog.push(logEntry)
    // Keep only the last 100 entries
    if (shareLog.length > 100) {
      shareLog = shareLog.slice(-100)
    }
    localStorage.setItem('shareLog', JSON.stringify(shareLog))
  }
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
  // Use the daily action to append to today's daily note
  // Omit vault param to use last focused vault
  const uri = `obsidian://daily?content=${encodeURIComponent(content)}&append`
  window.location.href = uri
}

function exportLogToObsidian() {
  const shareLog = JSON.parse(localStorage.getItem('shareLog') || '[]')
  if (shareLog.length === 0) {
    alert('No log entries to export.')
    return
  }
  const today = new Date().toISOString().split('T')[0]
  const noteName = `Share Log - ${today}`
  const content = '```json\n' + JSON.stringify(shareLog, null, 2) + '\n```'
  const uri = `obsidian://new?name=${encodeURIComponent(noteName)}&content=${encodeURIComponent(content)}`
  window.location.href = uri
}

function clearLog() {
  if (confirm('Clear all log entries?')) {
    localStorage.removeItem('shareLog')
    alert('Log cleared.')
  }
}
