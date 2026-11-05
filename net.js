// Ticker Tycoon online layer: Firebase sign-in, cloud data, friends and chat.
// The game script talks to this through window.NET (set once Firebase is ready).
import { firebaseConfig } from "./config.js";

const V = "10.12.2";
const ready = (net) => { window.NET = net; window.dispatchEvent(new Event("net-ready")); };

if (!firebaseConfig || !firebaseConfig.apiKey) {
  ready(null); // offline only
} else {
  try {
    const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
    const A = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
    const F = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);
    const app = initializeApp(firebaseConfig);
    const auth = A.getAuth(app);
    const fs = F.getFirestore(app);

    // Usernames are turned into a private login address. No email is ever sent to it.
    const DOMAIN = "players.tickertycoon.app";
    const okName = (u) => /^[a-z0-9_]{3,16}$/.test(u);
    const norm = (u) => String(u || "").trim().toLowerCase().replace(/^@/, "");
    const email = (u) => `${u}@${DOMAIN}`;
    const nameOf = (user) => (user && user.email ? user.email.split("@")[0] : "");

    // Same shape the game already used: DB.doc(path).get()/set(), DB.collection(path).orderBy().limit().get()
    const wrap = (s) => ({ id: s.id, exists: s.exists(), data: () => s.data() });
    const db = {
      doc: (p) => ({
        get: async () => wrap(await F.getDoc(F.doc(fs, p))),
        set: (o) => F.setDoc(F.doc(fs, p), o),
      }),
      collection: (p) => {
        const c = [];
        const q = {
          orderBy: (f, d) => (c.push(F.orderBy(f, d || "asc")), q),
          limit: (n) => (c.push(F.limit(n)), q),
          where: (a, b, v) => (c.push(F.where(a, b, v)), q),
          get: async () => ({ docs: (await F.getDocs(F.query(F.collection(fs, p), ...c))).docs.map(wrap) }),
        };
        return q;
      },
    };

    const err = (e) => {
      const c = (e && e.code) || "";
      if (c.includes("email-already-in-use")) return "That username is taken.";
      if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "Wrong username or password.";
      if (c.includes("weak-password")) return "Password needs at least 6 characters.";
      if (c.includes("too-many-requests")) return "Too many tries. Wait a minute and try again.";
      if (c.includes("network")) return "No connection. Check your internet.";
      return "Something went wrong (" + (c || "unknown") + ").";
    };
    const pairId = (a, b) => [a, b].sort().join("_");

    ready({
      db,
      pairId,
      okName,
      norm,
      onUser(cb) {
        return A.onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, username: nameOf(u) } : null));
      },
      async signUp(name, pw) {
        name = norm(name);
        if (!okName(name)) throw new Error("Usernames are 3–16 letters, numbers or _.");
        try {
          const cred = await A.createUserWithEmailAndPassword(auth, email(name), pw);
          await F.setDoc(F.doc(fs, "usernames/" + name), { uid: cred.user.uid, at: Date.now() });
        } catch (e) { throw new Error(err(e)); }
      },
      async signIn(name, pw) {
        name = norm(name);
        if (!okName(name)) throw new Error("Wrong username or password.");
        try { await A.signInWithEmailAndPassword(auth, email(name), pw); } catch (e) { throw new Error(err(e)); }
      },
      async changePassword(pw) {
        try { await A.updatePassword(auth.currentUser, pw); } catch (e) {
          if ((e.code || "").includes("requires-recent-login")) throw new Error("Sign out and back in, then try again.");
          throw new Error(err(e));
        }
      },
      signOut: () => A.signOut(auth),
      async findUser(name) {
        name = norm(name);
        if (!okName(name)) return null;
        const s = await F.getDoc(F.doc(fs, "usernames/" + name));
        return s.exists() ? s.data().uid : null;
      },
      async getProfile(uid) {
        const s = await F.getDoc(F.doc(fs, "profiles/" + uid));
        return s.exists() ? s.data() : null;
      },
      // ---- friends: friendships/<uidA_uidB> {members:[a,b], from, status:'pending'|'accepted', at, last}
      watchFriendships(uid, cb) {
        const q = F.query(F.collection(fs, "friendships"), F.where("members", "array-contains", uid));
        return F.onSnapshot(q, (s) => cb(s.docs.map((d) => Object.assign({ id: d.id }, d.data()))), () => {});
      },
      sendRequest(me, them) {
        const m = [me, them].sort();
        return F.setDoc(F.doc(fs, "friendships/" + m.join("_")), { members: m, from: me, status: "pending", at: Date.now() });
      },
      accept: (pid) => F.updateDoc(F.doc(fs, "friendships/" + pid), { status: "accepted" }),
      remove: (pid) => F.deleteDoc(F.doc(fs, "friendships/" + pid)),
      // ---- chat: chats/<pairId>/msgs/<auto> {from, text, at}
      watchChat(pid, cb) {
        const q = F.query(F.collection(fs, "chats/" + pid + "/msgs"), F.orderBy("at", "desc"), F.limit(60));
        return F.onSnapshot(q, (s) => cb(s.docs.map((d) => Object.assign({ id: d.id }, d.data())).reverse()), () => {});
      },
      async sendMsg(pid, me, text) {
        text = String(text || "").trim().slice(0, 500);
        if (!text) return;
        const at = Date.now();
        await F.addDoc(F.collection(fs, "chats/" + pid + "/msgs"), { from: me, text, at });
        await F.updateDoc(F.doc(fs, "friendships/" + pid), { last: { from: me, text: text.slice(0, 80), at } });
      },
    });
  } catch (e) {
    console.warn("Online features failed to start", e);
    ready(null);
  }
}
