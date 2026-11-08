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

## v7.9 news revamp (H8 = Nov 7 2026 19:00 UTC, 1pm Central)
- From H8 the old breaking news (`bigEv`), the every-30-min small news (`minorNews`) and the mood headlines are off. News comes from
  `newsV2` (market-wide / industry / big company / everyday company) and moves prices through `nwo()` (added inside `evo()`).
- Earnings / rumor / investigation episodes now only come from the company news schedule (`nCoEp`), about 1 a day per stock, with
  their moves doubled. To test the new engine, replace `H2*3600` / `H3*3600` with `H8*3600` in the harness T0 lines.
- Whispers come from industry and big company stories in `newsV2` (not `newsSince`), so `WHISP` no longer finds them; test with
  `newsV2(...).filter(x=>x.tell==='whisper')` and close 1 h after the story.

## v8.0 more patterns (H9 = Nov 7 2026 19:00 UTC, 1pm Central)
- From H9 each hour has 6 pattern slots of 10 min (was 3 of 20 min) and a higher chance per slot, so patterns come about 3x as often.
  Long patterns (chart shapes, squeezes) take two slots. Patterns never start on top of the flush, the morning open, PNNY's midnight
  crash or a daily routine. Test with `H9*3600` in the harness T0 lines.
- PNNY bots: Lv 1 now uses up to 75% of cash per trade (ladder 75/80/85/90/95%); default slider = 75%. New plays: Penny Scalper also
  fades PNNY at :30 (PNNY always comes home) and shorts the midnight crash; Pump Sniper buys the trending tell at Lv 1; Breakout
  Rider also trades PNNY's chart shapes. Offline sim: `bots.py` style, advance() with SIM=true over 4 h windows.
- v114 (same H9): patterns are placed back to back (at least 100 s apart, plus a random gap) instead of in slots; each stock has its
  own pace (`PACE`, 0.65-1.35x). Fewer fakeouts, collapses/squeezes x0.3, breakouts 1.3x stronger, flush dip 1.6x deeper.

## Releasing
Every release bumps BOTH numbers to the same value: `const APPV="NN"` in index.html and `const C = "tt-vNN"` in sw.js.
The Settings → App updater compares them; if only sw.js changes, the app keeps showing the old version.

## v8.4 bot rebalance
`bot-harness.js`: `BOTLV(days)` measures each trading bot alone at every level at its max bet; `AWAY(cash,hours,bots)` averages
net worth after time away. Upgrade prices (`PUPC`) = about 24 h of the extra $/day a level adds at its max bet. Max bet per level =
`PBASE` x `PMUL[bot]`; the slider's top (`PMXP`) is low for the frequent bots and 100% for the News bot.
