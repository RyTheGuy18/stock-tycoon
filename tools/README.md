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

## v7.0 (H4 = Nov 7 2026 05:00 UTC)
- Volume follows the size of the noise move much more closely, so the volume rules were re-checked. `CK` in strategy-harness.js holds the
  capitulation tell rule (3–4.5× volume, bodies no bigger than usual, cover after 50 s); `TV` in shape-harness.js holds the triangle
  3rd-touch volume (1.8×).
- To test the new engine, replace `H2*3600` / `H3*3600` with `H4*3600` in the harness T0 line.
- PNNY lessons (midnight crash, 1h snap), the flush, the morning open and every daily routine were checked with a separate script over 60–150 days.
