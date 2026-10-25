import * as THREE from '../vendor/three.module.js';
import { createWorld } from './world.js';
import { createRanger, createAnimal, createCage } from './models.js';
import { MISSIONS, SAVE_KEY, createState, restoreState, serializeState, rescueCount } from './missions.js';
import { renderRescue } from './rescue-ui.js';
import { createRecoveryProps } from './recovery-props.js';

const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state = createState(), hasSave = false, storageAvailable = true;
try { const saved = localStorage.getItem(SAVE_KEY); if (saved) { const restored = restoreState(saved); if (restored) { state = restored; hasSave = true; } } } catch { storageAvailable = false; }
let settings = { sound:false, quality:'high', sensitivity:1, reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches };
try { const saved = JSON.parse(localStorage.getItem('wildhaven-settings')); if (saved && typeof saved === 'object') { settings.sound = saved.sound === true; settings.quality = saved.quality === 'low' ? 'low':'high'; settings.sensitivity = Math.max(.4,Math.min(2, Number(saved.sensitivity)||1)); settings.reducedMotion = saved.reducedMotion === true; } } catch {}
let renderer, scene, camera, environment, ranger, mode='home', modalType=null, cameraMode=state.cameraMode, yaw=state.player.yaw, pitch=-.12;
let lastTime=0, time=0, walking=0, nearby=null, saveClock=0, lastMap=0, toastTimer, returnFocus=null, drag=null, cameraReady=false;
const keys=new Set(), animals=new Map(), temp=new THREE.Vector3(), raycaster=new THREE.Raycaster(), cameraObstacles=[];
const reduced = () => settings.reducedMotion;
const audio = {
  ctx:null, gain:null, enabled:false, nextBird:0,
  async set(enabled) {
    this.enabled=enabled; settings.sound=enabled;
    if (enabled && !this.ctx) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) { toast('Your browser does not support sound. The game still works.'); this.enabled=false; settings.sound=false; return; }
      this.ctx=new Audio(); this.gain=this.ctx.createGain();this.gain.gain.value=.3;this.gain.connect(this.ctx.destination);
      const buffer=this.ctx.createBuffer(1,this.ctx.sampleRate*3,this.ctx.sampleRate), data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.14;
      const wind=this.ctx.createBufferSource();wind.buffer=buffer;wind.loop=true;const filter=this.ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=430;wind.connect(filter);filter.connect(this.gain);wind.start();
    }
    if(this.ctx){if(enabled)await this.ctx.resume();this.gain.gain.setTargetAtTime(enabled?.3:0,this.ctx.currentTime,.2);}
    $('sound-button').textContent=this.enabled?'Sound on':'Sound off'; saveSettings();
  },
  note(frequency=660,duration=.12,delay=0) {if(!this.enabled||!this.ctx)return;const c=this.ctx,t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(frequency,t);o.frequency.exponentialRampToValueAtTime(frequency*1.12,t+duration);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.1,t+.015);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.gain);o.start(t);o.stop(t+duration+.02);},
  success(){this.note(523,.17);this.note(659,.19,.12);this.note(784,.3,.26);},
  tick(t){if(this.enabled && mode==='play'&&!modalType&&t>this.nextBird){this.note(1900,.13);this.note(2500,.1,.18);this.nextBird=t+7+Math.random()*8;}}
};

