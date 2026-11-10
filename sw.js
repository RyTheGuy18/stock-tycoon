// Stock Tycoon service worker: the game loads and runs offline; online features need a connection.
const C = "tt-v136";
const SHELL = ["./", "index.html", "net.js", "config.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
// Updates are MANUAL. Each version keeps its files in its own cache (tt-vNN). A small "meta" cache remembers which
// version you accepted, and the game is always served from THAT cache, even after a newer service worker takes over
// or the app is fully closed and reopened. "Update now" in Settings sends {type:"accept"}: the newest version becomes
// the accepted one and old caches are cleared. The very first install is accepted automatically.
const META = "tt-meta";
const accepted = async () => { const r = await (await caches.open(META)).match("/__ver"); return r ? r.text() : null; };
const setAccepted = async (v) => (await caches.open(META)).put("/__ver", new Response(v));
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(C).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    let cur = await accepted(); if (!cur || !(await caches.has(cur))) { cur = C; await setAccepted(C); }
    for (const k of await caches.keys()) if (k !== cur && k !== C && k !== META) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener("message", (e) => {
  const d = e.data || {}, reply = (x) => e.ports[0] && e.ports[0].postMessage(x);
  if (d.type === "state") e.waitUntil(accepted().then((a) => reply({ accepted: a, latest: C })));
  if (d.type === "accept") e.waitUntil((async () => { await setAccepted(C); for (const k of await caches.keys()) if (k !== C && k !== META) await caches.delete(k); reply({ ok: true }); })());
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  // Music streams straight from the server (the browser fetches it in pieces, which a cached copy would break on iPhone).
  if (u.origin === location.origin && u.pathname.includes("/music/")) return;
  // The version check (index.html?v=...) always asks the server.
  if (u.origin === location.origin && u.searchParams.has("v")) return;
  if (u.origin === location.origin) {
    e.respondWith((async () => {
      const c = await caches.open((await accepted()) || C);
      const hit = (await c.match(e.request, { ignoreSearch: true })) || (e.request.mode === "navigate" ? await c.match("index.html") : null);
      if (hit) return hit;
      const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r;
    })());
    return;
  }
  // Fonts and the Firebase library never change at a given URL, so keep a copy.
  if (["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"].includes(u.host)) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => { const cp = res.clone(); caches.open(C).then((c) => c.put(e.request, cp)); return res; })));
  }
});

// ---------- push notifications (sent by the push worker in push/) ----------
// Payload: {title, body, tag, tab}. tab = which tab to open when tapped ("trade", "friends").
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Stock Tycoon", {
    body: d.body || "", tag: d.tag || undefined, icon: "icons/icon-192.png", badge: "icons/icon-192.png", data: { tab: d.tab || "" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const tab = (e.notification.data && e.notification.data.tab) || "";
  const url = new URL("./" + (tab ? "#" + tab : ""), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if ("focus" in c) { c.postMessage({ type: "open-tab", tab }); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
