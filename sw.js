// Stock Tycoon service worker: the game loads and runs offline; online features need a connection.
const C = "tt-v19";
const SHELL = ["./", "index.html", "net.js", "config.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(C).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== C).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  // Game files: always check the server first (skipping the 10-minute browser cache) so updates show up right away, fall back to the saved copy offline.
  if (u.origin === location.origin) {
    e.respondWith(
      fetch(e.request, { cache: "no-cache" }).then((r) => { const cp = r.clone(); caches.open(C).then((c) => c.put(e.request, cp)); return r; })
        .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
    );
    return;
  }
  // Fonts and the Firebase library never change at a given URL, so keep a copy.
  if (["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"].includes(u.host)) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => { const cp = res.clone(); caches.open(C).then((c) => c.put(e.request, cp)); return res; })));
  }
});