function toast(message) {clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
function saveSettings(){try{localStorage.setItem('wildhaven-settings',JSON.stringify(settings));}catch{}}
function save(){state.cameraMode=cameraMode;state.player.yaw=yaw;try{localStorage.setItem(SAVE_KEY,serializeState(state));hasSave=true;}catch{if(storageAvailable)toast('Progress cannot be saved in this browser. Keep this tab open to continue.');storageAvailable=false;}}
function updateHome(){ $('continue').hidden=!hasSave; $('start').textContent=hasSave?'New expedition ↗':'Begin expedition ↗'; if(hasSave)$('save-note').textContent=`Saved expedition · ${rescueCount(state)} of 4 animals rescued`;else if(!storageAvailable)$('save-note').textContent='Explore at your own pace. Browser storage is unavailable.'; }

function init(){
  try{
    renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,350);environment=createWorld(scene);
    ranger=createRanger();scene.add(ranger);
    for(const mission of MISSIONS)createRescueSite(mission);
    applyQuality();syncProgress();updateHome();$('loading').hidden=true;$('home').hidden=false;
    addEventListener('resize',resize);$('world').addEventListener('webglcontextlost',e=>{e.preventDefault();save();showFatal('The graphics connection was interrupted. Your saved progress is safe. Close other graphics-heavy tabs and try again.');});
    if(new URLSearchParams(location.search).has('test'))window.__wildhaven={
      snapshot:()=>({mode,modal:modalType,state:JSON.parse(JSON.stringify(state)),cameraMode,nearby:nearby?.id,position:{...state.player},render:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles},animals:[...animals.keys()]}),
      teleport(id){const m=MISSIONS.find(m=>m.id===id);if(!m)return;state.player.x=m.x;state.player.z=m.z+4.7;yaw=0;cameraReady=false;},
      face(v){yaw=v;cameraReady=false;},
      graphics:()=>renderer.getContext().getParameter(renderer.getContext().VERSION)
    };
    requestAnimationFrame(frame);
  }catch(error){console.error(error);showFatal('This game needs a browser with WebGL 2 graphics enabled. Try a recent Chrome, Edge, Firefox, or Safari browser. Technical detail: '+error.message);}
}
function showFatal(message){$('loading').hidden=true;$('fatal-message').textContent=message;$('fatal').hidden=false;}
function labelSprite(text,color='#e9efce'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=100;const ctx=canvas.getContext('2d');ctx.fillStyle='rgba(19,46,34,.90)';ctx.roundRect(5,5,502,90,15);ctx.fill();ctx.strokeStyle='#a7c28c';ctx.lineWidth=2;ctx.stroke();ctx.font='600 27px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text.toUpperCase(),256,52);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:true}));sprite.scale.set(3.7,.72,1);return sprite;
}
function createRescueSite(m){
  const root=new THREE.Group();root.position.set(m.x,0,m.z);scene.add(root);
  const animal=createAnimal(m.id);root.add(animal);
  let cage=null;
  if(m.id==='tiger'||m.id==='pangolin'){cage=m.id==='tiger'?createCage(4.7,5,2.8):createCage(2.6,2.8,1.55);root.add(cage);cameraObstacles.push(cage);}
  const marker=new THREE.Group();marker.position.set(m.x,m.id==='elephant'?4.6:m.id==='tiger'?4.2:3,m.z);scene.add(marker);
  const diamond=new THREE.Mesh(new THREE.OctahedronGeometry(.18),new THREE.MeshBasicMaterial({color:'#e6efad'}));marker.add(diamond);const label=labelSprite(m.species);label.position.y=.64;marker.add(label);
  const ring=new THREE.Mesh(new THREE.RingGeometry(m.id==='elephant'?2.6:2.1,m.id==='elephant'?2.66:2.16,64),new THREE.MeshBasicMaterial({color:'#e1e7ab',side:THREE.DoubleSide,transparent:true,opacity:.5}));ring.rotation.x=-Math.PI/2;ring.position.y=.045;root.add(ring);
  const wound=new THREE.Mesh(new THREE.SphereGeometry(.065,12,8),new THREE.MeshStandardMaterial({color:'#a55f48',roughness:1}));wound.position.set(m.id==='tiger'?.3:.33,.21,m.id==='tiger'?.75:.2);if(m.id==='tiger'||m.id==='turtle')root.add(wound);
  let net=null;if(m.id==='turtle'){
    net=new THREE.Group();const points=[];for(let i=-4;i<=4;i++){const d=i*.14;points.push(new THREE.Vector3(-.7,.32,d),new THREE.Vector3(.7,.32,d),new THREE.Vector3(d,.33,-.7),new THREE.Vector3(d,.33,.7));}const geo=new THREE.BufferGeometry().setFromPoints(points);net.add(new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:'#5d614c'})));root.add(net);
    const tank=new THREE.Mesh(new THREE.CylinderGeometry(.48,.48,1.2,16),new THREE.MeshStandardMaterial({color:'#749b96',metalness:.25,roughness:.6}));tank.position.set(2.9,.6,-1);tank.castShadow=true;root.add(tank);
  }
  const kit=new THREE.Group(),box=new THREE.Mesh(new THREE.BoxGeometry(.48,.28,.32),new THREE.MeshStandardMaterial({color:'#ebe8d1'}));box.position.y=.14;box.castShadow=true;kit.add(box);const stripe=new THREE.Mesh(new THREE.BoxGeometry(.1,.015,.22),new THREE.MeshStandardMaterial({color:'#518267'}));stripe.position.y=.287;kit.add(stripe);const cross=stripe.clone();cross.rotation.y=Math.PI/2;kit.add(cross);kit.position.set(-2.5,0,2.1);root.add(kit);
  const recovery=createRecoveryProps(m.id,animal);root.add(recovery);
  animals.set(m.id,{root,animal,cage,marker,diamond,ring,wound,net,kit,recovery,releaseTime:null,open:0});
}
function applyQuality(){if(!renderer)return;renderer.setPixelRatio(Math.min(devicePixelRatio,settings.quality==='low'?1:1.65));renderer.shadowMap.enabled=settings.quality!=='low';renderer.shadowMap.needsUpdate=true;scene?.traverse(o=>{if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.needsUpdate=true;}});renderer.setSize(innerWidth,innerHeight);}
function resize(){if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}
function syncProgress(){
  $('rescue-counter').textContent=`${rescueCount(state)} / 4 rescued`;
  $('mission-list').innerHTML=MISSIONS.map((m,i)=>{const p=state.missions[m.id];return `<button class="mission-entry ${m.id===state.selectedMission?'selected':''} ${p.rescued?'complete':''}" data-mission="${m.id}"><span class="mission-dot">${p.rescued?'✓':String(i+1).padStart(2,'0')}</span><span><strong>${m.species}</strong><small>${p.rescued?'Safe · rescue complete':p.unlocked?`Care in progress · ${p.careStep}/3`:m.location}</small></span></button>`;}).join('');
  $('mission-list').querySelectorAll('button').forEach(b=>b.onclick=()=>selectMission(b.dataset.mission));
  for(const m of MISSIONS){const a=animals.get(m.id),p=state.missions[m.id];if(!a)continue;a.ring.material.color.set(p.rescued?'#8edba0':'#e1e7ab');a.diamond.material.color.set(p.rescued?'#8edba0':'#e6efad');a.wound.visible=!p.rescued&&p.careStep<2;if(a.net)a.net.visible=p.careStep<1;a.kit.visible=p.unlocked&&!p.rescued;a.recovery.userData.sync(p);}
}
function selectMission(id){state.selectedMission=id;syncProgress();save();const m=MISSIONS.find(m=>m.id===id);toast(`Tracking ${m.species} · ${m.location}`);}
function startExpedition(fresh=false){
  if(fresh){state=createState();yaw=0;pitch=-.12;cameraMode='third';for(const a of animals.values()){a.releaseTime=null;a.animal.position.set(0,0,0);a.animal.visible=true;a.open=0;a.cage?.userData.open(0);}}
  closeModal();mode='play';cameraReady=false;state.player.x=Math.min(35.3,state.player.x);ranger.rotation.y=yaw+Math.PI;$('home').hidden=true;$('hud').hidden=false;ranger.visible=cameraMode==='third';syncProgress();updateViewLabel();save();
  if(settings.sound)audio.set(true).catch(()=>toast('Click Sound on to enable audio.'));
  toast(fresh?'Welcome, ranger. Follow a beacon, then press E to inspect.':'Welcome back. Your rescue log is ready.');
}
function leaveToHome(){save();mode='home';closeModal();document.exitPointerLock?.();$('hud').hidden=true;$('home').hidden=false;ranger.visible=true;updateHome();}
function updateViewLabel(){ $('view-button').innerHTML=`${cameraMode==='first'?'First person':'Third person'} <kbd>V</kbd>`;$('crosshair').hidden=cameraMode!=='first';}
function toggleView(){if(mode!=='play'||modalType)return;cameraMode=cameraMode==='first'?'third':'first';cameraReady=false;ranger.visible=cameraMode==='third';updateViewLabel();save();}
function openModal(type,html){keys.clear();drag=null;document.exitPointerLock?.();returnFocus=document.activeElement;modalType=type;$('modal').onkeydown=null;$('modal').innerHTML=html;$('modal-backdrop').hidden=false;$('modal').focus();$('modal').querySelector('.modal-close')?.addEventListener('click',closeModal);}
function closeModal(){modalType=null;$('modal-backdrop').hidden=true;keys.clear();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});returnFocus=null;}
const closeButton='<button class="modal-close" aria-label="Close dialog">×</button>';
function inspect(){
  if(mode!=='play'||modalType||!nearby)return;
  const mission=nearby;openModal('rescue','');
  renderRescue({mission,state,container:$('modal'),onClose:closeModal,onProgress:()=>{save();syncProgress();audio.note(700);},onFinish:finishRescue});
}
function finishRescue(m){
  save();syncProgress();animals.get(m.id).releaseTime=0;audio.success();
  const all=rescueCount(state)===4;
  if(!all){const next=MISSIONS.find(m=>!state.missions[m.id].rescued);state.selectedMission=next.id;syncProgress();save();}
  openModal('rescued',`${closeButton}<p class="eyebrow">RESCUE COMPLETE</p><h2 id="modal-title">${m.species}.<br><em>A second chance.</em></h2><p>${m.careSteps.at(-1).success}</p><div class="note-box"><strong>YOUR FIELD JOURNAL</strong><p>${m.fact}</p></div><p>${rescueCount(state)} of 4 animals are now safe.</p><button class="primary" id="rescue-done">${all?'Complete expedition':'Continue exploring'} ↗</button>`);
  $('rescue-done').onclick=all?showVictory:closeModal;
  if(all)$('modal').querySelector('.modal-close').onclick=showVictory;
}
function formatTime(seconds){const min=Math.floor(seconds/60);return `${min}m ${Math.floor(seconds%60)}s`;}
function showVictory(){openModal('victory',`${closeButton}<p class="eyebrow">EXPEDITION COMPLETE</p><div class="victory-mark">✦</div><h2 id="modal-title">Every rescue matters.</h2><p>The forest is quieter. The shoreline is clear. All four animals are safe, thanks to you and the sanctuary team.</p><div class="victory-stats"><div><strong>4 / 4</strong><small>ANIMALS RESCUED</small></div><div><strong>${formatTime(state.elapsed)}</strong><small>TIME EXPLORING</small></div></div><p>Your field journal keeps the stories behind these rescues. Protecting habitat and stopping illegal wildlife trade makes a difference beyond this island.</p><div class="modal-actions"><button class="primary" id="free-roam">Keep exploring ↗</button><button class="secondary" id="victory-journal">Read field journal</button><button class="secondary" id="victory-home">Main menu</button></div>`);$('free-roam').onclick=closeModal;$('victory-journal').onclick=showJournal;$('victory-home').onclick=leaveToHome;}
function showPause(){if(mode!=='play')return;openModal('pause',`${closeButton}<p class="eyebrow">TAKE A BREATHER</p><h2 id="modal-title">Expedition paused.</h2><p>Your progress is saved automatically. Take your time; the sanctuary can wait.</p><div class="modal-actions"><button class="primary" id="resume">Resume expedition</button><button class="secondary" id="pause-settings">Settings</button><button class="secondary" id="help">How to play</button><button class="secondary" id="home-button">Main menu</button></div>`);save();$('resume').onclick=closeModal;$('pause-settings').onclick=showSettings;$('help').onclick=showHelp;$('home-button').onclick=leaveToHome;}
function showHelp(){openModal('help',`${closeButton}<p class="eyebrow">RANGER HANDBOOK</p><h2 id="modal-title">Find. Understand. Rescue.</h2><p>Follow any rescue beacon. Stand near the animal and press E. Read the field note, solve the obstacle, then choose care supplies for the specialist team. Rescue all four animals to finish.</p><div class="control-grid"><div><kbd>W A S D</kbd> Move (or arrow keys)</div><div><kbd>SHIFT</kbd> Run</div><div><kbd>DRAG</kbd> Look around</div><div><kbd>V</kbd> First / third person</div><div><kbd>E</kbd> Inspect nearby animal</div><div><kbd>M</kbd> Open map</div><div><kbd>J</kbd> Field journal</div><div><kbd>ESC</kbd> Pause / close dialog</div></div><p>Click the scene to lock the mouse for free looking. Press Esc to release it. Touch screens: use the movement pad and drag the scene to look. In third person, scroll to change your camera distance.</p><div class="note-box"><strong>THE RANGER’S CODE</strong><p>Give animals space. Keep the island clean. Wrong answers are a chance to learn; every puzzle can be retried.</p></div><button class="primary" id="help-close">Back to expedition</button>`);$('help-close').onclick=closeModal;}
function showSettings(){openModal('settings',`${closeButton}<p class="eyebrow">MAKE YOURSELF AT HOME</p><h2 id="modal-title">Field settings</h2><label class="settings-row">Nature sounds<input type="checkbox" id="setting-sound" ${settings.sound?'checked':''}></label><label class="settings-row">Graphics quality<select id="quality"><option value="high" ${settings.quality==='high'?'selected':''}>High · soft shadows</option><option value="low" ${settings.quality==='low'?'selected':''}>Low · faster rendering</option></select></label><label class="settings-row">Look sensitivity<input id="sensitivity" type="range" min="0.4" max="2" step="0.1" value="${settings.sensitivity}"></label><label class="settings-row">Reduce decorative motion<input id="reduced-motion" type="checkbox" ${settings.reducedMotion?'checked':''}></label><p>Progress is stored only in this browser. No account or internet connection is needed after download.</p><button class="primary" id="settings-done">Done</button>`);$('setting-sound').onchange=e=>audio.set(e.target.checked).catch(()=>toast('Audio could not start. Try again.'));$('quality').onchange=e=>{settings.quality=e.target.value;applyQuality();saveSettings();};$('sensitivity').oninput=e=>{settings.sensitivity=Number(e.target.value);saveSettings();};$('reduced-motion').onchange=e=>{settings.reducedMotion=e.target.checked;saveSettings();};$('settings-done').onclick=closeModal;}
function showJournal(){openModal('journal',`${closeButton}<p class="eyebrow">NOTES FROM THE SANCTUARY</p><h2 id="modal-title">Your field journal</h2><p>A fictional rescue island, with real species worth protecting. Conservation status can change as new assessments are published.</p>${MISSIONS.map(m=>`<article class="journal-entry"><span class="badge">${state.missions[m.id].rescued?'RESCUED':m.status.toUpperCase()}</span><h3>${m.species}</h3><p><em>${m.scientificName}</em><br>${m.fact}</p><a href="${m.source}" target="_blank" rel="noopener">Species reference · ${m.sourceLabel} ↗</a></article>`).join('')}<p>Rescue activities are simplified game scenarios performed by a specialist team. They are not instructions for handling or treating real wildlife.</p>`);}
function showMap(){openModal('map',`${closeButton}<p class="eyebrow">WILDHAVEN SANCTUARY</p><h2 id="modal-title">Choose your next trail.</h2><canvas class="big-map" id="big-map" width="800" height="610" aria-label="Map showing your position and four rescue sites"></canvas><div class="map-list">${MISSIONS.map((m,i)=>`<button data-track="${m.id}">${i+1}. ${m.species}<small>${state.missions[m.id].rescued?'Rescued':m.location} · ${Math.round(Math.hypot(state.player.x-m.x,state.player.z-m.z))} m</small></button>`).join('')}</div><p>The arrow is you. North is at the top. Select a rescue to track its distance.</p>`);drawMap($('big-map'),true);$('modal').querySelectorAll('[data-track]').forEach(b=>b.onclick=()=>{selectMission(b.dataset.track);closeModal();});}

