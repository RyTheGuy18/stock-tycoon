// Smoke test: run before every release.  node tools/smoke-test.js [path/to/index.html]
// Needs Playwright + Chrome (set CHROME=/path/to/chrome if it isn't /usr/bin/google-chrome).
// Loads the game offline (network blocked) and checks the core loops still work. Exits 1 on any failure.
const path=require('path'); let pw; try{ pw=require('playwright'); }catch(e){ pw=require('/opt/npm-tools/node_modules/playwright'); }
const file='file://'+path.resolve(process.argv[2]||path.join(__dirname,'..','index.html'));
(async()=>{
  const b=await pw.chromium.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});
  const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/*',r=>r.request().url().startsWith('file://')?r.continue():r.abort());
  await p.goto(file); await p.waitForTimeout(2500);
  const res=await p.evaluate(()=>{ const R=[]; const ok=(n,c,d)=>R.push([n,!!c,d||'']);
    const fresh0=()=>{ S=fresh(); S.introSeen=1; S.momDone=true; S.bestNW=100; S.prof=Object.keys(PB)[0]; SIM=false; closeModal(); };
    try{
      // 1. game starts
      fresh0(); build(); ok('game builds', typeof netWorth()==='number');
      // 2. manual buy and close
      S.cash=100; const sym=STOCKS[0].s; S.sel=sym; trade('buy',2); ok('buy 2 PNNY', P(sym).l===2, 'cash '+S.cash.toFixed(2));
      trade('sell',2); ok('sell trade', !P(sym).l && S.hist.length>0, 'cash '+S.cash.toFixed(2));
      // 3. a job pays
      fresh0(); S.cash=0; startJob(0); const j=S.job; ok('job starts', !!j); if(j){ NOW=j.end; finishJob(); } ok('job pays', S.cash>0, 'cash '+S.cash.toFixed(2));
      // 4. bots earn while away and don't snowball
      fresh0(); S.cash=5; S.auto={}; for(const id of ['pscalp','pflush','ppump','pswing']){ const a=A(id); a.own=1; a.on=1; a.lv=1; a.v=40; }
      bills=()=>{}; const t0=Math.floor(Date.now()/1000)-12*3600; S.lastT=t0; NOW=t0; SIM=true; advance(t0+12*3600); SIM=false;
      ok('bots earn overnight', netWorth()>6, 'NW $'+netWorth().toFixed(2)); ok('bots overnight under $100 from $5', netWorth()<100, 'NW $'+netWorth().toFixed(2));
      // 5. tax day: never more than earned
      fresh0(); S.cash=1000; S.tx={w:taxWk(NOW)-1,inc:500000,gain:0,sales:0}; const before=S.cash; const bl=taxBill(S.tx,true); ok('war-year income tax <= 50% of earnings', bl.it<=250000+1e-6, 'tax $'+bl.it.toFixed(0));
      // 6. debt: Mom text, credit card, broke after 24 h
      fresh0(); S.cash=5; bill('Taxes',25); solvency(); ok('debt starts 24 h timer', S.debtDue>NOW); ok('credit card offered', /credit card/i.test(document.getElementById('modal').innerText));
      const b0=document.querySelector('#modal [data-i="0"]'); b0&&b0.click(); ok('credit card works', ccOn()&&buyPow()>0, 'credit $'+buyPow().toFixed(2));
      S.cash+=30; txInc(30); ok('debt payoff not taxed', Math.abs(TX().inc-10)<.01, 'taxed $'+TX().inc.toFixed(2));
      fresh0(); S.cash=5; bill('Taxes',25); NOW=S.debtDue+1; solvency(); ok('broke after 24 h', S.st.broke===1 && S.cash===0);
      // 7. saves round-trip
      fresh0(); S.cash=42; const js=JSON.stringify(S); ok('save serializes', JSON.parse(js).cash===42);
    }catch(e){ ok('no exceptions', false, e.message); }
    return R; });
  let bad=0; for(const [n,g,d] of res){ console.log((g?'✓':'✗')+' '+n+(d?'  ('+d+')':'')); if(!g) bad++; }
  for(const e of errs){ console.log('✗ page error: '+e); bad++; }
  await b.close(); console.log(bad?`\n${bad} FAILED`:'\nAll good'); process.exit(bad?1:0);
})();
