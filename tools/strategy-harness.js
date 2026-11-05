// Runs inside the game page. Rules use only what a player sees: 10s candles, volume vs. "normal", headlines.
window.WHISP=function(days){ const T0=H2*3600+600, T1=T0+days*86400, R={}; const news=newsSince(T0,T1+90000).sort((a,b)=>a.at-b.at);
  for(const x of news){ if(x.tell!=='whisper'||x.at>T1) continue; const m=x.t.match(/(buying|dumping) ([A-Z, ]+)\./); const s=m[2].split(', ')[0], up=m[1]==='buying', e=news.find(y=>y.ev&&y.at>x.at&&y.at-x.at<=600); if(!e) continue; const i=BYSYM[s].i, P=t=>price(i,t), k=e.ev.sc.k;
    for(const [lab,ex] of [['headline',e.at],['+30m',e.at+1800],['+1h',e.at+3600],['+6h',e.at+21600],['+24h',e.at+86400]]){ const r=(P(ex)/P(x.at+5)-1)*(up?1:-1); (R[k+' exit '+lab]=R[k+' exit '+lab]||[]).push(r); } }
  const out={}; for(const k in R){ const a=R[k]; out[k]={n:a.length,win:+(a.filter(x=>x>0).length/a.length*100).toFixed(1),avg:+(a.reduce((x,y)=>x+y,0)/a.length*100).toFixed(2),worst:+(Math.min(...a)*100).toFixed(1)}; } return out; };
