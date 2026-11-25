const SHELL_CACHE = "musafir-shell-v4";
const MEDIA_CACHE = "musafir-offline-v1";

const PRECACHE_PATHS = [
  "",
  "quran/",
  "azkar/",
  "hadiths/",
  "settings/",
  "admin/",
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "icon.svg",
];

function getPrecacheUrls() {
  const scope = self.registration?.scope || self.location.origin + "/";
  return PRECACHE_PATHS.map((p) => new URL(p, scope).href);
}

/** Текстовые базы данных (Коран, список сур, хадисы аль-Бухари) — кэшируются в фоне после активации */
const TEXT_DB_URLS = [
  "https://api.alquran.cloud/v1/surah",
  "https://api.alquran.cloud/v1/quran/quran-uthmani",
  "https://api.alquran.cloud/v1/quran/ru.kuliev",
  "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/rus-bukhari.min.json",
];

async function precacheTextDatabases() {
  const cache = await caches.open(SHELL_CACHE);
  await Promise.allSettled(
    TEXT_DB_URLS.map(async (url) => {
      const existing = await cache.match(url);
      if (existing) return;
      const res = await fetch(url);
      if (res.ok) {
        await cache.put(url, res);
      }
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.allSettled(getPrecacheUrls().map((url) => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== MEDIA_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .then(() => {
        // Не блокируем старт: скачиваем текстовые базы данных в фоне
        precacheTextDatabases().catch(() => {});
      })
  );
});

/** Поддержка HTTP Range-запросов для плавного воспроизведения кэшированного MP3 (особенно на iOS Safari) */
async function serveCachedAudio(request, cachedResponse) {
  const rangeHeader = request.headers.get("range");
  if (!rangeHeader || cachedResponse.type === "opaque") {
    return cachedResponse;
  }

  try {
    const buffer = await cachedResponse.arrayBuffer();
    const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
    if (!match) return cachedResponse;

    const start = Number(match[1]);
    const end = match[2] ? Math.min(Number(match[2]), buffer.byteLength - 1) : buffer.byteLength - 1;
    const chunk = buffer.slice(start, end + 1);

    return new Response(chunk, {
      status: 206,
      statusText: "Partial Content",
      headers: {
        "Content-Range": `bytes ${start}-${end}/${buffer.byteLength}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunk.byteLength),
        "Content-Type": cachedResponse.headers.get("Content-Type") || "audio/mpeg",
      },
    });
  } catch {
    return cachedResponse;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // 1. Аудио Корана: Cache-First из MEDIA_CACHE, а при проигрывании из сети — автосохранение в MEDIA_CACHE
  const isAudio =
    request.destination === "audio" ||
    url.pathname.endsWith(".mp3") ||
    url.hostname.includes("islamic.network");

  if (isAudio) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then(async (cache) => {
        const cached = await cache.match(url.href);
        if (cached) {
          return serveCachedAudio(request, cached);
        }

        const networkResponse = await fetch(request);
        // Сохраняем полный аудиофайл (не 206 partial) в кэш в фоне
        if (networkResponse.ok && networkResponse.status === 200) {
          cache.put(url.href, networkResponse.clone()).catch(() => {});
        }
        return networkResponse;
      })
    );
    return;
  }

  // 2. Навигационные запросы (оболочка приложения):
  // мгновенный ответ из кэша (Stale-While-Revalidate) без экрана загрузки
  if (request.mode === "navigate") {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(networkPromise);
          return cached;
        }

        const scopeUrl = self.registration?.scope || self.location.origin + "/";
        const networkResponse = await networkPromise;
        return networkResponse || (await cache.match(scopeUrl)) || Response.error();
      })
    );
    return;
  }

  // 3. Статика приложения (JS, CSS, иконки, шрифты, манифест): Cache-First с фоновым обновлением
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".svg") ||
      url.pathname.endsWith(".json") ||
      url.pathname.endsWith(".woff2"))
  ) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);

        if (cached) {
          event.waitUntil(networkPromise);
          return cached;
        }
        return networkPromise;
      })
    );
    return;
  }

  // 4. Запросы к API (Коран, хадисы, время намаза):
  // проверяем оффлайн-кэш MEDIA_CACHE -> сеть -> SHELL_CACHE
  event.respondWith(
    caches.open(MEDIA_CACHE).then(async (mediaCache) => {
      const offlineHit = await mediaCache.match(request);
      if (offlineHit) return offlineHit;

      const shellCache = await caches.open(SHELL_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) {
          shellCache.put(request, response.clone());
        }
        return response;
      } catch {
        const cached = await shellCache.match(request);
        return cached || Response.error();
      }
    })
  );
});
