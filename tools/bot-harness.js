// Bot harness (v8.4). Load the game (headless Chromium is fine), inject this file, then:
//   BOTLV(days)            -> each bot alone at Lv 1-5 with $5M cash (max bet always hit): trades/day and $/day
//   AWAY(cash,hours,bots)  -> average net worth after `hours` away over 8 windows, e.g. AWAY(5,4,{pscalp:[1,30],pflush:[1,15],ppump:[1,30],pswing:[1,10]})
// Bills, taxes and broke checks are switched off so only the bots move money.
window.TALLY={};
const _bl=botLog; botLog=function(id,pl){ const k=String(id).split(":")[0]; const r=TALLY[k]=TALLY[k]||{n:0,pl:0,w:0}; r.n++; r.pl+=pl; if(pl>0) r.w++; return _bl(id,pl); };
bills=()=>{}; taxDay=()=>{}; solvency=()=>{}; toast=()=>{}; sfx=()=>{}; life=()=>{};
function simRun(o){ TALLY={}; S=fresh(); S.momDone=true; S.bestNW=1e9; S.introSeen=1; S.cash=o.cash; S.auto={};
  for(const id in o.bots){ const a=A(id); a.own=1; a.on=1; a.lv=o.bots[id]; a.v=100; }
  const t0=H9*3600+3600; S.lastT=t0; NOW=t0; SIM=true;
  for(let t=t0;t<t0+o.days*86400;t+=3600){ advance(t+3600); S.cash=o.cash; } SIM=false; return TALLY; }
window.BOTLV=(days=4)=>{ const r={}; for(const id of PNB){ for(let l=1;l<=5;l++){ const k=simRun({cash:5e6,bots:{[id]:l},days})[id]||{n:0,pl:0}; r[id+" Lv"+l]=`max bet $${pCapL(id,l)}, ${(k.n/days).toFixed(1)}/day, $${Math.round(k.pl/days)}/day`; } } return r; };
window.AWAY=(cash,hours,bots)=>{ const res=[]; for(let w=0;w<8;w++){ S=fresh(); S.momDone=true; S.bestNW=cash; S.introSeen=1; S.cash=cash; S.auto={};
    for(const id in bots){ const a=A(id); a.own=1; a.on=1; a.lv=bots[id][0]; a.v=bots[id][1]; }
    const t0=H9*3600+3600+w*4*3600+w*977; S.lastT=t0; NOW=t0; SIM=true; advance(t0+hours*3600); SIM=false; res.push(netWorth()); }
  return res.reduce((a,b)=>a+b,0)/res.length; };
