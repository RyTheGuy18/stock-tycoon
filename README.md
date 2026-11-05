# Ticker Tycoon

Start broke in Mom's basement and trade your way to a private island. This is an iPhone web app: open it in Safari, then tap **Share → Add to Home Screen** and it runs full-screen like a real app.

## Files
- `index.html`: the whole game
- `net.js`: online features (sign-in, cloud saves, friends, chat), using Firebase
- `config.js`: your Firebase web config (leave it as `null` to play offline only)
- `firestore.rules`: database security rules. Paste these into Firebase.
- `sw.js`, `manifest.webmanifest`, `icons/`: what makes it installable and work offline

## One-time setup

### 1. Firebase
1. Go to console.firebase.google.com and create a project.
2. Go to **Authentication → Get started → Email/Password → Enable**.
3. Go to **Firestore Database → Create database** (production mode).
4. Go to **Firestore → Rules**, paste in everything from `firestore.rules`, and click **Publish**.
5. Go to **Project settings → Your apps → Web app (</>)** and copy the config into `config.js`:
   ```js
   export const firebaseConfig = { apiKey: "...", authDomain: "...", projectId: "...", storageBucket: "...", messagingSenderId: "...", appId: "..." };
   ```
6. Go to **Authentication → Settings → Authorized domains** and add `rytheguy18.github.io`.

### 2. GitHub Pages
Go to the repo's **Settings → Pages → Build and deployment**, set the source to **Deploy from a branch**, pick branch `main` and folder `/ (root)`, and save. The game will be at `https://rytheguy18.github.io/stock-tycoon/`.

## How accounts work
Players sign up with a username and password. Behind the scenes Firebase stores it as `username@players.tickertycoon.app`. No email is ever sent, so passwords can't be reset by email. If someone forgets theirs, delete their account under **Authentication → Users** and they can sign up again. Their old save is lost unless they had exported a save code.

## Online features
- **Friend requests:** search by username, then accept or decline. Friends show on the leaderboard, get your tips, and nudge the shared market.
- **Private chat** between friends, updating live.
- **Weekly competition**, opt-in: joining gives you a separate $1,000 competition wallet on the same live market, and your real money is never touched. Weeks run Monday 00:00 UTC (Sunday 6 PM Central). The top 3 get 🥇🥈🥉 trophies, and 1st place unlocks the *Weekly Champion* title. A competition needs at least 2 players for trophies. Standings come from each player's last update, sent about once a minute while they have the app open.

## Updating
Change the files and push. Players get the new version the next time they open the app while online.
