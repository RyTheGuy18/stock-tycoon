window.SHP=function(days){ const T0=H3*3600+3600, T1=T0+days*86400, R={}; const add=(k,v,real)=>{ (R[k]=R[k]||[]).push(v); if(real!=null){ (R[k+(real?' [REAL]':' [false alarm]')]=R[k+(real?' [REAL]':' [false alarm]')]||[]).push(v); } };
  const isReal=(i,t,tys)=>{ const h=Math.floor(t/3600); for(const hh of [h,h-1]){ const e=sched(i,hh).eps.find(x=>x.shape&&tys.includes(x.ty)); if(e){ const s0=hh*3600+e.st; if(t>=s0&&t<=s0+epLen(e)) return true; } } return false; };
  const live=SER.filter(d=>!d.idx&&!d.gone); let truth={};
  for(const d of live){ const i=d.i, c=[];
    for(let t=T0-3600;t<T1;t+=10){ let v=0,hi=-1e9,lo=1e9; const o=price(i,t); for(let k=0;k<10;k++){ const p=price(i,t+k); hi=Math.max(hi,p); lo=Math.min(lo,p); v+=volAt(i,t+k); } const cl=price(i,t+10); hi=Math.max(hi,cl); lo=Math.min(lo,cl); c.push({t,o,c:cl,v,hi,lo}); }
    const med=a=>{ const b=a.slice().sort((x,y)=>x-y); return b[b.length>>1]; };
    const cd={};
    for(let j=360;j<c.length-30;j++){ const k=c[j], te=k.t+10, P=t=>price(i,t), win=c.slice(j-360,j); // last hour before this candle
      const H=Math.max(...win.map(x=>x.hi)), Lo=Math.min(...win.map(x=>x.lo)), N=med(win.slice(-30).map(x=>x.v)), u=med(win.map(x=>Math.abs(x.c-x.o)/x.o))*3.6*k.c, tol=.35*u;
      const body=Math.abs(k.c-k.o), up=k.hi-Math.max(k.o,k.c), dn=Math.min(k.o,k.c)-k.lo;
      const touchesH=(a,b,lvl)=>{ const r=[]; for(let m=a;m<=b;m++) if(Math.abs(c[m].hi-lvl)<=tol) r.push(m); return r; };
      const touchesL=(a,b,lvl)=>{ const r=[]; for(let m=a;m<=b;m++) if(Math.abs(c[m].lo-lvl)<=tol) r.push(m); return r; };
      const H2_=Math.max(H,k.hi), L2_=Math.min(Lo,k.lo);
      // double top: this candle touches the 1h high with a long upper wick and closes lower; an earlier touch 1.5-6 min ago; a dip of 1.5u+ between
      if(!(cd.dt>te)&&Math.abs(k.hi-H2_)<=tol&&up>=.7*u&&up>=2.5*body){ const prev=touchesH(j-36,j-9,H2_); if(prev.length){ const a=prev[prev.length-1]; const mn=Math.min(...c.slice(a,j).map(x=>x.lo));
        if(H2_-mn>=1.8*u&&touchesH(j-60,j-1,H2_).length<=4){ add("double top (short, +4m)",1-P(te+240)/P(te),isReal(i,te,["dtop"])); cd.dt=te+400; } } }
      if(!(cd.db>te)&&Math.abs(k.lo-L2_)<=tol&&dn>=.7*u&&dn>=2.5*body){ const prev=touchesL(j-36,j-9,L2_); if(prev.length){ const a=prev[prev.length-1]; const mx=Math.max(...c.slice(a,j).map(x=>x.hi));
        if(mx-L2_>=1.8*u&&touchesL(j-60,j-1,L2_).length<=4){ add("double bottom (buy, +4m)",P(te+240)/P(te)-1,isReal(i,te,["dbot"])); cd.db=te+400; } } }
      // ascending triangle: 3rd touch of the 1h high in ~6 min, each dip between touches shallower
      if(!(cd.at>te)&&Math.abs(k.hi-H2_)<=.25*u&&up<.5*u&&k.v>=1.4*N){ const ts=touchesH(j-40,j,H2_).filter(m=>Math.abs(c[m].hi-H2_)<=.25*u); const grp=[]; ts.forEach(m=>{ if(!grp.length||m-grp[grp.length-1]>3) grp.push(m); });
        if(grp.length>=3){ const g=grp.slice(-3); const d1=Math.min(...c.slice(g[0],g[1]).map(x=>x.lo)), d2=Math.min(...c.slice(g[1],g[2]).map(x=>x.lo));
          if(j-g[0]>=20&&H2_-d1>=1.5*u&&H2_-d2>=.7*u&&d2>d1+.5*u){ add("ascending triangle (buy at 3rd touch, +4m)",P(te+240)/P(te)-1,isReal(i,te,["atri"])); cd.at=te+400; } } }
      if(!(cd.dtr>te)&&Math.abs(k.lo-L2_)<=.25*u&&dn<.5*u&&k.v>=1.4*N){ const ts=touchesL(j-40,j,L2_).filter(m=>Math.abs(c[m].lo-L2_)<=.25*u); const grp=[]; ts.forEach(m=>{ if(!grp.length||m-grp[grp.length-1]>3) grp.push(m); });
        if(grp.length>=3){ const g=grp.slice(-3); const u1=Math.max(...c.slice(g[0],g[1]).map(x=>x.hi)), u2=Math.max(...c.slice(g[1],g[2]).map(x=>x.hi));
          if(j-g[0]>=20&&u1-L2_>=1.5*u&&u2-L2_>=.7*u&&u2<u1-.5*u){ add("descending triangle (short at 3rd touch, +4m)",1-P(te+240)/P(te),isReal(i,te,["dtri"])); cd.dtr=te+400; } } }
      // flags: a pole (6+ candles, 3u+ move on 2x volume) then 12+ quiet candles drifting back (low volume, small), buy/short now
      for(const sg of [1,-1]){ const key="f"+sg; if(cd[key]>te) continue; const fl=c.slice(j-11,j+1);
        const quiet=fl.every(x=>x.v<=.9*N&&Math.abs(x.c-x.o)<=.6*u), drift=(fl[11].c-fl[0].o)*sg; if(!quiet||!(drift<0&&drift>-2.2*u)) continue;
        const pole=c.slice(j-21,j-11); const mv=(pole[pole.length-1].c-pole[0].o)*sg, pv=med(pole.map(x=>x.v));
        if(mv>=2.5*u&&pv>=1.8*N){ add(sg>0?"bull flag (buy, +4m)":"bear flag (short, +4m)",(P(te+240)/P(te)-1)*sg); cd[key]=te+400; } }
    } }
  const out={}; for(const k in R){ const a=R[k]; out[k]={n:a.length,win:+(a.filter(x=>x>0).length/a.length*100).toFixed(1),avg:+(a.reduce((x,y)=>x+y,0)/a.length*100).toFixed(2),worst:+(Math.min(...a)*100).toFixed(1),best:+(Math.max(...a)*100).toFixed(1)}; }
  // ground truth count
  let tc={}; for(const d of live) for(let h=Math.floor(T0/3600);h<Math.floor(T1/3600);h++){ const e=sched(d.i,h).eps.find(x=>x.shape); if(e) tc[e.ty]=(tc[e.ty]||0)+1; } out._truth=tc;
  return out; };