function drawMap(canvas,large=false){
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,scale=(large?Math.min(w,h):w)/108,offsetX=w/2+4*scale,offsetY=h/2+8*scale;
  const point=(x,z)=>[offsetX+x*scale,offsetY+z*scale];
  ctx.fillStyle='#254936';ctx.fillRect(0,0,w,h);ctx.fillStyle='#637b4a';ctx.fillRect(0,0,offsetX+25*scale,h);ctx.fillStyle='#bdac76';ctx.fillRect(offsetX+25*scale,0,11*scale,h);ctx.fillStyle='#438f8d';ctx.fillRect(offsetX+36*scale,0,w,h);
  ctx.fillStyle='#314f36';for(let i=0;i<60;i++){const x=((i*37)%80)-48,z=((i*23)%95)-49;const p=point(x,z);ctx.beginPath();ctx.arc(...p,(2+(i%3))*scale,0,Math.PI*2);ctx.fill();}
  ctx.strokeStyle='#c3b584';ctx.lineWidth=large?7:3;ctx.lineCap='round';for(const path of [[[0,19],[0,12],[-3,3],[-9,-4],[-11,-12],[-16,-18],[-17,-26],[-21,-34]],[[-11,-12],[-2,-14],[7,-17],[15,-23]],[[0,13],[8,12],[16,9],[25,9],[35,7]]]){ctx.beginPath();path.forEach(([x,z],i)=>{const p=point(x,z);i?ctx.lineTo(...p):ctx.moveTo(...p);});ctx.stroke();}
  MISSIONS.forEach((m,i)=>{const p=point(m.x,m.z),done=state.missions[m.id].rescued,selected=m.id===state.selectedMission;ctx.fillStyle=done?'#98d5a1':selected?'#eef4ba':'#f0ead8';ctx.beginPath();ctx.arc(...p,large?13:7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#294d32';ctx.font=`bold ${large?12:9}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(done?'✓':i+1,p[0],p[1]);if(large){ctx.font='14px Arial';ctx.fillStyle='#fcf7dc';ctx.textAlign='center';ctx.shadowColor='#163127';ctx.shadowBlur=4;ctx.fillText(m.species,p[0],p[1]+27);ctx.shadowBlur=0;}});
  const p=point(state.player.x,state.player.z);ctx.save();ctx.translate(...p);ctx.rotate(-yaw);ctx.fillStyle='#fff';ctx.strokeStyle='#284c3c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,large?-15:-10);ctx.lineTo(large?10:7,large?10:7);ctx.lineTo(0,large?5:3);ctx.lineTo(large?-10:-7,large?10:7);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();if(large){ctx.fillStyle='#e8edd2';ctx.font='bold 18px Arial';ctx.textAlign='center';ctx.fillText('N',w/2,27);ctx.font='11px Arial';ctx.fillText('WILDHAVEN · COASTAL RESERVE',w/2,h-18);}
}

let cameraDistance=6.3;
function movePlayer(dt){
  const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),side=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
  walking=0;if(!forward&&!side)return;
  const speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?5.4:3.25;const dir=new THREE.Vector3(-Math.sin(yaw)*forward+Math.cos(yaw)*side,0,-Math.cos(yaw)*forward-Math.sin(yaw)*side).normalize();const amount=speed*dt;
  const blocked=(x,z)=>{
    if(x< -46||x>35.3||z< -46||z>46)return true;
    if(environment.colliders.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+.32))return true;
    return MISSIONS.some(m=>{const p=state.missions[m.id];if(p.rescued)return false;const radius=m.id==='tiger'?2.85:m.id==='elephant'?1.7:m.id==='pangolin'?1.55:.72;return Math.hypot(x-m.x,z-m.z)<radius;});
  };
  const oldX=state.player.x,oldZ=state.player.z;
  const nx=oldX+dir.x*amount;if(!blocked(nx,oldZ))state.player.x=nx;const nz=oldZ+dir.z*amount;if(!blocked(state.player.x,nz))state.player.z=nz;
  walking=Math.hypot(state.player.x-oldX,state.player.z-oldZ)/Math.max(.001,dt);if(walking>.1){const target=Math.atan2(dir.x,dir.z);const d=Math.atan2(Math.sin(target-ranger.rotation.y),Math.cos(target-ranger.rotation.y));ranger.rotation.y+=d*Math.min(1,dt*12);}
}
function updateCamera(dt){
  const p=state.player;ranger.position.set(p.x,0,p.z);
  if(cameraMode==='first'){
    camera.position.set(p.x,1.66+(walking>0&&!reduced()?Math.sin(time*11)*.018:0),p.z);temp.set(p.x-Math.sin(yaw)*Math.cos(pitch),camera.position.y+Math.sin(pitch),p.z-Math.cos(yaw)*Math.cos(pitch));camera.lookAt(temp);
  }else{
    const elevation=Math.max(.12,Math.min(1.05,.34-pitch)),horizontal=Math.cos(elevation)*cameraDistance,target=new THREE.Vector3(p.x,1.2,p.z),desired=new THREE.Vector3(p.x+Math.sin(yaw)*horizontal,1.2+Math.sin(elevation)*cameraDistance,p.z+Math.cos(yaw)*horizontal);
    // Pull the follow camera in before it intersects a tree trunk or cage.
    const delta=desired.clone().sub(target),length=delta.length();let safeLength=length;
    for(const c of environment.colliders){const to=new THREE.Vector3(c.x-target.x,0,c.z-target.z),flat=new THREE.Vector3(delta.x,0,delta.z),denom=flat.lengthSq();const u=denom?to.dot(flat)/denom:0;if(u>0&&u<1&&Math.hypot(to.x-flat.x*u,to.z-flat.z*u)<c.r+.2)safeLength=Math.min(safeLength,Math.max(1.2,length*u-.65));}
    raycaster.set(target,delta.clone().normalize());const hits=raycaster.intersectObjects(cameraObstacles,true);if(hits.length&&hits[0].distance<safeLength)safeLength=Math.max(1.1,hits[0].distance-.3);
    desired.copy(target).add(delta.normalize().multiplyScalar(safeLength));if(!cameraReady||reduced())camera.position.copy(desired);else camera.position.lerp(desired,1-Math.exp(-9*dt));camera.lookAt(target);
  }cameraReady=true;
}
function updateNearby(){
  let closest=null,distance=Infinity;for(const m of MISSIONS){const d=Math.hypot(state.player.x-m.x,state.player.z-m.z);if(d<5.8&&d<distance){closest=m;distance=d;}}
  nearby=closest;$('interact-prompt').hidden=!nearby||!!modalType;if(nearby){$('nearby-name').textContent=nearby.species;$('interact-button').innerHTML=`<kbd>E</kbd> ${state.missions[nearby.id].rescued?'View rescue':'Inspect rescue'}`;}
  const target=MISSIONS.find(m=>m.id===state.selectedMission),d=Math.round(Math.hypot(state.player.x-target.x,state.player.z-target.z));
  const heading=Math.atan2(-(target.x-state.player.x),-(target.z-state.player.z))-yaw,relative=Math.atan2(Math.sin(heading),Math.cos(heading));const arrow=Math.abs(relative)<.45?'↑':Math.abs(relative)>2.5?'↓':relative>0?'←':'→';
  $('waypoint').textContent=state.missions[target.id].rescued?`${target.species} · Safe`:`${arrow} ${target.species} · ${d} m`;
  $('region').textContent=state.player.x>20?'TIDEPOOL BEACH':state.player.z< -27?'FERN HOLLOW':state.player.x>6&&state.player.z< -10?'BANYAN GROVE':state.player.z<0?'FOREST CLEARING':'RANGER STATION';
}
function frame(timestamp){
  const dt=Math.min((timestamp-lastTime)/1000||.016,.05);lastTime=timestamp;time+=dt;
  if(mode==='play'){
    if(!modalType&&!document.hidden){movePlayer(dt);state.elapsed+=dt;saveClock+=dt;if(saveClock>5){save();saveClock=0;}}else walking=0;
    updateCamera(dt);updateNearby();
  }else{
    ranger.position.set(0,0,13);ranger.rotation.y=-.7;ranger.visible=true;walking=0;
    const sway=reduced()?0:Math.sin(time*.065)*2;camera.position.set(21+sway,13,31);camera.lookAt(-6,2,-9);
  }
  ranger.userData.animate?.(time,walking);
  environment.update(reduced()?0:time,dt);
  for(const m of MISSIONS){const a=animals.get(m.id),p=state.missions[m.id];a.animal.userData.animate?.(time,p.rescued);a.marker.position.y=(m.id==='elephant'?4.6:m.id==='tiger'?4.2:3)+(reduced()?0:Math.sin(time*1.8)*.09);a.diamond.rotation.y=reduced()?0:time*.5;a.open=THREE.MathUtils.damp(a.open,p.unlocked?1:0,3,dt);a.cage?.userData.open(a.open);a.marker.visible=mode==='play';
    if(p.rescued && a.releaseTime!==null && mode==='play'&&!modalType){a.releaseTime+=dt;const release=Math.min(a.releaseTime/14,1);if(m.id==='turtle'){a.animal.rotation.y=Math.PI/2;a.animal.position.x=release*13;a.animal.position.y=release>.9?-(release-.9)*4:0;}else {a.animal.position.z=Math.min(release*5,5);a.animal.rotation.y=Math.sin(time*.4)*.08;}}
  }
  if(mode==='play'&&timestamp-lastMap>120){drawMap($('mini-map'));lastMap=timestamp;}
  audio.tick(time);renderer.render(scene,camera);requestAnimationFrame(frame);
}

$('start').onclick=()=>{if(hasSave){openModal('new',`${closeButton}<p class="eyebrow">A FRESH START</p><h2 id="modal-title">Start a new expedition?</h2><p>This replaces your saved rescue progress in this browser.</p><div class="modal-actions"><button id="confirm-new" class="primary">Start new expedition</button><button id="cancel-new" class="secondary">Keep my progress</button></div>`);$('confirm-new').onclick=()=>startExpedition(true);$('cancel-new').onclick=closeModal;}else startExpedition(true);};
$('continue').onclick=()=>startExpedition(false);$('home-settings').onclick=showSettings;$('view-button').onclick=toggleView;$('touch-view').onclick=toggleView;$('pause-button').onclick=showPause;$('journal-button').onclick=showJournal;$('map-button').onclick=showMap;$('interact-button').onclick=inspect;$('touch-interact').onclick=inspect;$('sound-button').onclick=()=>audio.set(!audio.enabled).catch(()=>toast('Sound could not start. Please try again.'));
document.addEventListener('keydown',e=>{
  if(modalType){
    if(e.code==='Escape'){e.preventDefault();closeModal();}
    if(e.code==='Tab'){const f=[...$('modal').querySelectorAll('button:not(:disabled),input,select,a[href],[tabindex="0"]')].filter(el=>!el.hidden);if(f.length){const first=f[0],last=f.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('modal'))){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}return;
  }
  if(mode!=='play')return;
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(e.repeat)return;
  if(e.code==='KeyV')toggleView();else if(e.code==='KeyE')inspect();else if(e.code==='KeyM')showMap();else if(e.code==='KeyJ')showJournal();else if(e.code==='Escape')showPause();else keys.add(e.code);
});
document.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();drag=null;if(mode==='play'&&!modalType)showPause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();if(mode==='play'){save();if(!modalType)showPause();}if(audio.gain)audio.gain.gain.setTargetAtTime(0,audio.ctx.currentTime,.1);}else if(audio.enabled&&audio.gain)audio.gain.gain.setTargetAtTime(.3,audio.ctx.currentTime,.1);});
window.addEventListener('beforeunload',()=>{if(mode==='play')save();});
const canvas=$('world');
canvas.addEventListener('pointerdown',e=>{if(mode!=='play'||modalType||document.pointerLockElement)return;drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,id:e.pointerId,type:e.pointerType};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag||modalType)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;look(dx,dy);drag.x=e.clientX;drag.y=e.clientY;});
canvas.addEventListener('pointerup',e=>{if(!drag)return;const click=Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<4&&drag.type==='mouse';drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(click&&mode==='play'&&!modalType){try{const request=canvas.requestPointerLock?.();request?.catch?.(()=>toast('Drag the scene to look around.'));}catch{toast('Drag the scene to look around.');}}});
canvas.addEventListener('pointercancel',()=>{drag=null;});canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&mode==='play'&&!modalType)look(e.movementX,e.movementY);});
document.addEventListener('pointerlockerror',()=>toast('Mouse lock is unavailable here. Drag the scene to look around.'));
let hadPointerLock=false;
document.addEventListener('pointerlockchange',()=>{const locked=document.pointerLockElement===canvas;if(hadPointerLock&&!locked&&mode==='play'&&!modalType)showPause();hadPointerLock=locked;});
function look(dx,dy){yaw-=dx*.003*settings.sensitivity;pitch=Math.max(-.65,Math.min(.75,pitch-dy*.0025*settings.sensitivity));}
canvas.addEventListener('wheel',e=>{if(mode==='play'&&!modalType&&cameraMode==='third'){cameraDistance=Math.max(3.5,Math.min(10,cameraDistance+e.deltaY*.006));e.preventDefault();}},{passive:false});
document.querySelectorAll('[data-key]').forEach(b=>{b.addEventListener('pointerdown',e=>{if(modalType)return;e.preventDefault();keys.add(b.dataset.key);b.setPointerCapture(e.pointerId);});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>keys.delete(b.dataset.key));});
init();