window.HARN=function(days, opts){ opts=opts||{}; const T0=H2*3600+600, T1=T0+days*86400, R={};
  const add=(k,ret)=>{ (R[k]=R[k]||[]).push(ret); };
  const live=SER.filter(d=>!d.idx&&!d.gone);
  const STEADY=["BRGR","BREW","SHOP","BANK","MEDX","OILX"], PUMPY=["PNNY","SOLR","ORBT"], JUMP=["SOLR","ORBT","CHIP","ROBO","SKYD","RAMX","EVCO","AIQ"];
  const news=newsSince(T0-3600,T1+3600).sort((a,b)=>a.at-b.at);
  const hasNews=(sym,t0,t1)=>news.some(x=>(x.s===sym||x.s==="*")&&x.at>t0&&x.at<=t1);
  const flushT=t=>{ const h=Math.floor(t/3600); return h%3===0&&t-h*3600<=330; };
  for(const d of live){ const i=d.i, sym=d.s; const c=[]; // 10s candles
    for(let t=T0;t<T1;t+=10){ let v=0,hi=-1e9,lo=1e9; const o=price(i,t); for(let k=0;k<10;k++){ const p=price(i,t+k); hi=Math.max(hi,p); lo=Math.min(lo,p); v+=volAt(i,t+k); } c.push({t,o,c:price(i,t+10),v,hi,lo}); }
    const med=a=>{ const b=a.slice().sort((x,y)=>x-y); return b[b.length>>1]; };
    let nv=[], nb=[], cdV=0, cdC=0, cdK=0;
    for(let j=30;j<c.length-60;j++){ const prev=c.slice(j-30,j), N=med(prev.map(x=>x.v)), B=med(prev.map(x=>Math.abs(x.c-x.o)/x.o))||1e-6, k=c[j], te=k.t+10;
      const P=t=>price(i,t);
      // R1 volume builds: 3 candles, each more volume than the last, all >=1.5x normal, small bodies (<=1.5x typical)
      if(te>cdV&&!flushT(te)){ const a=c[j-2],b=c[j-1]; const ok=[a,b,k].every(x=>x.v>=1.5*N&&Math.abs(x.c-x.o)/x.o<=1.5*B)&&a.v<b.v&&b.v<k.v&&k.v<4.5*N;
        if(ok&&!hasNews(sym,te-120,te)){ add("1 volume builds (buy, +3m)",P(te+180)/P(te)-1); cdV=te+300; } }
      // R2 coil: 6 quiet candles (<=0.5x normal volume)
      if(te>cdC){ let q=true; for(let m=0;m<6;m++) if(!(c[j-m].v<=.5*N)) q=false; if(q){ add("4 coil (buy at 6th quiet candle, +4m)",P(te+240)/P(te)-1); cdC=te+400; } }
      // R6 capitulation tell: steady stock, 4 red candles each >=2x volume, small bodies, no headline, not flush time
      if(STEADY.includes(sym)&&te>cdK&&!flushT(te)){ let q=true, red=0; for(let m=0;m<4;m++){ const x=c[j-m]; if(x.c<x.o) red++; if(!(x.v>=2*N&&x.v<4.5*N)) q=false; } if(red<3||!(k.c<c[j-3].o)) q=false;
        if(q&&!hasNews(sym,te-300,te)){ add("5a capitulation tell (short, cover +80s)",1-P(te+80)/P(te)); add("5b ...then buy at +80s, sell +4m",P(te+320)/P(te+80)-1); cdK=te+400; } }
    }
  }
  // headline rules
  for(const x of news){ if(x.at<T0||x.at>T1-3600) continue; const d=BYSYM[x.s]; const P=(sym,t)=>price(BYSYM[sym].i,t);
    if(x.tell==="beat"){ const main=news.find(y=>y.s===x.s&&y.at>x.at&&/beats earnings/.test(y.t)); if(main) add("2a call-option buying (buy, sell 5m after earnings)",P(x.s,main.at+300)/P(x.s,x.at+5)-1); }
    if(/Rumor:/.test(x.t)&&d) add("2b rumor (short +60s, cover +6m)",1-P(x.s,x.at+360)/P(x.s,x.at+60));
    if(x.tell==="deadcat"){ const main=news.find(y=>y.s===x.s&&y.at>x.at&&/investigation/.test(y.t)); if(main) add("5c insiders selling (short, cover 5m after report)",1-P(x.s,main.at+300)/P(x.s,x.at+5)); }
    if(x.tell==="pump"){ add("6a trending (buy, sell +170s)",P(x.s,x.at+170)/P(x.s,x.at+5)-1); }
    if(/auditor resigns/.test(x.t)) add("8 collapse headline (short, cover +250s)",1-P(x.s,x.at+250)/P(x.s,x.at+5));
    if(/Short interest/.test(x.t)) add("9 squeeze headline (buy, sell +215s)",P(x.s,x.at+215)/P(x.s,x.at+5)-1);
    if(x.tell==="crash"){ for(const s of JUMP) add("10 crash warning (short jumpy, cover +220s)",1-P(s,x.at+220)/P(s,x.at+5)); }
    if(x.tell==="whisper"){ const m=x.t.match(/(buying|dumping) ([A-Z, ]+)\./); if(m){ const s=m[2].split(", ")[0], up=m[1]==="buying"; const e=news.find(y=>y.ev&&y.at>x.at&&y.at-x.at<=600);
      if(e&&BYSYM[s]){ const r=P(s,e.at+3600)/P(s,x.at+5)-1; add("11 whisper (trade top stock, close 1h after headline)",up?r:-r); } } }
  }
  // pump dump (existing rule): from the pump spike start (ground truth only used to find the spike candles' time a player sees)
  for(const d of live){ if(!PUMPY.includes(d.s)) continue; for(let h=Math.floor(T0/3600);h<Math.floor(T1/3600)-1;h++) sched(d.i,h).eps.forEach(e=>{ if(e.ty!=="pump") return; const o=h*3600+e.st+(e.sOff||0); add("6b pump dump (short 30s after 3 big green, cover +4m)",1-price(d.i,o+30+30+240)/price(d.i,o+60)); }); }
  const out={}; for(const k in R){ const a=R[k]; out[k]={n:a.length,win:+(a.filter(x=>x>0).length/a.length*100).toFixed(1),avg:+(a.reduce((x,y)=>x+y,0)/a.length*100).toFixed(2),worst:+(Math.min(...a)*100).toFixed(1),best:+(Math.max(...a)*100).toFixed(1)}; }
  return out; };
