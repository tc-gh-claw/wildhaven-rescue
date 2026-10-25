// Optional integration test. Install playwright or point PLAYWRIGHT_MODULE at an existing installation.
// Start `npm start` first. CHROME_PATH may point to an existing Chrome executable.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { MISSIONS } from '../src/missions.js';
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const artifactDir=process.env.TEST_ARTIFACTS||'test-artifacts';await mkdir(artifactDir,{recursive:true});
const base=process.env.TEST_URL||'http://127.0.0.1:4173';
const gameURL=process.env.GAME_URL||base+'/?test=1';
const errors=[],checks=[];
function check(label){checks.push(label);console.log(`PASS ${label}`);}
const context=await browser.newContext({viewport:{width:1280,height:800}});
await context.addInitScript(()=>{if(!localStorage.getItem('wildhaven-settings'))localStorage.setItem('wildhaven-settings',JSON.stringify({quality:'low',sound:false,reducedMotion:true,sensitivity:1}));});
const page=await context.newPage();page.setDefaultTimeout(20000);
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const snapshot=()=>page.evaluate(()=>window.__wildhaven.snapshot());
try{
  await page.goto(gameURL);await page.locator('#home:not([hidden])').waitFor();
  assert.match(await page.locator('#home').innerText(),/Your field briefing/);assert.match(await page.locator('#home').innerText(),/RANGER’S CODE/);check('English start screen, rules, and controls render');
  await page.screenshot({path:`${artifactDir}/home.png`});
  await page.click('#start');await page.waitForFunction(()=>window.__wildhaven.snapshot().mode==='play');
  const start=(await snapshot()).position;await page.keyboard.down('w');await page.waitForFunction(z=>window.__wildhaven.snapshot().position.z<z-1.2,start.z);await page.keyboard.up('w');assert.ok((await snapshot()).position.z<start.z-1);check('Keyboard movement changes the real 3D player position');
  await page.keyboard.press('v');assert.equal((await snapshot()).cameraMode,'first');await page.keyboard.press('v');assert.equal((await snapshot()).cameraMode,'third');check('First and third person toggle both ways');
  await page.mouse.move(700,500);await page.mouse.down();await page.mouse.move(850,470,{steps:4});await page.mouse.up();await page.keyboard.press('v');assert.notEqual((await snapshot()).state.player.yaw,0);await page.keyboard.press('v');check('Dragging the scene changes the camera heading');
  await page.keyboard.press('Escape');assert.equal((await snapshot()).modal,'pause');const paused=(await snapshot()).state.elapsed;await page.waitForTimeout(300);assert.equal((await snapshot()).state.elapsed,paused);await page.click('#resume');check('Pause stops expedition time');
  await page.keyboard.press('m');await page.click('[data-track="turtle"]');assert.equal((await snapshot()).state.selectedMission,'turtle');await page.keyboard.press('j');assert.match(await page.locator('#modal').innerText(),/Sunda pangolin/);await page.keyboard.press('Escape');check('Map tracking and field journal work');

  for(const mission of MISSIONS){
    await page.evaluate(id=>window.__wildhaven.teleport(id),mission.id);await page.waitForFunction(id=>window.__wildhaven.snapshot().nearby===id,mission.id);await page.keyboard.press('e');await page.locator('#modal-title').waitFor();
    if(mission.id==='tiger'){
      await page.fill('#rescue-code','000');await page.click('[data-action="submit-puzzle"]');assert.equal((await snapshot()).state.missions.tiger.unlocked,false);assert.match(await page.locator('#rescue-feedback').innerText(),/Not quite/);await page.fill('#rescue-code',mission.puzzle.solution);
    }else if(mission.puzzle.kind==='order'||mission.puzzle.kind==='sequence'){
      for(const id of mission.puzzle.solution)await page.click(`.symbol-button[data-value="${id}"]`);
      await page.click('[data-action="undo-sequence"]');await page.click(`.symbol-button[data-value="${mission.puzzle.solution.at(-1)}"]`);
    }else{
      await page.click('[data-action="submit-puzzle"]');assert.equal((await snapshot()).state.missions.turtle.unlocked,false);
      for(let index=0;index<3;index++)for(let turn=0;turn<mission.puzzle.solution[index];turn++)await page.click(`[data-valve="${index}"]`);
    }
    await page.click('[data-action="submit-puzzle"]');assert.equal((await snapshot()).state.missions[mission.id].unlocked,true);
    const wrong=mission.careSteps[0].options.find(o=>o.id!==mission.careSteps[0].correct).id;
    await page.click(`[data-choice="${wrong}"]`);assert.equal((await snapshot()).state.missions[mission.id].careStep,0);assert.ok((await page.locator('#rescue-feedback').innerText()).length>0);
    for(let step=0;step<mission.careSteps.length;step++){
      await page.click(`[data-choice="${mission.careSteps[step].correct}"]`);
      if(mission.id==='tiger'&&step===0){
        await page.reload();await page.locator('#continue:not([hidden])').waitFor();await page.click('#continue');await page.waitForFunction(()=>window.__wildhaven.snapshot().nearby==='tiger');await page.keyboard.press('e');assert.equal((await snapshot()).state.missions.tiger.careStep,1);check('Reload resumes a partially completed treatment');
      }
    }
    assert.equal((await snapshot()).state.missions[mission.id].rescued,true);check(`${mission.species}: puzzle, wrong-answer recovery, all care steps, rescue completion`);
    await page.click('#rescue-done');
  }
  assert.equal((await snapshot()).modal,'victory');assert.match(await page.locator('#modal').innerText(),/4 \/ 4/);await page.screenshot({path:`${artifactDir}/victory.png`});await page.click('#free-roam');check('Four rescues lead to victory and free exploration');
  await page.keyboard.press('Escape');await page.click('#home-button');await page.click('#start');await page.click('#cancel-new');assert.equal(Object.values((await snapshot()).state.missions).filter(m=>m.rescued).length,4);check('Cancel new expedition preserves saved progress');
  await page.click('#continue');await page.keyboard.press('Escape');await page.click('#pause-settings');await page.selectOption('#quality','high');await page.check('#reduced-motion');await page.click('#settings-done');await page.evaluate(()=>window.__wildhaven.teleport('elephant'));await page.waitForFunction(()=>window.__wildhaven.snapshot().nearby==='elephant');await page.screenshot({path:`${artifactDir}/gameplay.png`});check('High quality rendering and settings work');
  await page.keyboard.press('Escape');await page.click('#home-button');await page.click('#start');await page.click('#confirm-new');assert.equal(Object.values((await snapshot()).state.missions).filter(m=>m.rescued).length,0);check('Confirmed new expedition resets all four rescues');

  // Release the desktop WebGL context before starting mobile software rendering.
  await context.close();
  const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await mobileContext.addInitScript(()=>localStorage.setItem('wildhaven-settings',JSON.stringify({quality:'low',sound:false,reducedMotion:true,sensitivity:1})));
  const mobile=await mobileContext.newPage();mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(gameURL,{timeout:60000});await mobile.locator('#home:not([hidden])').waitFor();await mobile.click('#start');
  assert.equal(await mobile.locator('#touch-controls').isVisible(),true);assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const pad=await mobile.locator('[data-key="KeyW"]').boundingBox();await mobile.mouse.move(pad.x+pad.width/2,pad.y+pad.height/2);await mobile.mouse.down();await mobile.waitForFunction(()=>window.__wildhaven.snapshot().position.z<12.6);await mobile.mouse.up();check('On-screen movement pad moves the player');
  await mobile.evaluate(()=>window.__wildhaven.teleport('turtle'));await mobile.waitForFunction(()=>window.__wildhaven.snapshot().nearby==='turtle');await mobile.click('#touch-interact');assert.equal(await mobile.locator('[data-valve]').count(),3);await mobile.screenshot({path:`${artifactDir}/mobile.png`});assert.ok(await mobile.evaluate(()=>document.getElementById('modal').scrollWidth<=document.getElementById('modal').clientWidth+1));check('Touch layout and rescue dialog fit a 390 px screen');
  await mobileContext.close();assert.deepEqual(errors,[]);check('No JavaScript or browser console errors');
  console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
}finally{await browser.close();}
