// Offline support: cache the whole app on install, serve it cache-first.
// Bump VERSION whenever any file below changes, so devices pick up the update.
const VERSION = "v1";
const CACHE = `satflash-${VERSION}`;
const FILES = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "srs.js",
  "sync.js",
  "words.json",
  "manifest.webmanifest",
  "fonts/Geist-Variable.woff2",
  "fonts/GeistMono-Variable.woff2",
  "icons/app-180.png",
  "icons/app-192.png",
  "icons/app-512.png",
  ...["arrow-counter-clockwise", "check", "cloud-check", "cloud-slash", "list-magnifying-glass", "moon", "sun", "x"]
    .map((n) => `icons/${n}.svg`),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("satflash-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return; // GitHub API goes straight to the network
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request)),
  );
});
