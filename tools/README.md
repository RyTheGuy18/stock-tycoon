# Strategy harness

`strategy-harness.js` re-tests every lesson rule against the synced market, using only what a player can see
(10s candles, volume vs. normal, headlines). Load the game in a browser (or headless Chromium), inject the file, then run:

- `HARN(days)` → win rate / average / worst / best for each rule over `days` days after the H2 cutover
- `WHISP(days)` → breaking-news whisper trades, split into fast ('f') and slow ('s') stories, at several exit times

Re-run it after any engine change. Engine changes alter the market for everyone, so gate them behind a new cutover hour
(like H1 and H2) and check that prices before it stay byte-identical.

`shape-harness.js` tests the chart-pattern lessons (double top/bottom at the 1h high/low, triangles, flags) after the H3 cutover:
`SHP(days)` → win rates per pattern, split into real patterns vs. false alarms, plus how many of each pattern the engine made.
"Normal volume" in all rules = the median 10s volume over the last hour.
