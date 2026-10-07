/* Keep model downloads across UI releases; new geometry uses a new version. */
const PREFIX = 'trauma-team-international-';
const CACHE = PREFIX + 'shell-v10';
const MODEL_VERSION = '5';
const MODEL_CACHE = PREFIX + 'models-v' + MODEL_VERSION;
const isRuntimeAsset = url => url.pathname.includes('/assets/') && /\.(?:js|mjs|css)$/.test(url.pathname);
const isModelAsset = url => (url.pathname.includes('/anatomy/') && url.pathname.endsWith('.glb')) || url.pathname.includes('/draco/');
const canReuseModel = url => isModelAsset(url) && (!url.pathname.endsWith('.glb') || url.searchParams.get('v') === MODEL_VERSION);
const validModelResponse = response => response.ok && !/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type') || '');
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const models = await caches.open(MODEL_CACHE);
    // Existing installations kept GLBs in the shell cache. Migrate those
    // downloads before retiring that cache, rather than fetching them again.
    for (const key of keys.filter(key => key.startsWith(PREFIX + 'shell-') && key !== CACHE)) {
      const previous = await caches.open(key);
      for (const request of await previous.keys()) {
        if (!canReuseModel(new URL(request.url)) || await models.match(request)) continue;
        const response = await previous.match(request);
        if (response && validModelResponse(response)) await models.put(request, response);
      }
    }
    // Requests during an upgrade can still be controlled by the old worker.
    // Retain one earlier runtime cache for open tabs and offline reloads; the
    // current index is used for navigation, and older generations are retired.
    let previousShell;
    const earlierShells = keys.filter(key => key.startsWith(PREFIX + 'shell-') && key !== CACHE)
      .sort((a, b) => Number(b.match(/v(\d+)$/)?.[1] || 0) - Number(a.match(/v(\d+)$/)?.[1] || 0));
    for (const key of earlierShells) {
      const previous = await caches.open(key);
      for (const request of await previous.keys()) {
        if (!isRuntimeAsset(new URL(request.url))) continue;
        const response = await previous.match(request);
        if (response && validModelResponse(response)) { previousShell = key; break; }
      }
      if (previousShell) break;
    }
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE && key !== MODEL_CACHE && key !== previousShell).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (isModelAsset(new URL(request.url))) {
    event.respondWith((async () => {
      let cache;
      try {
        cache = await caches.open(MODEL_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
      } catch { /* Storage restrictions must not block an online model. */ }
      try {
        const response = await fetch(request);
        if (validModelResponse(response)) {
          // Deliver the downloaded resource now; keep the worker alive for the
          // optional disk write without putting storage on the response path.
          if (cache) event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
          return response;
        }
        return response.ok ? new Response('Invalid anatomy resource', { status: 502 }) : response;
      } catch {
        // Binary and decoder requests must not receive the HTML app shell.
        return new Response('Anatomy resource unavailable offline', { status: 503 });
      }
    })());
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        // A transient 404/5xx must never replace the last usable offline page.
        if (response.ok && /text\/html/i.test(response.headers.get('content-type') || '')) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then(cache => cache.put('./index.html', copy)).catch(() => {}));
        }
        return response;
      } catch {
        const cached = await caches.open(CACHE).then(cache => cache.match('./index.html')).catch(() => undefined);
        return cached || new Response('Page unavailable offline', { status: 503 });
      }
    })());
    return;
  }
  event.respondWith((async () => {
    // Private browsing, exhausted storage and evicted caches are all optional
    // enhancements: they must not stop a successful network response.
    const runtime = isRuntimeAsset(new URL(request.url));
    const current = await caches.open(CACHE).then(cache => cache.match(request)).catch(() => undefined);
    const cached = current || await caches.match(request).catch(() => undefined);
    if (cached && (!runtime || validModelResponse(cached))) return cached;
    try {
      const response = await fetch(request);
      if (runtime && response.ok && !validModelResponse(response)) return new Response('Invalid script or stylesheet resource', { status: 502 });
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {}));
      }
      return response;
    } catch {
      // Returning index.html for JS/CSS hides the actual outage behind parse
      // and MIME errors, and can poison the next cached resource response.
      return new Response('Resource unavailable offline', { status: 503 });
    }
  })());
});
