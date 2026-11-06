// Stock Tycoon push worker. Runs on GitHub Actions (.github/workflows/push-worker.yml) in back-to-back shifts.
//
// What it sends:
//   Big market news (to every device with "Big market news" on):
//     crash warnings, breaking news + the "big money" whisper before it, bull/bear markets starting.
//     The market is a pure function of the clock, so the worker loads the real game page in headless Chrome
//     and asks the game's own newsSince() what's coming, then sends each item right on time.
//   Friend stuff (to the right player, if "Friends" is on):
//     friend requests, accepted requests, messages, tips, and weekly competition results.
//
// Every notification is claimed in Firestore (pushlog/<key>) before it's sent, so overlapping shifts never send twice.
//
// Env: FIREBASE_SA (service account JSON), VAPID_PUBLIC, VAPID_PRIVATE,
//      RUN_MINUTES (default 105), CHROME (default /usr/bin/google-chrome),
//      DRY_RUN=1 (log instead of sending), NO_FIREBASE=1 (market only, for testing without credentials).
"use strict";
const path = require("path");
const webpush = require("web-push");
const { chromium } = require("playwright-core");

const DRY = process.env.DRY_RUN === "1";
const NOFB = process.env.NO_FIREBASE === "1";
const RUN_MS = (+process.env.RUN_MINUTES || 105) * 60000;
const START = Date.now();
const LOOKBACK = 180; // seconds: catch anything that happened while the previous shift was handing over
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const nowSec = () => Math.floor(Date.now() / 1000);

let db = null, admin = null;
if (!NOFB) {
  admin = require("firebase-admin");
  if (!process.env.FIREBASE_SA) { console.error("Missing FIREBASE_SA secret (Firebase service account JSON)."); process.exit(1); }
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SA)) });
  db = admin.firestore();
}
if (!DRY) {
  if (!process.env.VAPID_PUBLIC || !process.env.VAPID_PRIVATE) { console.error("Missing VAPID_PUBLIC / VAPID_PRIVATE secrets."); process.exit(1); }
  webpush.setVapidDetails("https://rytheguy18.github.io/stock-tycoon/", process.env.VAPID_PUBLIC, process.env.VAPID_PRIVATE);
}

// ---------- subscriptions: push/<uid>/subs/<sid> {ep, p256dh, auth, news, friends, at} ----------
const SUBS = new Map(); // doc path -> sub
function subsFor(cat, uids) {
  const best = new Map(); // one entry per endpoint: the newest doc wins (a device that switched accounts)
  for (const [p, s] of SUBS) { const o = best.get(s.ep); if (!o || s.at > o.at) best.set(s.ep, Object.assign({ path: p }, s)); }
  return [...best.values()].filter((s) => s[cat] && (!uids || uids.includes(s.uid)));
}
const codeOf = (uid) => uid.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase(); // same as the game's myCode()

// ---------- send once ----------
const SENT = new Set();
async function once(key) {
  key = key.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 300);
  if (SENT.has(key)) return false; SENT.add(key);
  if (!db) return true;
  try { await db.collection("pushlog").doc(key).create({ at: Date.now() }); return true; }
  catch (e) { if (e.code === 6) return false; log("pushlog error", e.message); return false; } // 6 = already exists
}
async function send(cat, uids, msg, key, ttl) {
  if (!(await once(key))) return;
  const subs = subsFor(cat, uids);
  log(`send [${cat}] "${msg.title}: ${msg.body}" → ${subs.length} device(s)`);
  if (DRY) return;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.ep, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: ttl || 600, urgency: "high" });
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) { log("expired sub removed", s.path); SUBS.delete(s.path); if (db) db.doc(s.path).delete().catch(() => {}); }
      else log("push failed", e.statusCode || "", (e.body || e.message || "").toString().slice(0, 120));
    }
  }));
}

// ---------- developer test push: a dev account marks its own subscription with test:<time>, we send just to that device ----------
const DEVS = ["rytheguy18", "rytheguy"]; // usernames (same list as the game)
let DEVUIDS = null;
async function devUids() {
  if (DEVUIDS) return DEVUIDS; DEVUIDS = new Set();
  for (const n of DEVS) { try { const d = (await db.doc("usernames/" + n).get()).data(); if (d && d.uid) DEVUIDS.add(d.uid); } catch (_) {} }
  return DEVUIDS;
}
async function onTest(path, uid, t) {
  if (!(await devUids()).has(uid)) return log("test push ignored: not a developer account");
  if (!(await once("test_" + uid + "_" + t))) return;
  const s = SUBS.get(path); if (!s) return;
  const msg = { title: "🧪 Test notification", body: "Push notifications are working on this device. " + new Date().toLocaleTimeString("en-US", { timeZone: "America/Chicago" }), tag: "test", tab: "" };
  log("send [test] →", path); if (DRY) return;
  try { await webpush.sendNotification({ endpoint: s.ep, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 120, urgency: "high" }); }
  catch (e) { log("test push failed", e.statusCode || "", (e.body || e.message || "").toString().slice(0, 120)); }
}

