const CACHE_NAME = 'cafetrack-offline-v2';
const APP_SHELL = ['/', '/index.html'];

const sameOrigin = (url) => url.origin === self.location.origin;

const isApiRequest = (request) => {
  try {
    return new URL(request.url).pathname.startsWith('/api/');
  } catch {
    return false;
  }
};

const cacheResponse = async (request, response) => {
  if (!response || !response.ok || response.type === 'opaque') return response;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch {
    // Cache writes can fail when the browser storage quota is full.
  }
  return response;
};

const cacheAppShell = async () => {
  const cache = await caches.open(CACHE_NAME);

  await Promise.all(
    APP_SHELL.map(async (url) => {
      try {
        const request = new Request(url, { cache: 'reload' });
        const response = await fetch(request);
        await cache.put(url, response.clone());

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) return;

        const html = await response.text();
        const assetUrls = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
          .map((match) => match[1])
          .filter((assetUrl) => !assetUrl.startsWith('data:') && !assetUrl.startsWith('blob:'))
          .map((assetUrl) => new URL(assetUrl, self.location.origin))
          .filter(sameOrigin)
          .map((assetUrl) => assetUrl.toString());

        await Promise.all(
          assetUrls.map(async (assetUrl) => {
            try {
              await cache.add(assetUrl);
            } catch {
              // Some generated assets can be unavailable during deploys; keep the shell cache usable.
            }
          })
        );
      } catch {
        // The first install may happen during a flaky connection; runtime caching will fill gaps later.
      }
    })
  );
};

const matchAppShell = async () => {
  const cachedIndex = await caches.match('/index.html', { ignoreSearch: true });
  if (cachedIndex) return cachedIndex;
  return caches.match('/', { ignoreSearch: true });
};

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET' || isApiRequest(request)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => cacheResponse('/index.html', response.clone()).then(() => response))
        .catch(async () => {
          const cached = await matchAppShell();
          return cached || Response.error();
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => cacheResponse(request, response))
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
