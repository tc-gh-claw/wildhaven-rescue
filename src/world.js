import * as THREE from '../vendor/three.module.js';

// All scenery is built locally. Seeded placement makes landmarks and paths stable.
export function createWorld(scene) {
  let seed = 840117;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const between = (a,b) => a + random()*(b-a);
  const root = new THREE.Group();
  root.name = 'Wildhaven tropical coastal sanctuary';
  scene.add(root);
  const colliders = [];
  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0,1,0);
  const sites = [[0,13],[-11,-12],[15,-23],[-21,-34],[25,9]];
  const pathPoints = [
    [[0,19],[0,12],[-3,3],[-9,-4],[-11,-12]],
    [[-11,-12],[-16,-18],[-17,-26],[-21,-34]],
    [[-11,-12],[-2,-14],[7,-17],[15,-23]],
    [[0,13],[8,12],[16,9],[25,9],[35,7]],
  ];
  const paths = pathPoints.map(points => new THREE.CatmullRomCurve3(points.map(([x,z]) => new THREE.Vector3(x,0,z))));
  const pathSamples = paths.flatMap(p => p.getPoints(80));
  const isClear = (x,z,padding=0) => sites.some(([sx,sz]) => Math.hypot(x-sx,z-sz)<5+padding) || pathSamples.some(p => Math.hypot(x-p.x,z-p.z)<2.1+padding) || (x>-10 && x<7 && z>17 && z<29);

  scene.background = new THREE.Color('#b7d9d8');
  scene.fog = new THREE.FogExp2('#b7d9c5', 0.0085);
  const hemi = new THREE.HemisphereLight('#e7f1e1','#5a6342',2.0);
  scene.add(hemi);
  const sunlight = new THREE.DirectionalLight('#fff0cc',3.15);
  sunlight.position.set(-25,42,12);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048,2048);
  sunlight.shadow.camera.left = -52;
  sunlight.shadow.camera.right = 52;
  sunlight.shadow.camera.top = 52;
  sunlight.shadow.camera.bottom = -52;
  sunlight.shadow.camera.near = 1;
  sunlight.shadow.camera.far = 130;
  sunlight.shadow.normalBias = 0.035;
  sunlight.shadow.bias = -0.00015;
  sunlight.shadow.radius = 3;
  scene.add(sunlight);
  scene.add(new THREE.DirectionalLight('#99cfde',0.3));

  const sky = new THREE.Mesh(new THREE.SphereGeometry(240,32,20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite:false,
    uniforms:{top:{value:new THREE.Color('#77b9c6')},bottom:{value:new THREE.Color('#e5e5bc')}},
    vertexShader:'varying vec3 vPosition; void main(){vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform vec3 top; uniform vec3 bottom; varying vec3 vPosition; void main(){float h=normalize(vPosition).y; vec3 col=mix(bottom,top,smoothstep(-0.05,0.8,h)); float sun=pow(max(dot(normalize(vPosition),normalize(vec3(-25.0,42.0,12.0))),0.0),450.0); col+=vec3(1.0,0.85,0.48)*sun*0.8; gl_FragColor=vec4(col,1.0);\n #include <tonemapping_fragment>\n #include <colorspace_fragment>\n}',
  }));
  root.add(sky);

  const material = (color,roughness=0.95) => new THREE.MeshStandardMaterial({color,roughness});
  const mats={ground:material('#71804b'),sand:material('#d5bf87'),trail:material('#bdac77'),trailEdge:material('#86915b'),bark:material('#68533b'),barkLight:material('#8b7953'),rock:material('#929986'),darkRock:material('#667768'),wood:material('#846341'),canvas:material('#72816a'),canvasLight:material('#97a580'),metal:material('#3e4b43',0.65)};
  const add = (geometry,mat,x,y,z,scale) => {
    const mesh=new THREE.Mesh(geometry,mat); mesh.position.set(x,y,z); if(scale)mesh.scale.set(...scale);
    mesh.receiveShadow=true;mesh.castShadow=true;root.add(mesh);return mesh;
  };
  const ground = add(new THREE.PlaneGeometry(260,260),mats.ground,-40,-0.045,0);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
  // A broad beach merges into a shallow turquoise lagoon.
  const beach=add(new THREE.PlaneGeometry(46,220),mats.sand,44,-0.008,0);beach.rotation.x=-Math.PI/2;beach.castShadow=false;
  const bankShape = new THREE.Shape();
  bankShape.moveTo(21,-70);for(let z=-70;z<=70;z+=2)bankShape.lineTo(26+Math.sin(z*0.08)*2+Math.sin(z*0.21)*0.6,z);
  bankShape.lineTo(55,70);bankShape.lineTo(55,-70);bankShape.closePath();
  const bank=add(new THREE.ShapeGeometry(bankShape),mats.sand,0,0.012,0);bank.rotation.x=Math.PI/2;bank.castShadow=false;
  function ribbon(curve,width,mat,y) {
    const points=curve.getPoints(100), positions=[],indices=[];
    points.forEach((p,i)=>{const tangent=curve.getTangent(i/100);const side=new THREE.Vector3(-tangent.z,0,tangent.x).normalize().multiplyScalar(width/2);positions.push(p.x+side.x,y,p.z+side.z,p.x-side.x,y,p.z-side.z);if(i<100){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}});
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,mat);mesh.receiveShadow=true;root.add(mesh);
  }
  paths.forEach(p=>{ribbon(p,3.9,mats.trailEdge,0.02);ribbon(p,2.75,mats.trail,0.026);});
  sites.forEach(([x,z],i)=>{const patch=add(new THREE.CircleGeometry(i===0?5:4.7,48),i===4?mats.sand:mats.trail,x,0.03,z);patch.rotation.x=-Math.PI/2;patch.castShadow=false;});

  const waterGeo=new THREE.PlaneGeometry(200,240,90,90);waterGeo.rotateX(-Math.PI/2);
  const waterMat=new THREE.ShaderMaterial({
    uniforms:{time:{value:0}},transparent:false,
    vertexShader:'uniform float time; varying vec3 vWorld; varying float vWave; void main(){vec3 p=position; float wave=sin(p.x*0.39+time*0.9)*0.035+sin(p.z*0.55+time*0.72)*0.025; p.y+=wave; vWave=wave; vWorld=(modelMatrix*vec4(p,1.0)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);}',
    fragmentShader:'uniform float time; varying vec3 vWorld; varying float vWave; void main(){float depth=smoothstep(35.0,85.0,vWorld.x); vec3 col=mix(vec3(0.28,0.67,0.57),vec3(0.09,0.41,0.48),depth); float shimmer=pow(max(sin(vWorld.x*2.5+sin(vWorld.z*1.1+time)*0.8+time*1.4),0.0),24.0); col+=vec3(0.22,0.30,0.22)*shimmer*(0.6-depth*0.3); float foam=(1.0-smoothstep(35.5,39.0,vWorld.x))*(0.5+0.5*sin(vWorld.z*1.8+time)); col=mix(col,vec3(0.85,0.89,0.71),foam*0.7); gl_FragColor=vec4(col,1.0);\n #include <tonemapping_fragment>\n #include <colorspace_fragment>\n}',
  });
  const water=new THREE.Mesh(waterGeo,waterMat);water.position.set(136,0.015,0);root.add(water);

  const trunkGeo=new THREE.CylinderGeometry(0.19,0.35,1,8);
  const canopyGeo=new THREE.IcosahedronGeometry(1,2);
  const canopyPos=canopyGeo.attributes.position;
  for(let i=0;i<canopyPos.count;i++){const v=new THREE.Vector3().fromBufferAttribute(canopyPos,i);random();/* Preserve placement seed; duplicated vertices need identical displacement. */v.multiplyScalar(.97+Math.sin(v.x*11+v.y*7)*.045+Math.cos(v.z*13+v.x*5)*.025);canopyPos.setXYZ(i,v.x,v.y,v.z);}canopyGeo.computeVertexNormals();
  const canopyMat=material('#ffffff');
  const trunks=[],canopies=[],palms=[];
  for(let i=0;i<185;i++){
    const x=between(-63,29),z=between(-67,57);
    if(isClear(x,z,1.2))continue;
    const height=between(5.5,10.4);
    if(x>16 && random()<0.7 || random()<0.2){palms.push({x,z,height});continue;}
    trunks.push({x,z,height});
    for(let j=0;j<4;j++)canopies.push({x:x+between(-1.35,1.35),y:height+between(-.6,1.2),z:z+between(-1.35,1.35),sx:between(1.8,3.1),sy:between(1.3,2.2),sz:between(1.8,3.1)});
    if(Math.abs(x)<46&&Math.abs(z)<46)colliders.push({x,z,r:0.62});
  }
  const trunkMesh=new THREE.InstancedMesh(trunkGeo,mats.bark,trunks.length);root.add(trunkMesh);trunkMesh.castShadow=true;trunkMesh.receiveShadow=true;
  trunks.forEach((t,i)=>{dummy.position.set(t.x,t.height/2,t.z);dummy.rotation.set(between(-.025,.025),random()*6.28,between(-.04,.04));dummy.scale.set(1,t.height,1);dummy.updateMatrix();trunkMesh.setMatrixAt(i,dummy.matrix);});
  const canopyMesh=new THREE.InstancedMesh(canopyGeo,canopyMat,canopies.length);root.add(canopyMesh);canopyMesh.castShadow=true;canopyMesh.receiveShadow=true;
  canopies.forEach((c,i)=>{dummy.position.set(c.x,c.y,c.z);dummy.rotation.set(random(),random()*6.28,random());dummy.scale.set(c.sx,c.sy,c.sz);dummy.updateMatrix();canopyMesh.setMatrixAt(i,dummy.matrix);canopyMesh.setColorAt(i,new THREE.Color().setHSL(between(.24,.30),between(.24,.39),between(.24,.36)));});

  // Palms have gently bowed trunks and long curved, tapered fronds.
  const frondGeometry=new THREE.BufferGeometry(),fp=[],fi=[];
  for(let i=0;i<=12;i++){let t=i/12;const width=Math.sin(Math.PI*t)**0.8*0.44;const y=Math.sin(t*Math.PI)*0.5-t*t*.55;fp.push(-width,y,t*3.5,width,y,t*3.5);if(i<12){let n=i*2;fi.push(n,n+1,n+2,n+1,n+3,n+2);}}
  frondGeometry.setAttribute('position',new THREE.Float32BufferAttribute(fp,3));frondGeometry.setIndex(fi);frondGeometry.computeVertexNormals();
  const frondMat=material('#ffffff');frondMat.side=THREE.DoubleSide;
  const fronds=new THREE.InstancedMesh(frondGeometry,frondMat,palms.length*9),palmTrunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.15,.24,1,8),mats.barkLight,palms.length*4);
  root.add(fronds,palmTrunks);fronds.castShadow=true;fronds.receiveShadow=true;palmTrunks.castShadow=true;
  palms.forEach((p,i)=>{
    const lean=between(-.8,.8);
    for(let j=0;j<4;j++){const y=(j+.5)/4*p.height;dummy.position.set(p.x+lean*(y/p.height)**2,y,p.z);dummy.rotation.set(0,0,-lean*y/p.height*.15);dummy.scale.set(1,p.height/4+0.04,1);dummy.updateMatrix();palmTrunks.setMatrixAt(i*4+j,dummy.matrix);}
    for(let j=0;j<9;j++){dummy.position.set(p.x+lean,p.height,p.z);dummy.rotation.set(between(-.2,.25),j/9*Math.PI*2+random()*.15,0);dummy.scale.set(1,1,between(.8,1.15));dummy.updateMatrix();fronds.setMatrixAt(i*9+j,dummy.matrix);fronds.setColorAt(i*9+j,new THREE.Color().setHSL(.23,between(.27,.42),between(.30,.42)));}
    if(Math.abs(p.x)<46&&Math.abs(p.z)<46)colliders.push({x:p.x,z:p.z,r:.5});
  });

  const grassGeometry=new THREE.BufferGeometry();const gp=[];
  for(let j=0;j<3;j++){const angle=j*Math.PI/3,dx=Math.cos(angle)*.075,dz=Math.sin(angle)*.075;gp.push(-dx,0,-dz,dx,0,dz,dx*.3,.5,dz*.3,dx,0,dz,dx*.6,.28,dz*.6,dx*.3,.5,dz*.3);}
  grassGeometry.setAttribute('position',new THREE.Float32BufferAttribute(gp,3));grassGeometry.computeVertexNormals();
  const grassMat=material('#ffffff');grassMat.side=THREE.DoubleSide;
  const grassPoints=[];
  for(let i=0;i<6500;i++){let x=between(-53,29),z=between(-53,49);if(!isClear(x,z,-.7))grassPoints.push({x,z});}
  const grass=new THREE.InstancedMesh(grassGeometry,grassMat,grassPoints.length);root.add(grass);grass.receiveShadow=true;
  grassPoints.forEach((p,i)=>{dummy.position.set(p.x,.015,p.z);dummy.rotation.set(0,random()*6.28,0);let scale=between(.6,1.8);dummy.scale.set(scale,scale,scale);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);grass.setColorAt(i,new THREE.Color().setHSL(between(.19,.27),between(.24,.40),between(.33,.48)));});
  const shrubs=[];
  for(let i=0;i<160;i++){let x=between(-48,27),z=between(-48,45);if(!isClear(x,z,.5))shrubs.push({x,z});}
  const bushes=new THREE.InstancedMesh(canopyGeo,material('#ffffff'),shrubs.length);root.add(bushes);bushes.castShadow=true;bushes.receiveShadow=true;
  shrubs.forEach((p,i)=>{dummy.position.set(p.x,.55,p.z);dummy.rotation.set(0,random()*6.28,0);dummy.scale.set(between(.65,1.2),between(.45,.9),between(.65,1.2));dummy.updateMatrix();bushes.setMatrixAt(i,dummy.matrix);bushes.setColorAt(i,new THREE.Color().setHSL(between(.23,.30),.35,between(.32,.4)));});
  const stones=[];
  for(let i=0;i<110;i++){let x=between(-46,34),z=between(-46,45);if(!isClear(x,z,1))stones.push({x,z,s:between(.2,1.5)});}
  const rockMesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),mats.rock,stones.length);root.add(rockMesh);rockMesh.receiveShadow=true;rockMesh.castShadow=true;
  stones.forEach((p,i)=>{dummy.position.set(p.x,p.s*.3,p.z);dummy.rotation.set(random(),random()*6.28,random());dummy.scale.set(p.s,p.s*.55,p.s*.85);dummy.updateMatrix();rockMesh.setMatrixAt(i,dummy.matrix);if(p.s>.7)colliders.push({x:p.x,z:p.z,r:p.s*.8});});

  // Undulating hills frame the reserve instead of an abrupt flat horizon.
  for(let i=0;i<15;i++){
    const x=-98+i*12+between(-5,5),z=-83+between(-7,10);
    const m=add(new THREE.IcosahedronGeometry(1,1),material(i%2?'#638475':'#7f9480'),x,3,z,[between(18,29),between(12,25),between(15,24)]);m.castShadow=false;
  }
  for(let i=0;i<7;i++)add(new THREE.IcosahedronGeometry(1,1),mats.darkRock,-79,4,-50+i*20,[17,between(8,17),18]).castShadow=false;

  // Ranger field station with a canvas ridge tent, poles, supply cases and lantern.
  function box(x,y,z,sx,sy,sz,mat=mats.wood){return add(new THREE.BoxGeometry(sx,sy,sz),mat,x,y,z);}
  function cylinderBetween(a,b,r,mat){const distance=a.distanceTo(b);const m=add(new THREE.CylinderGeometry(r,r,distance,8),mat,0,0,0);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(up,b.clone().sub(a).normalize());return m;}
  const tentGeometry=new THREE.BufferGeometry();
  tentGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-8,0,20,-5,3,20,-8,0,26,-5,3,20,-5,3,26,-8,0,26,-5,3,20,-2,0,20,-5,3,26,-2,0,20,-2,0,26,-5,3,26,-8,0,26,-5,3,26,-2,0,26],3));tentGeometry.computeVertexNormals();
  const tentMaterial=mats.canvas.clone();tentMaterial.side=THREE.DoubleSide;add(tentGeometry,tentMaterial,0,.08,0);
  cylinderBetween(new THREE.Vector3(-5,.1,19.7),new THREE.Vector3(-5,3.3,19.7),.06,mats.wood);
  cylinderBetween(new THREE.Vector3(-5,.1,26.1),new THREE.Vector3(-5,3.3,26.1),.06,mats.wood);
  cylinderBetween(new THREE.Vector3(-5,3.12,19.7),new THREE.Vector3(-5,3.12,26.2),.055,mats.wood);
  const ropeMat=material('#c5b68c');
  for(const z of [20,26])for(const x of [-8,-2])cylinderBetween(new THREE.Vector3(x,.6,z),new THREE.Vector3(x+(x<-5?-1:1),.08,z-.7),.015,ropeMat);
  colliders.push({x:-5,z:23,r:3.2});
  box(2.5,.55,21,1.4,1.1,.9,mats.canvas);box(3.2,.3,22.2,1.3,.6,.9,mats.wood);
  box(2.5,.57,20.54,.44,.14,.03,material('#e1ded0'));box(2.5,.57,20.52,.14,.44,.03,material('#e1ded0'));
  colliders.push({x:2.8,z:21.6,r:1.1});
  box(.6,.9,23.7,2.2,.16,1,mats.wood);for(const x of [-.3,1.5])box(x,.45,23.7,.12,.9,.7,mats.wood);
  box(.5,1.02,23.7,.6,.1,.45,material('#ddcf9a'));
  add(new THREE.CylinderGeometry(.13,.13,.26,12),mats.metal,1.3,1.12,23.7);
  const board=box(3.4,1.6,17.6,2.5,1.5,.12,mats.canvasLight);board.rotation.y=-.12;
  box(2.5,.8,17.6,.1,1.6,.1,mats.wood);box(4.3,.8,17.6,.1,1.6,.1,mats.wood);
  // Small route marker posts help the world remain navigable without the map.
  for(const [x,z,rotation] of [[-3,1,0],[-14,-18,.2],[7,-16,-.5],[13,10,1.2]]){
    box(x,.75,z,.12,1.5,.12,mats.wood);
    const sign=box(x,1.3,z,.85,.2,.1,mats.canvasLight);sign.rotation.y=rotation;
  }

  // Abandoned equipment hints at the rescue story, away from approach routes.
  box(-17.2,.34,-10.4,1.1,.68,.9,mats.wood);box(-17.5,.88,-10.5,.8,.4,.7,mats.wood);
  add(new THREE.CylinderGeometry(.45,.45,.8,12),mats.metal,-17.5,.4,-12.5);
  colliders.push({x:-17.3,z:-11.5,r:1.2});
  const netMat=new THREE.LineBasicMaterial({color:'#a29269',transparent:true,opacity:.7});const netPoints=[];
  for(let i=0;i<9;i++){netPoints.push(new THREE.Vector3(-23+i*.15,.1,-30),new THREE.Vector3(-23+i*.15,.1,-28.7));netPoints.push(new THREE.Vector3(-23,.1,-30+i*.15),new THREE.Vector3(-21.8,.1,-30+i*.15));}
  root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(netPoints),netMat));

  // Sparse flowers and drifting butterflies add movement without screen clutter.
  const flowerCenters=[];
  for(let i=0;i<110;i++){const x=between(-30,23),z=between(-40,32);if(!isClear(x,z,-1.5))flowerCenters.push({x,z});}
  const flowerGeo=new THREE.SphereGeometry(.055,5,4);const flowers=new THREE.InstancedMesh(flowerGeo,material('#ffffff'),flowerCenters.length);root.add(flowers);
  flowerCenters.forEach((p,i)=>{dummy.position.set(p.x,.35,p.z);dummy.rotation.set(0,0,0);dummy.scale.set(1.4,.45,1.4);dummy.updateMatrix();flowers.setMatrixAt(i,dummy.matrix);flowers.setColorAt(i,new THREE.Color(i%3===0?'#d6d8a1':i%3===1?'#d9aa63':'#d69c78'));});
  const butterflies=[];
  const wingGeo=new THREE.PlaneGeometry(.12,.2),wingMat=new THREE.MeshBasicMaterial({color:'#d9b563',side:THREE.DoubleSide});
  for(let i=0;i<8;i++){const g=new THREE.Group(),left=new THREE.Mesh(wingGeo,wingMat),right=new THREE.Mesh(wingGeo,wingMat);left.position.x=-.06;right.position.x=.06;g.add(left,right);const x=between(-20,20),z=between(-28,20);g.position.set(x,1.4,z);root.add(g);butterflies.push({g,left,right,x,z,phase:random()*6.28});}
  const birdGeo=new THREE.BufferGeometry();birdGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.8,0,0,0,.12,.15,0,0,-.1,0,.12,.15,.8,0,0,0,0,-.1],3));birdGeo.computeVertexNormals();
  const birds=[];for(let i=0;i<6;i++){const bird=new THREE.Mesh(birdGeo,new THREE.MeshBasicMaterial({color:'#506b62',side:THREE.DoubleSide}));root.add(bird);birds.push(bird);}

  return {
    colliders, water,
    update(time,dt){
      waterMat.uniforms.time.value=time;
      butterflies.forEach(b=>{b.g.position.set(b.x+Math.sin(time*.35+b.phase)*1.4,1.4+Math.sin(time*.9+b.phase)*.4,b.z+Math.cos(time*.3+b.phase));b.g.rotation.y=time*.25+b.phase;b.left.rotation.y=Math.sin(time*15+b.phase)*1.1;b.right.rotation.y=-b.left.rotation.y;});
      birds.forEach((bird,i)=>{const phase=time*.035+i*1.05;bird.position.set(Math.cos(phase)*34,17+Math.sin(time*.4+i)*.8+i*.7,Math.sin(phase)*27-20);bird.rotation.y=-phase;bird.scale.y=.7+Math.sin(time*2+i)*.3;});
    },
  };
}
