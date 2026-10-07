/* Keep model downloads across UI releases; new geometry uses a new version. */
const PREFIX = 'trauma-team-international-';
// The build replaces this declaration and embeds the same manifest in HTML.
const RELEASE = {id:'development',assets:[]};
const CACHE = PREFIX + 'shell-v11-' + RELEASE.id;
const READY = './offline-ready';
const MODEL_VERSION = '5';
const MODEL_CACHE = PREFIX + 'models-v' + MODEL_VERSION;
const isRuntimeAsset = url => url.pathname.includes('/assets/') && /\.(?:js|mjs|css)$/.test(url.pathname);
const isModelAsset = url => (url.pathname.includes('/anatomy/') && url.pathname.endsWith('.glb')) || url.pathname.includes('/draco/');
const canReuseModel = url => isModelAsset(url) && (!url.pathname.endsWith('.glb') || url.searchParams.get('v') === MODEL_VERSION);
const validModelResponse = response => response.ok && !/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type') || '');
const validRuntimeResponse = (response, url) => {
  if (!response.ok) return false;
  const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  return new URL(typeof url === 'string' ? url : url.url, scope).pathname.endsWith('.css') ? mime === 'text/css' : /^(?:(?:text|application)\/(?:x-)?(?:java|ecma)script|text\/(?:javascript1\.[0-5]|jscript|livescript))$/.test(mime);
};
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
const scope = self.registration?.scope || self.location.href || self.location.origin + '/';
function runtimeUrls(assets) {
  if (!Array.isArray(assets) || assets.length > 128) throw new Error('Invalid offline asset manifest');
  const prefix = new URL('./assets/', scope).pathname;
  return [...new Set(assets.map(asset => {
    if (typeof asset !== 'string') throw new Error('Invalid offline asset URL');
    const url = new URL(asset, scope);
    if (url.origin !== self.location.origin || !url.pathname.startsWith(prefix) || !isRuntimeAsset(url) || url.search || url.hash) throw new Error('Invalid offline asset URL');
    return url.href;
  }))].sort();
}
async function pageRelease(response) {
  if (!response.ok || !/text\/html/i.test(response.headers.get('content-type') || '')) throw new Error('Invalid offline page');
  const html = await response.clone().text();
  const match = html.match(/<script\b[^>]*\sid=["']offline-release["'][^>]*>([\s\S]*?)<\/script>/i);
  if (match) {
    const release = JSON.parse(match[1]);
    if (typeof release.id !== 'string' || !release.id) throw new Error('Invalid offline release');
    const assets = runtimeUrls(release.assets);
    if (RELEASE.assets.length && !assets.length) throw new Error('Empty offline runtime');
    return {id:release.id,assets};
  }
  // Plain fallback documents need no runtime. A script-bearing legacy or
  // mismatched HTML response must not replace a known complete application.
  if (RELEASE.assets.length || /<script\b[^>]*\ssrc=|<link\b[^>]*\b(?:modulepreload|stylesheet)\b/i.test(html)) throw new Error('Missing offline asset manifest');
  return {id:RELEASE.id,assets:[]};
}
async function cachedResponse(request, primary, primaryName, valid) {
  const local = await primary?.match(request).catch(() => undefined);
  if (local && valid(local)) return local;
  for (const name of await caches.keys().catch(() => [])) {
    if (name === primaryName || !name.startsWith(PREFIX)) continue;
    const response = await caches.open(name).then(cache => cache.match(request)).catch(() => undefined);
    if (response && valid(response)) return response;
  }
}
async function cacheRuntime(cache, assets) {
  await Promise.all(assets.map(async url => {
    const local = await cache.match(url);
    if (local && validRuntimeResponse(local, url)) return;
    const previous = await cachedResponse(url, cache, CACHE, response => validRuntimeResponse(response, url));
    const response = previous || await fetch(url);
    if (!validRuntimeResponse(response, url)) throw new Error('Invalid offline runtime resource');
    await cache.put(url, response);
  }));
}
let navigationSequence = 0, promotedNavigation = 0, pageCommit = Promise.resolve();
async function saveCompletePage(response, sequence) {
  const {assets} = await pageRelease(response);
  const cache = await caches.open(CACHE);
  await cacheRuntime(cache, assets);
  // Commit the navigation response last. Interrupted downloads/quota failures
  // leave the previous complete page as the offline entry point.
  // Serialize only the final commit so a slow older navigation cannot finish
  // after, and overwrite, a newer complete page. Asset downloads stay parallel.
  pageCommit = pageCommit.catch(() => {}).then(async () => {
    if (sequence < promotedNavigation) return;
    await cache.put('./index.html', response);
    promotedNavigation = sequence;
  });
  await pageCommit;
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const existed = (await caches.keys()).includes(CACHE);
    try {
      const response = await fetch('./index.html');
      const release = await pageRelease(response);
      const assets = release.assets;
      if (release.id !== RELEASE.id || JSON.stringify(assets) !== JSON.stringify(runtimeUrls(RELEASE.assets))) throw new Error('Offline HTML and worker releases differ');
      const cache = await caches.open(CACHE);
      await cacheRuntime(cache, assets);
      await cache.addAll(SHELL.filter(path => path !== './' && path !== './index.html'));
      await cache.put('./', response.clone());
      await cache.put('./index.html', response);
      await cache.put(READY, new Response(RELEASE.id));
      await self.skipWaiting();
    } catch (error) {
      if (!existed) await caches.delete(CACHE).catch(() => {});
      throw error;
    }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Do not retire a newer worker's cache if it was created during this
    // worker's installation/activation handover.
    const previousKeys = keys.slice(0, keys.indexOf(CACHE) < 0 ? keys.length : keys.indexOf(CACHE));
    let models;
    try { models = await caches.open(MODEL_CACHE); } catch { await self.clients.claim(); return; }
    const preserveShells = new Set();
    // Existing installations kept GLBs in the shell cache. Migrate those
    // downloads before retiring that cache, rather than fetching them again.
    for (const key of previousKeys.filter(key => key.startsWith(PREFIX + 'shell-') && key !== CACHE)) {
      try {
        const previous = await caches.open(key);
        for (const request of await previous.keys()) {
          if (!canReuseModel(new URL(request.url))) continue;
          const existing = await models.match(request);
          if (existing && validModelResponse(existing)) continue;
          const response = await previous.match(request);
          if (response && validModelResponse(response)) await models.put(request, response);
        }
      } catch { preserveShells.add(key); }
    }
    // Requests during an upgrade can still be controlled by the old worker.
    // Retain one earlier runtime cache for open tabs and offline reloads; the
    // current index is used for navigation, and older generations are retired.
    let previousShell;
    const earlierShells = previousKeys.filter(key => key.startsWith(PREFIX + 'shell-') && key !== CACHE).reverse()
      .sort((a, b) => Number(b.match(/shell-v(\d+)/)?.[1] || 0) - Number(a.match(/shell-v(\d+)/)?.[1] || 0));
    for (const key of earlierShells) {
      const previous = await caches.open(key);
      if (key.includes('shell-v11-') && !await previous.match(READY)) continue;
      for (const request of await previous.keys()) {
        if (!isRuntimeAsset(new URL(request.url))) continue;
        const response = await previous.match(request);
        if (response && validRuntimeResponse(response, request)) { previousShell = key; break; }
      }
      if (previousShell) break;
    }
    await Promise.all(previousKeys.filter(key => key.startsWith(PREFIX) && key !== CACHE && key !== MODEL_CACHE && key !== previousShell && !preserveShells.has(key)).map(key => caches.delete(key).catch(() => false)));
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
        const cached = await cachedResponse(request, cache, MODEL_CACHE, validModelResponse);
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
    const sequence = ++navigationSequence;
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        // A transient 404/5xx must never replace the last usable offline page.
        if (response.ok && /text\/html/i.test(response.headers.get('content-type') || '')) {
          const copy = response.clone();
          event.waitUntil(saveCompletePage(copy, sequence).catch(() => {}));
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
    const cached = await caches.open(CACHE).then(cache => cachedResponse(request, cache, CACHE, response => !runtime || validRuntimeResponse(response, request))).catch(() => undefined);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (runtime && response.ok && !validRuntimeResponse(response, request)) return new Response('Invalid script or stylesheet resource', { status: 502 });
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