// ---------- names ----------
const NAMES = new Map();
async function nameOf(uid) {
  const c = NAMES.get(uid); if (c && Date.now() - c.t < 1800000) return c.n;
  let n = "A friend";
  try { const d = (await db.doc("profiles/" + uid).get()).data(); if (d) n = String(d.name || (d.uname ? "@" + d.uname : "") || n).replace(/[<>]/g, "").slice(0, 20) || n; } catch (_) {}
  NAMES.set(uid, { n, t: Date.now() }); return n;
}

// ---------- big market news, straight from the game engine ----------
let page = null, browser = null, STOCKS = [], NEWS = [];
async function loadGame() {
  browser = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  page = await browser.newPage();
  await page.route(/^https?:\/\//, (r) => r.abort()); // no fonts, no Firebase: the engine needs neither
  await page.goto("file://" + path.resolve(__dirname, "..", "index.html"));
  await page.waitForFunction(() => typeof newsSince === "function" && typeof STOCKS !== "undefined", null, { timeout: 30000 });
  STOCKS = await page.evaluate(() => STOCKS.map((d) => ({ s: d.s, n: d.n, gone: !!d.gone })));
}
async function refreshNews() {
  const t0 = nowSec() - LOOKBACK, t1 = nowSec() + 20 * 60;
  NEWS = await page.evaluate(([a, b]) => newsSince(a, b).map((x) => {
    const k = x.tell === "crash" ? "crash" : x.tell === "whisper" ? "whisper" : x.ev ? "breaking" : x.big && x.s === "*" ? "mood" : null;
    return k ? { at: x.at, k, t: x.t, up: x.ev ? x.ev.sc.dir > 0 : /Bull/.test(x.t) } : null;
  }).filter(Boolean), [t0, t1]);
}
const NEWS_FMT = {
  crash: (x) => ({ title: "⚠️ Market warning", body: x.t.replace(/^⚠️\s*/, ""), ttl: 150 }),
  whisper: (x) => ({ title: "👀 Smart money is moving", body: x.t.replace(/^👀\s*/, ""), ttl: 900 }),
  breaking: (x) => ({ title: (x.up ? "🚀" : "🚨") + " Breaking news", body: x.t.replace(/^\S+\s*BREAKING:\s*/, ""), ttl: 1800 }),
  mood: (x) => { const b = x.t.replace(/^\S+\s*(Bull run|Bear market):\s*/i, ""); return { title: x.up ? "📈 Bull market" : "📉 Bear market", body: b.charAt(0).toUpperCase() + b.slice(1), ttl: 3600 }; },
};
async function newsTick() {
  const n = nowSec();
  for (const x of NEWS) {
    if (x.at > n || n - x.at > LOOKBACK) continue;
    const f = NEWS_FMT[x.k](x);
    await send("news", null, { title: f.title, body: f.body, tag: "n" + x.at, tab: "trade" }, `n_${x.k}_${x.at}`, f.ttl);
  }
}

// ---------- friends: requests, accepts, messages (friendships/<pid> {members, from, status, at, acc, last}) ----------
const fresh = (ms) => +ms > START - LOOKBACK * 1000 && Date.now() - +ms < 15 * 60000;
async function onFriendship(id, d) {
  if (!d || !Array.isArray(d.members) || d.members.length !== 2) return;
  const other = (u) => d.members.find((m) => m !== u);
  if (d.status === "pending" && fresh(d.at)) {
    const to = other(d.from), nm = await nameOf(d.from);
    await send("friends", [to], { title: "👥 Friend request", body: `${nm} wants to be friends`, tag: "fr" + id, tab: "friends" }, `fr_${id}_${d.at}`, 86400);
  }
  if (d.status === "accepted" && d.acc && fresh(d.acc)) {
    const by = other(d.from), nm = await nameOf(by);
    await send("friends", [d.from], { title: "👥 Friend request accepted", body: `${nm} is now your friend`, tag: "fa" + id, tab: "friends" }, `fa_${id}_${d.acc}`, 86400);
  }
  const L = d.last;
  if (d.status === "accepted" && L && L.from && fresh(L.at)) {
    const to = other(L.from), nm = await nameOf(L.from);
    await send("friends", [to], { title: "💬 " + nm, body: String(L.text || "").slice(0, 120), tag: "m" + id, tab: "friends" }, `m_${id}_${L.at}`, 86400);
  }
}

// ---------- tips (tips/<uid> {name, code, to:[friend codes], tips:[[id, t, stock, dir]]}) ----------
async function onTips(uid, d) {
  if (!d || !Array.isArray(d.tips) || !Array.isArray(d.to)) return;
  const nm = String(d.name || "A friend").replace(/[<>]/g, "").slice(0, 20), n = nowSec();
  for (const r of d.tips) {
    if (!Array.isArray(r)) continue;
    const [id, t, i, dir] = [String(r[0]).slice(0, 12), Math.floor(+r[1]), +r[2], +r[3]];
    const st = STOCKS[i];
    if (!st || st.gone || (dir !== 1 && dir !== -1) || !fresh(t * 1000) || n - t > 300) continue;
    const to = [...new Set(subsFor("friends").map((s) => s.uid))].filter((u) => u !== uid && d.to.includes(codeOf(u)));
    for (const u of to) await send("friends", [u], { title: "💡 Tip from " + nm, body: `${nm} thinks ${st.s} is going ${dir > 0 ? "▲ up" : "▼ down"}. Tips last 5 minutes.`, tag: "tip" + id, tab: "trade" }, `tip_${id}_${u}`, 300);
  }
}

// ---------- weekly competition results (comps/<week>/entries/<uid> {value}) ----------
const wkIdx = (t) => Math.floor((t - 345600) / 604800); // weeks start Monday 00:00 UTC, same as the game
const money = (v) => "$" + (+v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
async function compTick() {
  const n = nowSec(), w = wkIdx(n) - 1, end = (w + 1) * 604800 + 345600;
  if (n < end + 300 || n > end + 86400) return; // 5 minutes after the week ends, so final values are in
  if (!(await once("compdone_" + w))) return;
  const q = await db.collection(`comps/${w}/entries`).orderBy("value", "desc").limit(200).get(), rows = q.docs;
  for (let r = 0; r < rows.length; r++) {
    const v = +rows[r].data().value || 0, medal = rows.length >= 2 ? ["🥇", "🥈", "🥉"][r] : null;
    await send("friends", [rows[r].id], {
      title: "🏆 Competition results", tag: "comp" + w, tab: "friends",
      body: `You finished #${r + 1} of ${rows.length} with ${money(v)} (${((v / 1000 - 1) * 100).toFixed(1)}%).${medal ? " You won " + medal + "!" : ""}`,
    }, `comp_${w}_${rows[r].id}`, 86400);
  }
}

// ---------- run one shift ----------
async function main() {
  log(`shift start${DRY ? " (dry run)" : ""}, ${RUN_MS / 60000} min`);
  await loadGame(); await refreshNews();
  log(`game engine loaded: ${STOCKS.length} stocks, ${NEWS.length} big news items in the next 20 min`);
  NEWS.forEach((x) => log("  upcoming", new Date(x.at * 1000).toISOString().slice(11, 19), x.k, x.t.slice(0, 70)));
  const unsub = [];
  if (db) {
    unsub.push(db.collectionGroup("subs").onSnapshot((s) => {
      s.docChanges().forEach((c) => {
        const p = c.doc.ref.path; if (!p.startsWith("push/")) return;
        if (c.type === "removed") return SUBS.delete(p);
        const d = c.doc.data(); SUBS.set(p, { uid: c.doc.ref.parent.parent.id, ep: d.ep, p256dh: d.p256dh, auth: d.auth, news: !!d.news, friends: !!d.friends, at: +d.at || 0 });
        if (d.test && Date.now() - d.test < 180000) onTest(p, c.doc.ref.parent.parent.id, +d.test).catch((e) => log("test err", e.message));
      });
      log(`devices subscribed: ${SUBS.size}`);
    }, (e) => log("subs listener error", e.message)));
    // friend and tip listeners start once subscriptions are loaded, so the first snapshot can be matched to devices
    await new Promise((r) => setTimeout(r, 4000));
    unsub.push(db.collection("friendships").onSnapshot((s) => s.docChanges().forEach((c) => { if (c.type !== "removed") onFriendship(c.doc.id, c.doc.data()).catch((e) => log("friend err", e.message)); }), (e) => log("friend listener error", e.message)));
    unsub.push(db.collection("tips").onSnapshot((s) => s.docChanges().forEach((c) => { if (c.type !== "removed") onTips(c.doc.id, c.doc.data()).catch((e) => log("tip err", e.message)); }), (e) => log("tip listener error", e.message)));
    // tidy up the send log (keeps a week)
    db.collection("pushlog").where("at", "<", Date.now() - 7 * 86400000).limit(400).get().then((q) => Promise.all(q.docs.map((d) => d.ref.delete()))).catch(() => {});
  }
  let lastRefresh = Date.now(), lastComp = 0;
  while (Date.now() - START < RUN_MS) {
    try {
      if (Date.now() - lastRefresh > 10 * 60000) { await refreshNews(); lastRefresh = Date.now(); }
      await newsTick();
      if (db && Date.now() - lastComp > 60000) { lastComp = Date.now(); await compTick(); }
    } catch (e) { log("tick error", e.message); }
    await new Promise((r) => setTimeout(r, 1000));
  }
  unsub.forEach((u) => u()); await browser.close().catch(() => {});
  log("shift over"); process.exit(0);
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
// for tests: swap in a fake Firestore and stock list
module.exports = { onFriendship, onTips, compTick, NEWS_FMT, SUBS, _set: (o) => { if ("db" in o) db = o.db; if (o.STOCKS) STOCKS = o.STOCKS; } };
