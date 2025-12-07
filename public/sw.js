// Minimal service worker to prevent 404 errors
// This service worker does nothing - it's just to stop the browser from requesting it

self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all pages immediately
  event.waitUntil(self.clients.claim());
});

// No fetch handler - just let requests pass through normally
// This effectively disables service worker functionality while preventing 404s

