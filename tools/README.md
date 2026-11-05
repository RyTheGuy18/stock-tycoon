# Strategy harness

`strategy-harness.js` re-tests every lesson rule against the synced market, using only what a player can see
(10s candles, volume vs. normal, headlines). Load the game in a browser (or headless Chromium), inject the file, then run:

- `HARN(days)` → win rate / average / worst / best for each rule over `days` days after the H2 cutover
- `WHISP(days)` → breaking-news whisper trades, split into fast ('f') and slow ('s') stories, at several exit times

Re-run it after any engine change. Engine changes alter the market for everyone, so gate them behind a new cutover hour
(like H1 and H2) and check that prices before it stay byte-identical.
