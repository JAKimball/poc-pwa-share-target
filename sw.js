self.addEventListener('fetch', (event) => {
  // Basic pass-through, required for PWA installability criteria
  event.respondWith(fetch(event.request))
})
