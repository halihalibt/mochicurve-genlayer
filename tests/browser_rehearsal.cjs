// Optional browser integration check; requires Playwright and a permitted Chromium runtime.
const { chromium } = require(require.resolve('playwright', {paths: [process.cwd(), process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES].filter(Boolean)}));
const assert = require('node:assert/strict');
const {mkdirSync} = require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:["--no-sandbox"]});
 const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // This check always exercises labeled rehearsal, even after the repository has a live address.
 await page.route('**/*',async route=>{
   const url=route.request().url();
   if(!url.startsWith('http://127.0.0.1:4173'))return route.abort();
   if(new URL(url).pathname.endsWith('/dist/app.js')) {
     const response=await route.fetch();
     const body=(await response.text()).replace(/CONTRACT_ADDRESS:"0x[0-9a-fA-F]{40}"/, 'CONTRACT_ADDRESS:""');
     return route.fulfill({response,body});
   }
   return route.continue();
 });
 await page.addInitScript(()=>{window.ethereum={request:async({method})=> method==='eth_requestAccounts'?[window.testActor||'0x1111111111111111111111111111111111111111']:'0xf22f'};});
 await page.clock.install({time:new Date('2026-11-13T00:00:00Z')});
 await page.goto('http://127.0.0.1:4173/');
 await page.waitForFunction(()=>document.querySelector('#hud-mode-label')?.textContent.includes('LOCAL') || document.body.textContent.includes('LOCAL_REHEARSAL_SEED'));
 await page.locator('#btn-connect-wallet').click({force:true});
 await page.locator('details.launch-drawer > summary').click({force:true});
 await page.locator('#launch-id').fill('browser-v3');
 await page.locator('#launch-name').fill('Browser V3 Check');
 await page.locator('#launch-repo').fill('halihalibt/mochicurve-genlayer');
 await page.locator('#launch-secret-raw').fill('salt|secret');
 await page.locator('#btn-launch-curve').click({force:true});
 await page.waitForFunction(()=>document.querySelector('#active-curve-name').textContent==='Browser V3 Check');
 await page.locator('#input-trade-amount').fill('71');
 await page.locator('#input-trade-amount').dispatchEvent('input');
 await page.locator('#btn-buy-tokens').click({force:true});
 await page.locator('#btn-evaluate-gate').click({force:true});
 await page.waitForFunction(()=>!document.querySelector('#pending-verdict-box').hidden);
 assert(await page.locator('#btn-execute-verdict').isDisabled());
 assert(await page.locator('#btn-challenge-verdict').isDisabled());
 const deadline=(await page.locator('#pending-verdict-text').textContent()).match(/Deadline \(UTC\): ([^\s]+)/)[1];
 await page.evaluate(()=>window.testActor='0x2222222222222222222222222222222222222222');
 await page.locator('#btn-connect-wallet').click({force:true});
 await page.locator('#input-challenge-verdict').selectOption('RUG_SLASHED');
 await page.locator('#btn-challenge-verdict').click({force:true});
 assert(await page.locator('#btn-challenge-verdict').isDisabled());
 await page.locator('#btn-evaluate-gate').click({force:true});
 assert((await page.locator('#pending-verdict-text').textContent()).includes(deadline));
 await page.clock.setFixedTime(new Date(deadline));
 await page.locator('#btn-lang-toggle').click({force:true});
 assert(await page.locator('#btn-execute-verdict').isEnabled());
 await page.locator('#btn-execute-verdict').click({force:true});
 assert(await page.locator('#pending-verdict-box').isHidden());
 assert.equal(errors.length,0,JSON.stringify(errors));
 mkdirSync('.qa',{recursive:true});
 await page.screenshot({path:'.qa/desktop.png'});
 await page.setViewportSize({width:390,height:844});
 assert(await page.locator('#btn-lang-toggle').isVisible());
 await page.screenshot({path:'.qa/mobile.png'});
 console.log('PASS browser rehearsal: launch, buy, creator evaluation, deadline, self-challenge disabled, noncreator challenge/review/expiry execution, desktop/mobile render; no page errors, external requests blocked. Local browser clock only; not chain evidence.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
