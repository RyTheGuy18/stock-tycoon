# Push worker

Sends Stock Tycoon push notifications. It runs on GitHub Actions (`.github/workflows/push-worker.yml`) in back-to-back shifts of about 105 minutes. A new run is queued every hour, so there's always one on duty. Actions minutes are free for public repos.

## What it sends

**Big market news**, to every device with "Big market news" on. The market is a pure function of the clock, so the worker opens the real game page in headless Chrome and asks the game's own `newsSince()` what's coming. Then it sends each item right on time:

- ⚠️ the crash warning (2 minutes before a market crash)
- 👀 the "big money" whisper before breaking news
- 🚀/🚨 breaking news
- 📈/📉 a bull or bear market starting

That's about 5 a day. The notifications only repeat the headline, never the lesson rule.

**Friends**, to the right player, if "Friends" is on:

- friend requests and accepted requests
- messages
- tips (they expire in 5 minutes, like in the game)
- weekly competition results, 5 minutes after the week ends

Every notification is claimed in Firestore at `pushlog/<key>` before it's sent, so overlapping shifts never send twice. The log keeps 7 days.

## Data

`push/<uid>/subs/<sid>` holds one doc per device: `{ep, p256dh, auth, news, friends, at}`. The game writes it from Settings → Notifications. Expired devices (HTTP 404 or 410) are removed automatically.

## Setup

1. **Firebase rules:** paste `firestore.rules` into Firebase console → Firestore Database → Rules → Publish. It adds the `push/` rule.
2. **Service account:** Firebase console → ⚙️ Project settings → Service accounts → **Generate new private key**. That downloads a JSON file.
3. **GitHub secrets:** in the repo, go to Settings → Secrets and variables → Actions → New repository secret, and add:
   - `FIREBASE_SA`: the whole contents of that JSON file
   - `VAPID_PUBLIC`: the `vapidPublicKey` from `config.js`
   - `VAPID_PRIVATE`: the private key that goes with it. Never commit it.
4. **Start it:** Actions tab → Push worker → **Run workflow**. After that it keeps itself going every hour.

## Notes

- **iPhone:** iOS 16.4 or newer, and the app has to be opened from the Home Screen. Notifications are turned on in the app under Settings → Notifications.
- **GitHub pauses scheduled workflows** in a repo with no commits for 60 days. Pushing any commit, or re-enabling the workflow in the Actions tab, starts it again.
- **Test without credentials:** `DRY_RUN=1 NO_FIREBASE=1 RUN_MINUTES=1 node worker.js` loads the engine and prints the upcoming news.
- **New VAPID keys:** `npx web-push generate-vapid-keys`. Update `config.js` and both secrets. Every device then has to turn notifications on again.
