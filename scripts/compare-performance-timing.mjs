// Interleave baseline/optimized pages and same-page controls; no count wrappers.
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const urls=process.argv.slice(2);
if(urls.length!==2) throw Error('Provide baseline and optimized local URLs');
const browser=await chromium.launch({args:['--use-angle=d3d11','--autoplay-policy=no-user-gesture-required','--mute-audio']});
try {
  const results={};
  for(const mobile of [false,true]) {
    const pages=[];
    for(const url of urls) {
      const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:720},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1});
      const page=await context.newPage();await page.goto(url+'?capture');
      await page.waitForFunction(()=>window.__encore?.state()==='title');
      await page.evaluate(()=>window.__encore.app.save.seen.push('intro'));await page.click('.title-play',{force:true});
      await page.waitForFunction(()=>window.__encore.state()==='map');
      await page.evaluate(async()=>{
        const a=window.__encore.app;a.frame=()=>{};
        let seed=1234567;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
        await window.__encore.play('fur-elise','hard','piano',true);
        a.renderer.scale=1;a.renderer.resize(innerWidth,innerHeight);a.stage.intro=1;
        const weather=a.stage.weather.update.bind(a.stage.weather);a.stage.weather.update=(dt,_time,drift)=>weather(dt,10,drift);
        window.__timedStep=i=>{
          seed=7654321+i;
          const stage=a.stage,t=2+i/60;
          if(i%12===0){const k=stage.keys[(i/12|0)%stage.keys.length];stage.press(k.lane,true);stage.particles.burst(k.x,.35,0,k.color,26);stage.rings.spawn(k.x,.08,0,k.color,k.width*1.5);}
          if(i%12===5)for(const k of stage.keys)stage.press(k.lane,false);
          stage.update(1/60,t,{encore:0,encoreActive:false,harmony:.8,holding:new Set()});
          a.world.update(1/60,10+i/60,.1,.8,0,stage.unitsPerSong*.75*.35,0);a.coda?.update(1/60,10+i/60,0,.8);a.renderer.render();
        };
        for(let i=0;i<60;i++)window.__timedStep(i);
      });
      const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:mobile?4:1});
      pages.push(page);
    }
    const measure=(page,start)=>page.evaluate(async start=>{
      let total=0;
      for(let i=0;i<5;i++){await new Promise(requestAnimationFrame);const t=performance.now();window.__timedStep(start+i);total+=performance.now()-t;}
      return total/5;
    },start);
    const pairs=[],controls=[];
    for(let i=0;i<12;i++){
      const pair=[];
      for(const arm of i%2?[1,0]:[0,1])pair[arm]=await measure(pages[arm],60+i*5);
      pairs.push(pair);
    }
    for(let i=0;i<12;i++)controls.push([await measure(pages[1],120+i*10),await measure(pages[1],125+i*10)]);
    const median=a=>[...a].sort((a,b)=>a-b)[a.length>>1];
    results[mobile?'mobile':'desktop']={pairs,controls,beforeMedianMs:median(pairs.map(p=>p[0])),afterMedianMs:median(pairs.map(p=>p[1])),medianRatio:median(pairs.map(p=>p[1]/p[0])),controlMedianRatio:median(controls.map(p=>p[1]/p[0])),controlRange: [Math.min(...controls.map(p=>p[1]/p[0])),Math.max(...controls.map(p=>p[1]/p[0]))]};
    console.log(mobile?'mobile':'desktop',JSON.stringify(results[mobile?'mobile':'desktop']));
    for(const page of pages)await page.context().close();
  }
  await writeFile('artifacts/performance/timing-comparison.json',JSON.stringify(results,null,2));
}finally{await browser.close();}
