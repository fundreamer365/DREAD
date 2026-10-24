'use strict';
const $=i=>document.getElementById(i),R=Math.random,rr=(a,b)=>a+R()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),wrap=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a};
const C=3,WH=4.6,W=42,H=22;
const CFG={speed:{walk:3.4,run:5.9,crouch:1.7,mPatrol:2.2,mInv:3.4,mChase:5.3,mEvac:6.3},vision:{range:26,fov:110},quality:{low:{pr:1,lights:3,shadow:false},medium:{pr:1.25,lights:4,shadow:false},high:{pr:2,lights:5,shadow:true}}};
const SND={volume:{master:.8,monster:1,ambient:.7},sounds:{idle:{type:'procedural',enabled:true},breathing:{type:'procedural',enabled:true},growl:{type:'procedural',enabled:true},detection:{type:'procedural',enabled:true,volume:.9,cooldown:8},chase:{type:'procedural',enabled:true},attack:{type:'procedural',enabled:true},step:{type:'procedural',enabled:true}}};
const S=Object.assign({master:.8,monster:1,ambient:.7,sens:1,view:1,q:'medium',fx:true},(()=>{try{return JSON.parse(localStorage.getItem('dread_s'))||{}}catch(e){return{}}})());
async function loadJSON(){
 try{const a=await(await fetch('game_config.json')).json();for(const k in a)CFG[k]=Object.assign(CFG[k]||{},a[k])}catch(e){}
 try{const b=await(await fetch('monster_sounds.json')).json();const s=(b.monster||{}).sounds||{};for(const k in s)SND.sounds[k]=Object.assign(SND.sounds[k]||{},s[k])}catch(e){}
}
/* ---------- AUDIO ---------- */
let AC,mix,nbuf;const bufs={};
function initAudio(){
 if(AC)return;try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){return}
 const cp=AC.createDynamicsCompressor();cp.threshold.value=-14;cp.ratio.value=8;cp.connect(AC.destination);
 mix={m:AC.createGain(),mon:AC.createGain(),amb:AC.createGain(),sfx:AC.createGain()};mix.m.connect(cp);['mon','amb','sfx'].forEach(k=>mix[k].connect(mix.m));
 nbuf=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate);const d=nbuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=R()*2-1;
 applyVol();
 const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=170;const dg=AC.createGain();dg.gain.value=.22;lp.connect(dg);dg.connect(mix.amb);
 [41,41.6,61.5].forEach(f=>{const o=AC.createOscillator();o.type='sawtooth';o.frequency.value=f;o.connect(lp);o.start()});
 const s=AC.createBufferSource();s.buffer=nbuf;s.loop=true;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=260;const vg=AC.createGain();vg.gain.value=.07;s.connect(f);f.connect(vg);vg.connect(mix.amb);s.start();
 mix.hum=AC.createGain();mix.hum.gain.value=0;mix.hum.connect(mix.amb);[50,100.5].forEach(fr=>{const o=AC.createOscillator();o.frequency.value=fr;o.connect(mix.hum);o.start()});
 for(const k in SND.sounds){const c=SND.sounds[k];if(c.type==='file'&&c.src)fetch(c.src).then(r=>{if(!r.ok)throw 0;return r.arrayBuffer()}).then(b=>AC.decodeAudioData(b)).then(b=>bufs[k]=b).catch(()=>console.warn('Sound file failed, using procedural:',k))}
}
function applyVol(){if(!AC)return;mix.m.gain.value=S.master*.9;mix.mon.gain.value=S.monster;mix.amb.gain.value=S.ambient;mix.sfx.gain.value=1}
function dst(bus,p){if(!p)return mix[bus];const n=AC.createPanner();n.panningModel='HRTF';n.distanceModel='inverse';n.refDistance=3;n.rolloffFactor=1.4;n.maxDistance=80;if(n.positionX){n.positionX.value=p.x;n.positionY.value=p.y;n.positionZ.value=p.z}else n.setPosition(p.x,p.y,p.z);n.connect(mix[bus]);return n}
function env(t,d,g,a){const n=AC.createGain();n.gain.setValueAtTime(.0001,t);n.gain.exponentialRampToValueAtTime(g,t+a);n.gain.exponentialRampToValueAtTime(.0001,t+d);return n}
function noise(o,t,d,type,f0,f1,q,g,a=.01){const s=AC.createBufferSource();s.buffer=nbuf;s.loop=true;const f=AC.createBiquadFilter();f.type=type;f.Q.value=q;f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(f1,t+d);const e=env(t,d,g,a);s.connect(f);f.connect(e);e.connect(o);s.start(t);s.stop(t+d+.05)}
function osc(o,t,d,type,f0,f1,g,a=.01){const s=AC.createOscillator();s.type=type;s.frequency.setValueAtTime(f0,t);s.frequency.exponentialRampToValueAtTime(f1,t+d);const e=env(t,d,g,a);s.connect(e);e.connect(o);s.start(t);s.stop(t+d+.05)}
const SCR=[{f:[380,1400,240],nf:2400,sub:50,dur:1.6,j:.05,am:23},{f:[280,2100,170],nf:1800,sub:40,dur:1.9,j:.08,am:31},{f:[520,850,300],nf:3200,sub:60,dur:1.35,j:.12,am:17}];
function screamFn(o,t,v){
 const P=SCR[(R()*SCR.length)|0],D=P.dur,sh=AC.createWaveShaper(),cv=new Float32Array(256);for(let i=0;i<256;i++)cv[i]=Math.tanh((i/128-1)*3.2);sh.curve=cv;
 const out=AC.createGain();out.gain.value=.5*v;sh.connect(out);out.connect(o);
 const am=AC.createGain();am.gain.value=.7;am.connect(sh);const lf=AC.createOscillator();lf.frequency.value=P.am;const lg=AC.createGain();lg.gain.value=.3;lf.connect(lg);lg.connect(am.gain);lf.start(t);lf.stop(t+D+.1);
 const e=env(t,D,1,.015);e.connect(am);
 [0,1,2].forEach(i=>{const os=AC.createOscillator();os.type=['sawtooth','square','sawtooth'][i];const n=20,c=new Float32Array(n);
  for(let k=0;k<n;k++){const u=k/(n-1),b=u<.3?P.f[0]+(P.f[1]-P.f[0])*u/.3:P.f[1]+(P.f[2]-P.f[1])*(u-.3)/.7;c[k]=b*(1+i*.013+(R()-.5)*P.j*2)*(i==2?.5:1)}
  os.frequency.setValueCurveAtTime(c,t,D);const f1=AC.createBiquadFilter();f1.type='bandpass';f1.Q.value=3;f1.frequency.setValueAtTime(700,t);f1.frequency.linearRampToValueAtTime(1500,t+D*.4);f1.frequency.linearRampToValueAtTime(900,t+D);
  const g=AC.createGain();g.gain.value=.35;os.connect(f1);f1.connect(g);g.connect(e);os.start(t);os.stop(t+D+.05)});
 osc(sh,t,D,'sine',P.sub*2,P.sub*.6,.9,.03);noise(sh,t,.12,'bandpass',3000,800,1,1,.002);noise(sh,t,D,'highpass',P.nf,P.nf*.6,.8,.35,.05);
}
const FX={
 pstep:(o,t,v)=>noise(o,t,.1,'lowpass',500,140,.7,.2*v,.005),
 mstep:(o,t,v)=>{osc(o,t,.4,'sine',75,26,.9*v,.005);noise(o,t,.25,'lowpass',260,80,.7,.35*v,.005)},
 breath:(o,t,v)=>{noise(o,t,1.1,'bandpass',420,800,1.6,.22*v,.45);osc(o,t,1.1,'sawtooth',52,46,.05*v,.4)},
 growl:(o,t,v)=>{osc(o,t,1.8,'sawtooth',68,42,.3*v,.2);osc(o,t,1.8,'sawtooth',71,45,.25*v,.2);noise(o,t,1.8,'lowpass',380,120,2,.3*v,.2)},
 moan:(o,t,v)=>{osc(o,t,2.4,'triangle',95,58,.22*v,.7);noise(o,t,2.2,'bandpass',300,500,3,.1*v,.8)},
 chase:(o,t,v)=>{osc(o,t,.9,'sawtooth',110,70,.3*v,.05);noise(o,t,.9,'bandpass',600,300,3,.3*v,.05)},
 attack:(o,t,v)=>{noise(o,t,.5,'highpass',900,300,.8,.8*v,.01);osc(o,t,.6,'sawtooth',240,50,.6*v,.01);osc(o,t,.4,'sine',90,30,.9*v,.01)},
 door:(o,t,v)=>{noise(o,t,.9,'bandpass',250,900,5,.35*v,.1);osc(o,t,.35,'sine',60,35,.6*v,.01)},
 click:(o,t,v)=>osc(o,t,.09,'square',900,420,.12*v,.005),
 pick:(o,t,v)=>{osc(o,t,.25,'sine',520,780,.2*v);osc(o,t+.1,.3,'sine',780,1040,.2*v)},
 power:(o,t,v)=>{osc(o,t,1.5,'sawtooth',40,180,.25*v,.3);noise(o,t,1.4,'bandpass',200,2400,1,.3*v,.3)},
 zap:(o,t,v)=>{noise(o,t,.3,'highpass',2000,6000,1,.5*v,.002);osc(o,t,.4,'sine',120,40,.5*v)},
 siren:(o,t,v)=>osc(o,t,1.2,'square',480,820,.1*v,.1),
 clang:(o,t,v)=>{[310,517,833].forEach((f,i)=>osc(o,t,1.2,'triangle',f,f*.97,.12*v/(i+1),.002));noise(o,t,.1,'bandpass',2500,1500,1,.15*v,.001)},
 scream:screamFn};
function snd(name,fx,bus,p,vol=1){
 if(!AC||AC.state!=='running')return;const c=SND.sounds[name];if(c&&c.enabled===false)return;
 const v=(c&&c.volume!=null?c.volume:1)*vol,o=dst(bus,p);
 if(bufs[name]){const s=AC.createBufferSource(),g=AC.createGain();g.gain.value=v;s.buffer=bufs[name];s.connect(g);g.connect(o);s.start();return}
 FX[fx](o,AC.currentTime,v);
}
const pos3=(x,z,y=1.5)=>({x,y,z});
function setListener(){if(!AC)return;const L=AC.listener,p=camera.position,y=P.yaw,pc=Math.cos(P.pitch),f=[-Math.sin(y)*pc,Math.sin(P.pitch),-Math.cos(y)*pc];
 if(L.positionX){L.positionX.value=p.x;L.positionY.value=p.y;L.positionZ.value=p.z;L.forwardX.value=f[0];L.forwardY.value=f[1];L.forwardZ.value=f[2];L.upX.value=0;L.upY.value=1;L.upZ.value=0}else{L.setPosition(p.x,p.y,p.z);L.setOrientation(f[0],f[1],f[2],0,1,0)}}
/* ---------- THREE SETUP ---------- */
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.1,60);camera.rotation.order='YXZ';scene.add(camera);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setClearColor(0x03050a);renderer.shadowMap.type=THREE.PCFShadowMap;document.body.prepend(renderer.domElement);
scene.fog=new THREE.Fog(0x03050a,2,38);
const amb=new THREE.AmbientLight(0x1b2638,.55);scene.add(amb);
const spot=new THREE.SpotLight(0xdfe8ff,1.7,24,.5,.55,1.4);spot.position.set(.2,-.15,0);spot.target.position.set(0,0,-5);camera.add(spot,spot.target);spot.shadow.mapSize.set(512,512);
const PL=[];for(let i=0;i<5;i++){const l=new THREE.PointLight(0xffffff,0,15,2);scene.add(l);PL.push(l)}
function mkTex(base,fn,rx,ry){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle=base;x.fillRect(0,0,128,128);fn(x);
 for(let i=0;i<900;i++){x.fillStyle=`rgba(${R()<.5?0:255},${R()<.5?0:200},${R()<.5?0:200},${R()*.07})`;x.fillRect(R()*128,R()*128,1+R()*3,1+R()*3)}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);return t}
const wallTex=mkTex('#2a3036',x=>{x.strokeStyle='#14181b';x.lineWidth=3;x.strokeRect(2,2,124,124);x.beginPath();x.moveTo(0,64);x.lineTo(128,64);x.stroke();x.fillStyle='#5a2a1c';for(let i=0;i<5;i++)x.fillRect(10+R()*100,64,2+R()*3,30+R()*34);x.fillStyle='#111';[[8,8],[120,8],[8,120],[120,120]].forEach(p=>x.fillRect(p[0],p[1],3,3))},1,1);
const floorTex=mkTex('#1d2125',x=>{x.strokeStyle='#0c0e10';x.lineWidth=2;x.strokeRect(0,0,128,128);x.fillStyle='rgba(60,10,6,.35)';x.beginPath();x.arc(40+R()*50,40+R()*50,12+R()*14,0,7);x.fill()},W*C/4,H*C/4);
const ceilTex=mkTex('#15181b',x=>{x.strokeStyle='#07090a';x.lineWidth=4;x.strokeRect(0,0,128,128)},W*C/4,H*C/4);
/* ---------- LEVEL ---------- */
const g=[];for(let y=0;y<H;y++)g.push(new Array(W).fill(1));
const carve=(a,b,c,d,v=0)=>{for(let y=b;y<=d;y++)for(let x=a;x<=c;x++)g[y][x]=v};
carve(1,1,5,5);carve(6,3,36,3);carve(8,12,34,12);carve(20,3,20,12);carve(34,3,34,12);carve(8,5,16,10);carve(12,4,12,4);carve(12,11,12,11);carve(24,5,32,10);carve(28,4,28,4);carve(28,11,28,11);carve(8,14,16,19);carve(12,13,12,13);carve(24,14,34,19);carve(30,13,30,13);carve(37,1,40,5);
[[1,1],[1,2],[10,7],[11,7],[13,8],[14,8],[25,6],[26,6],[30,6],[31,6],[25,9],[31,8],[9,15],[10,15],[15,17],[13,17]].forEach(([x,y])=>g[y][x]=2);
[[25,16],[26,16],[28,16],[29,16],[32,16],[25,18],[26,18],[28,18],[29,18]].forEach(([x,y])=>g[y][x]=3);
const cellOf=v=>Math.floor(v/C),cc=v=>(v+.5)*C;
const near8=(x,y)=>{for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const v=g[y+j]?.[x+i];if(v!==undefined&&v!==1)return true}return false};
const wallsPos=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(g[y][x]===1&&near8(x,y))wallsPos.push([x,y]);
function inst(geo,mat,list,yy){const m=new THREE.InstancedMesh(geo,mat,Math.max(1,list.length)),d=new THREE.Object3D();list.forEach((p,i)=>{d.position.set(cc(p[0]),yy,cc(p[1]));d.rotation.y=p[2]||0;d.updateMatrix();m.setMatrixAt(i,d.matrix)});m.castShadow=m.receiveShadow=true;scene.add(m);return m}
inst(new THREE.BoxGeometry(C,WH,C),new THREE.MeshLambertMaterial({map:wallTex}),wallsPos,WH/2);
const propL=(v)=>{const a=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(g[y][x]===v)a.push([x,y,R()*.3-.15]);return a};
inst(new THREE.BoxGeometry(2.3,1.3,2.3),new THREE.MeshLambertMaterial({color:0x4a3f2c,map:wallTex}),propL(2),.65);
inst(new THREE.BoxGeometry(2.3,3.3,1.6),new THREE.MeshLambertMaterial({color:0x222c33,emissive:0x061008}),propL(3),1.65);
const fl=new THREE.Mesh(new THREE.PlaneGeometry(W*C,H*C),new THREE.MeshLambertMaterial({map:floorTex}));fl.rotation.x=-Math.PI/2;fl.position.set(W*C/2,0,H*C/2);fl.receiveShadow=true;scene.add(fl);
const ce=new THREE.Mesh(new THREE.PlaneGeometry(W*C,H*C),new THREE.MeshLambertMaterial({map:ceilTex}));ce.rotation.x=Math.PI/2;ce.position.set(W*C/2,WH,H*C/2);scene.add(ce);
// decor: pipes + monster traces
const pm=new THREE.MeshLambertMaterial({color:0x2c3338});
[[cc(21),cc(3)-1.2,31*C,'x'],[cc(21),cc(12)+1.2,27*C,'x']].forEach(a=>{const p=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,a[2],8),pm);p.rotation.z=Math.PI/2;p.position.set(a[0],WH-.5,a[1]);scene.add(p)});
const sp=document.createElement('canvas');sp.width=sp.height=64;{const x=sp.getContext('2d'),gr=x.createRadialGradient(32,32,2,32,32,30);gr.addColorStop(0,'rgba(40,4,2,.9)');gr.addColorStop(1,'rgba(20,2,2,0)');x.fillStyle=gr;x.fillRect(0,0,64,64)}
const spT=new THREE.CanvasTexture(sp);[[16,3],[20,8],[12,12],[28,12],[34,8],[26,7],[12,7],[29,16]].forEach(([x,y])=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(rr(2,4),rr(2,4)),new THREE.MeshBasicMaterial({map:spT,transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.rotation.z=R()*6;m.position.set(cc(x)+rr(-.8,.8),.02,cc(y)+rr(-.8,.8));scene.add(m)});
// lamps
const LAMPS=[];
function lamp(cx,cy,red,pw,bad,dx=0,dz=0){const col=new THREE.Color(red?0xff2a14:0xcfe0ff),mat=new THREE.MeshBasicMaterial({color:col.clone()}),m=new THREE.Mesh(new THREE.BoxGeometry(red?.5:1.5,.1,red?.5:.5),mat);m.position.set(cc(cx)+dx,WH-.06,cc(cy)+dz);scene.add(m);LAMPS.push({x:m.position.x,z:m.position.z,col,mat,red,pw,bad,ph:R()*50,m:1})}
[9,15,23,29,33].forEach(x=>lamp(x,3,true,0,false));[10,18,24,31].forEach(x=>lamp(x,12,true,0,false));lamp(20,7,true,0,false);lamp(34,7,true,0,false);
lamp(3,3,false,0,true);lamp(12,7,false,0,true);lamp(28,7,false,1,false);lamp(12,16,false,1,false);lamp(29,16,false,1,false);lamp(38,3,false,2,false);lamp(19,3,false,1,true);lamp(26,12,false,1,true);lamp(12,3,false,1,false);
// interactables
const ITEMS=[],DOORS=[],doorAt=new Array(W*H).fill(null);
function mk(geo,col,x,y,z,basic){const m=new THREE.Mesh(geo,basic?new THREE.MeshBasicMaterial({color:col}):new THREE.MeshLambertMaterial({color:col}));m.position.set(x,y,z);scene.add(m);return m}
const bx=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
function item(kind,cx,cy,label,note){const x=cc(cx),z=cc(cy);let grp=new THREE.Group();grp.position.set(x,0,z);scene.add(grp);const add=(m)=>{m.position.add(m.userData.o||new THREE.Vector3());grp.add(m)};
 const put=(geo,col,y,basic,dz=0)=>{const m=new THREE.Mesh(geo,basic?new THREE.MeshBasicMaterial({color:col}):new THREE.MeshLambertMaterial({color:col}));m.position.set(0,y,dz);grp.add(m)};
 if(kind==='note'){put(bx(.9,1.2,.6),0x1a1d1f,.6);put(bx(.7,.45,.66),0x44ff77,1.0,true)}
 else if(kind==='fuse'){put(new THREE.CylinderGeometry(.3,.35,.8,8),0x2a2a2a,.4);put(bx(.18,.4,.18),0xffcc33,1.0,true)}
 else if(kind==='key'){put(new THREE.CylinderGeometry(.3,.35,.8,8),0x2a2a2a,.4);put(bx(.4,.05,.25),0x3399ff,.9,true)}
 else if(kind==='panel'){put(bx(1.3,1.7,.5),0x23282b,.85);put(bx(.3,.3,.54),0xff2222,1.3,true)}
 else{put(bx(1,1.2,.7),0x23282b,.6);put(bx(.3,.15,.74),0xffaa00,1.2,true)}
 const o={kind,x,z,label,note,done:false,grp};ITEMS.push(o);return o}
item('note',3,1,'Read terminal','TERMINAL 01 — Day 41. Containment breach in Sector C. Staff left without shutting anything down. Do not go back to the lab. The door is not sealed — leave.');
item('note',9,6,'Read terminal','LAB LOG — Specimen 9 learned the sound of our footsteps. It cannot see well in the dark. Walk slowly. Crouch when it is near. Do not run.');
item('note',20,8,'Read terminal','MAINTENANCE — Emergency fuse was pulled from the lab. The power panel is in the technical room. Storage doors are sealed without power.');
item('note',24,5,'Read terminal','INVENTORY — The level-2 keycard is in storage. The server room door needs it. The evacuation override is inside the server room.');
item('note',33,15,'Read terminal','SYSTEM — Evacuation override ready. WARNING: the alarm will draw the specimen. The exit is at the east end of the main corridor.');
item('fuse',15,9,'Take fuse');item('panel',9,19,'Insert fuse');item('key',31,9,'Take keycard');item('evac',33,18,'Activate evacuation');
function door(cx,cy,kind,horiz){const x=cc(cx),z=cc(cy),m=new THREE.Mesh(horiz?bx(.35,WH,C):bx(C,WH,.35),new THREE.MeshLambertMaterial({color:0x3a3d40,emissive:kind==='free'?0x050505:0x2a0504}));m.position.set(x,WH/2,z);m.castShadow=true;scene.add(m);
 const d={cx,cy,x,z,kind,m,open:false,k:0,locked:kind!=='free',door:true};DOORS.push(d);doorAt[cy*W+cx]=d}
door(6,3,'free',true);door(28,4,'power',false);door(28,11,'power',false);door(30,13,'key',false);door(36,3,'evac',true);
/* ---------- MONSTER ---------- */
function buildMonster(){
 const root=new THREE.Group(),m=new THREE.MeshLambertMaterial({color:0x17120f,emissive:0x070302}),sk=new THREE.MeshLambertMaterial({color:0x4a3b31,emissive:0x0a0604});
 const piv=(p,x,y,z)=>{const g=new THREE.Group();g.position.set(x,y,z);p.add(g);return g};
 const part=(p,geo,mat,y,x=0,z=0)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;p.add(o);return o};
 const hips=piv(root,0,2.3,0);part(hips,bx(.9,.5,.5),m,0);
 const legs=[-1,1].map(s=>{const th=piv(hips,s*.38,-.1,0);part(th,bx(.3,1.1,.3),m,-.55);const kn=piv(th,0,-1.1,0);part(kn,bx(.22,1.1,.22),sk,-.55);part(kn,bx(.3,.12,.6),m,-1.1,0,.15);return{th,kn}});
 const sp=piv(hips,0,.2,0);sp.rotation.x=.4;part(sp,bx(.95,1.7,.55),m,.85);part(sp,bx(1.3,.35,.6),m,1.6);
 const hd=piv(sp,0,1.75,.05);hd.rotation.x=-.2;const sk2=part(hd,new THREE.SphereGeometry(.36,10,8),sk,.35);sk2.scale.set(.7,1.6,.9);
 const jaw=piv(hd,0,.0,.12);part(jaw,bx(.22,.5,.2),m,-.2,0,.05);
 const em=new THREE.MeshBasicMaterial({color:0xff3b2a,fog:false});[-.12,.12].forEach(x=>{const e=part(hd,new THREE.SphereGeometry(.05,6,6),em,.5,x,.28)});
 const arms=[-1,1].map(s=>{const sh=piv(sp,s*.75,1.55,0);part(sh,bx(.17,1.7,.17),sk,-.85);const el=piv(sh,0,-1.7,0);part(el,bx(.13,1.9,.13),m,-.95);[-.08,0,.08].forEach(cx=>part(el,bx(.03,.5,.03),m,-2.15,cx,0));return{sh,el}});
 root.add(new THREE.Group());root.scale.setScalar(.88);return{root,hips,legs,spine:sp,hd,jaw,arms}}
const M=Object.assign(buildMonster(),{x:0,z:0,yaw:0,st:'IDLE',t:0,wait:8,path:[],aware:0,cool:0,delay:0,lost:0,last:null,rep:0,sp:0,ph:0,pts:0,wt:0,atk:0,hit:false,br:3,gr:8,hear:0,sg:1,hunt:0});scene.add(M.root);
const eyeM=null;
function passM(cx,cy){if(cx<0||cy<0||cx>=W||cy>=H||g[cy][cx])return false;const d=doorAt[cy*W+cx];return!d||!d.locked||d.open}
function bfs(sx,sy,tx,ty){if(!passM(tx,ty))return null;const prev=new Int32Array(W*H).fill(-1),s=sy*W+sx;prev[s]=s;const q=[s];let h=0;
 while(h<q.length){const c=q[h++];if(c===ty*W+tx)break;const x=c%W,y=(c/W)|0;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(passM(nx,ny)&&prev[ny*W+nx]<0){prev[ny*W+nx]=c;q.push(ny*W+nx)}}}
 if(prev[ty*W+tx]<0)return null;const p=[];let c=ty*W+tx;while(c!==s){p.push([c%W,(c/W)|0]);c=prev[c]}return p.reverse()}
function solidP(cx,cy){if(cx<0||cy<0||cx>=W||cy>=H||g[cy][cx])return true;const d=doorAt[cy*W+cx];return!!d&&!d.open}
function hitP(x,z,r=.4){return solidP(cellOf(x-r),cellOf(z-r))||solidP(cellOf(x+r),cellOf(z-r))||solidP(cellOf(x-r),cellOf(z+r))||solidP(cellOf(x+r),cellOf(z+r))}
function los(ax,az,bx_,bz,crouch){const dx=bx_-ax,dz=bz-az,n=Math.ceil(Math.hypot(dx,dz)/.5);for(let i=1;i<n;i++){const cx=cellOf(ax+dx*i/n),cy=cellOf(az+dz*i/n),v=g[cy]?.[cx];if(v===1||v===3||(v===2&&crouch))return false;const d=doorAt[cy*W+cx];if(d&&!d.open)return false}return true}
const PW=[[3,3],[12,3],[20,3],[28,3],[34,3],[20,8],[34,8],[12,7],[28,7],[12,12],[28,12],[12,16],[29,16],[16,9],[26,9],[20,12]];
function setPath(tx,tz){const p=bfs(cellOf(M.x),cellOf(M.z),cellOf(tx),cellOf(tz));M.path=p||[];return!!p}
function turn(a,r){M.yaw+=wrap(a-M.yaw)*Math.min(1,r)}
function openDoor(d,byM){if(d.open)return;d.open=true;d.locked=false;snd('x','door','sfx',pos3(d.x,d.z));if(!byM&&d.kind==='free'&&G.stage===0){G.stage=1;setObj('Find the power fuse. Try the laboratory.')}}
function follow(sp,dt){
 if(!M.path.length)return true;const n=M.path[0],tx=cc(n[0]),tz=cc(n[1]),dx=tx-M.x,dz=tz-M.z,d=Math.hypot(dx,dz),dr=doorAt[n[1]*W+n[0]];
 if(dr&&!dr.open&&d<C*.95)openDoor(dr,true);
 if(d<.2){M.path.shift();return!M.path.length}
 const s=Math.min(d,sp*dt);M.x+=dx/d*s;M.z+=dz/d*s;M.sp=sp;turn(Math.atan2(dx,dz),dt*(M.st==='CHASE'?9:3.5));return false}
function goInvestigate(x,z){if(M.st==='CHASE'||M.st==='ATTACK')return;if(setPath(x,z)){M.st='INVESTIGATE';M.t=0}}
function toIdle(){M.st='IDLE';M.t=0;M.wait=rr(2,4);M.path=[]}
function pickPatrol(){let w=PW[(R()*PW.length)|0];if(R()<.3){let b=1e9;PW.forEach(p=>{const d=Math.hypot(cc(p[0])-P.x,cc(p[1])-P.z);if(d<b&&d>8){b=d;w=p}})}if(setPath(cc(w[0]),cc(w[1]))){M.st='PATROL'}else toIdle()}
function pickNear(){for(let i=0;i<10;i++){const cx=cellOf(M.x)+((R()*11)|0)-5,cy=cellOf(M.z)+((R()*11)|0)-5;if(passM(cx,cy)&&setPath(cc(cx),cc(cy)))return}}
function startChase(){
 if(M.st==='CHASE'||M.st==='ATTACK')return;M.st='CHASE';M.aware=0;M.lost=0;M.last=[P.x,P.z];M.rep=0;M.path=[];M.delay=.8;
 if(M.cool<=0){snd('detection','scream','mon',pos3(M.x,M.z,3.5),1);M.cool=SND.sounds.detection.cooldown||8;G.flash=.7;G.shake=.7;G.fl=.8}else M.delay=.35}
function updateMonster(dt){
 M.sp=0;M.cool-=dt;M.t+=dt;M.hear-=dt;const dx=P.x-M.x,dz=P.z-M.z,d=Math.hypot(dx,dz),ch=M.st==='CHASE'||M.st==='ATTACK';
 let seen=false;if(!G.dying&&d<CFG.vision.range&&(Math.abs(wrap(Math.atan2(dx,dz)-M.yaw))<CFG.vision.fov*Math.PI/360||d<3.2)&&los(M.x,M.z,P.x,P.z,P.ck>.6))seen=true;
 if(!ch&&!G.dying){
  if(seen){const r=(1.2+12/Math.max(d,3))*(P.run?1.8:1)*(P.ck>.6?.35:1)*(P.flash?1.25:1)*(M.st==='SEARCH'||M.st==='LOST_PLAYER'?1.4:1);M.aware+=r*.25*dt;if(d<2.5)M.aware=1}else M.aware=Math.max(0,M.aware-.4*dt);
  const n=Math.max(P.noise,P.imp);if(n>0&&d<n&&M.hear<=0){M.hear=1.5;goInvestigate(P.x+rr(-2,2),P.z+rr(-2,2));if(seen)M.aware+=.4}
  if(G.evac){M.hunt-=dt;if(M.hunt<=0){M.hunt=16;goInvestigate(P.x,P.z)}}
  if(M.aware>=1)startChase()}
 switch(M.st){
  case'IDLE':if(M.t>M.wait)pickPatrol();break;
  case'PATROL':if(follow(CFG.speed.mPatrol,dt))toIdle();break;
  case'INVESTIGATE':if(follow(CFG.speed.mInv,dt)){M.st='SEARCH';M.pts=2;M.wt=rr(1.5,2.5);M.t=0}break;
  case'SEARCH':if(M.path.length)follow(2.2,dt);else{M.wt-=dt;if(M.wt<=0){if(M.pts>0){M.pts--;pickNear();M.wt=rr(1.8,3)}else toIdle()}}break;
  case'LOST_PLAYER':if(follow(3.8,dt)){M.st='SEARCH';M.pts=3;M.wt=rr(1.5,2.5);M.t=0}break;
  case'CHASE':{
   if(M.delay>0){M.delay-=dt;turn(Math.atan2(dx,dz),dt*14);break}
   if(seen){M.last=[P.x,P.z];M.lost=0}else M.lost+=dt;
   M.rep-=dt;if(M.rep<=0){M.rep=.35;setPath(M.last[0],M.last[1])}
   const sp=G.evac?CFG.speed.mEvac:CFG.speed.mChase;
   if(M.path.length)follow(sp,dt);else{const tx=M.last[0]-M.x,tz=M.last[1]-M.z,td=Math.hypot(tx,tz);if(td>.6){const s=Math.min(td,sp*dt);M.x+=tx/td*s;M.z+=tz/td*s;M.sp=sp;turn(Math.atan2(tx,tz),dt*9)}}
   if(d<2.2&&(seen||d<1.6)&&!G.dying){M.st='ATTACK';M.atk=0;M.hit=false;G.dying=true;G.dyT=0;snd('attack','attack','mon',pos3(M.x,M.z,2))}
   else if(M.lost>2.4){M.st='LOST_PLAYER';setPath(M.last[0],M.last[1])}
   break}
  case'ATTACK':M.atk+=dt;turn(Math.atan2(dx,dz),dt*10);break}
 if(M.st==='ATTACK'||G.dying){}
 // monster voice
 M.br-=dt;if(M.br<=0){M.br=ch?.9:rr(2.4,3.6);snd('breathing','breath','mon',pos3(M.x,M.z,3.5),ch?1.4:1)}
 M.gr-=dt;if(M.gr<=0){M.gr=ch?3:rr(7,15);if(d<50){const gw=R()<.5;snd(ch?'chase':gw?'growl':'idle',ch?'chase':gw?'growl':'moan','mon',pos3(M.x,M.z,3.5))}}
}
function animMonster(dt){
 const k=Math.min(1,M.sp/3),ch=M.st==='CHASE',sc=ch&&M.delay>0,at=M.st==='ATTACK',sr=M.st==='SEARCH'||M.st==='IDLE';
 M.ph+=M.sp*dt*1.15;const s=Math.sin(M.ph),sg=s>=0?1:-1;if(sg!==M.sg&&M.sp>.5){M.sg=sg;snd('step','mstep','mon',pos3(M.x,M.z,0))}
 const L=(o,key,v,r=10)=>{o.rotation[key]+=(v-o.rotation[key])*Math.min(1,dt*r)};
 M.legs.forEach((l,i)=>{const q=i?-s:s;L(l.th,'x',q*.75*k);L(l.kn,'x',Math.max(0,-q)*1.0*k+.1)});
 M.arms.forEach((a,i)=>{const q=i?s:-s;L(a.sh,'x',sc?-2.6+Math.sin(M.t*40)*.1:at?-1.4+Math.min(M.atk*4,1)*2.2:q*.5*k-.15);L(a.el,'x',sc?-.3:at?-.5:-.25-Math.abs(q)*.3*k);L(a.sh,'z',(i?1:-1)*(sc?.9:.08))});
 L(M.spine,'x',sc?-.1:ch?.8:.4+Math.sin(M.t*1.3)*.04,6);L(M.hips,'z',Math.sin(M.ph)*.05*k,6);M.hips.position.y=2.3+Math.abs(s)*.14*k-(ch&&!sc?.3:0);
 const rel=clamp(wrap(Math.atan2(P.x-M.x,P.z-M.z)-M.yaw),-1.1,1.1);L(M.hd,'y',ch||at?rel:sr?Math.sin(M.t*.9)*.9:Math.sin(M.t*.4)*.3,6);L(M.hd,'x',sc?-.9:-.2,8);L(M.jaw,'x',sc?.8+Math.sin(M.t*50)*.2:at?.6:.1,12);
 M.root.position.set(M.x,0,M.z);M.root.rotation.y=M.yaw}
/* ---------- PLAYER / GAME STATE ---------- */
const P={x:0,z:0,y:0,vy:0,vx:0,vz:0,yaw:0,pitch:0,eye:1.7,ck:0,run:false,stam:1,tired:false,bob:0,noise:0,imp:0,flash:true,fov:72,step:0,ground:true};
let G={},state='menu',near=null;const keys={};
function setObj(t){const o=$('obj');o.textContent=t;o.classList.add('n');setTimeout(()=>o.classList.remove('n'),2500)}
let toastT;function toast(t,ms=6000){const e=$('toast');e.textContent=t;e.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('on'),ms)}
function reset(){
 Object.assign(P,{x:cc(3),z:cc(3),y:0,vy:0,vx:0,vz:0,yaw:-Math.PI/2,pitch:0,stam:1,tired:false,ck:0,imp:0,noise:0,flash:true});
 G={stage:0,power:false,evac:false,has:{},black:0,fl:0,shake:0,flash:0,dying:false,dyT:0,ev:rr(25,40),alarm:0,winT:0,t:0,lt:0};
 ITEMS.forEach(i=>{i.done=false;i.grp.visible=true});DOORS.forEach(d=>{d.open=false;d.k=0;d.locked=d.kind!=='free';d.m.position.y=WH/2;d.m.material.emissive.setHex(d.kind==='free'?0x050505:0x2a0504)});
 Object.assign(M,{x:cc(34),z:cc(8),yaw:0,st:'IDLE',t:0,wait:12,path:[],aware:0,cool:0,delay:0,hit:false,hunt:12});if(mix&&mix.hum)mix.hum.gain.value=0;
 setObj('Open the door and leave the room.');$('fade').style.opacity=0;$('hint').style.opacity=1;setTimeout(()=>$('hint').style.opacity=0,14000)}
function interact(o){
 P.imp=Math.max(P.imp,6);
 if(o.door){if(o.locked){const r={power:'There is no power.',key:'Access denied. Level-2 keycard required.',evac:'Sealed. The evacuation system is offline.'}[o.kind];snd('x','click','sfx');if(o.kind==='key'&&G.has.key){o.locked=false;openDoor(o)}else toast(r,3000)}else openDoor(o);return}
 if(o.kind==='note'){snd('x','click','sfx');toast(o.note,9000);return}
 if(o.kind==='fuse'){o.done=true;o.grp.visible=false;G.has.fuse=true;snd('x','pick','sfx');if(G.stage<2){G.stage=2;setObj('Install the fuse in the power panel. Technical room.')}}
 else if(o.kind==='panel'){if(!G.has.fuse){toast('The fuse slot is empty.',3000);snd('x','click','sfx');return}
  o.done=true;G.power=true;DOORS.forEach(d=>{if(d.kind==='power')d.locked=false});snd('x','power','sfx');if(mix&&mix.hum)mix.hum.gain.linearRampToValueAtTime(.05,AC.currentTime+2);G.black=0;G.stage=3;setObj('Power restored. Find the keycard in the storage.');P.imp=14}
 else if(o.kind==='key'){o.done=true;o.grp.visible=false;G.has.key=true;snd('x','pick','sfx');G.stage=4;setObj('Open the server room and activate the evacuation.')}
 else if(o.kind==='evac'){o.done=true;G.evac=true;G.alarm=0;DOORS.forEach(d=>{if(d.kind==='evac')d.locked=false;d.m.material.emissive.setHex(0x100000)});snd('x','zap','sfx');setObj('RUN. Reach the evacuation exit at the east end.');toast('EVACUATION ACTIVE. It heard that.',5000);P.imp=30;M.hunt=0;G.ev=8}}
function die(){state='dead';document.exitPointerLock();show('dead')}
function win(){state='win';G.winT=0}
function show(id){['menu','pause','dead','win'].forEach(k=>$(k).classList.toggle('hidden',k!==id));$('hud').classList.toggle('hidden',id!=='pause')}
function hideAll(){['menu','pause','dead','win','settings'].forEach(k=>$(k).classList.add('hidden'));$('hud').classList.remove('hidden')}
function lock(){try{const p=renderer.domElement.requestPointerLock();if(p&&p.catch)p.catch(()=>{})}catch(e){}}
function begin(){initAudio();if(AC)AC.resume();reset();state='starting';$('settings').classList.add('hidden');lock();$('lockmsg').textContent=''}
function pause(){state='pause';show('pause');if(AC)AC.suspend()}
document.addEventListener('pointerlockchange',()=>{const l=document.pointerLockElement===renderer.domElement;if(l&&(state==='starting'||state==='pause')){state='play';hideAll();if(AC)AC.resume()}else if(!l&&state==='play')pause()});
document.addEventListener('pointerlockerror',()=>{$('lockmsg').textContent='Could not capture the mouse. Click again.'});
addEventListener('mousemove',e=>{if(state!=='play'||G.dying||document.pointerLockElement!==renderer.domElement)return;const s=.0022*S.sens;P.yaw-=e.movementX*s;P.pitch=clamp(P.pitch-e.movementY*s,-1.45,1.45)});
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Space')e.preventDefault();if(state!=='play'||G.dying)return;if(e.code==='KeyE'&&near)interact(near);if(e.code==='KeyF'){P.flash=!P.flash;snd('x','click','sfx')}});
addEventListener('keyup',e=>keys[e.code]=false);addEventListener('blur',()=>{for(const k in keys)keys[k]=false});
/* ---------- UPDATE ---------- */
function updatePlayer(dt){
 const fwd=(keys.KeyW?1:0)-(keys.KeyS?1:0),str=(keys.KeyD?1:0)-(keys.KeyA?1:0),mv=fwd||str;
 const wantC=keys.ControlLeft||keys.ControlRight||keys.KeyC;P.ck+=((wantC?1:0)-P.ck)*Math.min(1,dt*9);
 if(P.stam<=0)P.tired=true;if(P.stam>.3)P.tired=false;
 P.run=!!(keys.ShiftLeft||keys.ShiftRight)&&mv&&!wantC&&!P.tired&&P.stam>0;P.stam=clamp(P.stam+(P.run?-.28:.2)*dt,0,1);
 const sp=P.run?CFG.speed.run:wantC?CFG.speed.crouch:CFG.speed.walk,l=Math.hypot(fwd,str)||1,sy=Math.sin(P.yaw),cy=Math.cos(P.yaw);
 const tx=(-sy*fwd+cy*str)/l*sp*(mv?1:0),tz=(-cy*fwd-sy*str)/l*sp*(mv?1:0),a=Math.min(1,dt*(mv?9:7));
 P.vx+=(tx-P.vx)*a;P.vz+=(tz-P.vz)*a;
 let nx=P.x+P.vx*dt;if(!hitP(nx,P.z))P.x=nx;else P.vx=0;let nz=P.z+P.vz*dt;if(!hitP(P.x,nz))P.z=nz;else P.vz=0;
 if(keys.Space&&P.ground&&!wantC){P.vy=5.2;P.ground=false;P.imp=Math.max(P.imp,5)}
 const pv=P.vy;P.vy-=14*dt;P.y+=P.vy*dt;if(P.y<=0){if(!P.ground&&pv<-4){P.imp=Math.max(P.imp,12);snd('x','pstep','sfx',null,3)}P.y=0;P.vy=0;P.ground=true}
 const spd=Math.hypot(P.vx,P.vz);P.noise=spd>.6?(P.run?16:wantC?3:7):0;P.imp=Math.max(0,P.imp-8*dt);
 if(P.ground&&spd>.6){P.bob+=spd*dt*(P.run?1.7:1.45);const st=Math.floor(P.bob/Math.PI);if(st!==P.step){P.step=st;snd('x','pstep','sfx',null,P.run?1.6:wantC?.4:1)}}
 P.eye+=((wantC?1.0:1.7)-P.eye)*Math.min(1,dt*9);
 P.fov+=((P.run?80:72)-P.fov)*Math.min(1,dt*6);
 $('stamb').style.width=P.stam*100+'%';$('stam').style.opacity=P.stam<.98?1:0;
 // interaction
 let b=null,bd=9;const fx=-sy,fz=-cy;for(const o of ITEMS.concat(DOORS)){if(o.done||o.open)continue;const dx=o.x-P.x,dz=o.z-P.z,d=Math.hypot(dx,dz);if(d<3&&d<bd&&(dx*fx+dz*fz)/Math.max(d,.01)>.3){b=o;bd=d}}
 near=b;const pr=$('prompt');if(b){pr.textContent=b.door?(b.locked?'[E] Locked door':'[E] Open door'):'[E] '+b.label;pr.classList.add('on')}else pr.classList.remove('on');
 if(G.evac&&P.x>cc(37)&&state==='play')win()}
function updLamps(t,dt){
 for(const l of LAMPS){let on=l.pw===0?true:l.pw===1?G.power:G.evac;on=on&&G.black<=0;let m=on?1:0;
  if(on&&l.bad)m=(Math.sin(t*31+l.ph)+Math.sin(t*11.3+l.ph*3)>1)?.08:1;if(on&&G.fl>0&&R()<.4)m=.1;if(on&&l.red&&G.evac)m*=.55+.45*Math.sin(t*5);if(on&&!l.red&&!l.bad&&l.pw===0)m*=.8;
  l.m=m;l.mat.color.copy(l.col).multiplyScalar(m>0?.25+.75*m:.05)}
 G.lt-=dt;if(G.lt<=0){G.lt=.3;const K=CFG.quality[S.q].lights,s=LAMPS.filter(l=>l.m>.05).sort((a,b)=>Math.hypot(a.x-P.x,a.z-P.z)-Math.hypot(b.x-P.x,b.z-P.z));PL.forEach((p,i)=>{p.visible=i<K;p.userData.t=s[i]||null})}
 PL.forEach(p=>{const l=p.userData.t;if(l){p.position.x+=(l.x-p.position.x)*Math.min(1,dt*6);p.position.z+=(l.z-p.position.z)*Math.min(1,dt*6);p.position.y=WH-.6;p.color.copy(l.col);p.intensity+=((l.red?.9:1.2)*l.m-p.intensity)*Math.min(1,dt*8)}else p.intensity*=Math.max(0,1-dt*8)})}
function events(dt){
 G.ev-=dt;if(G.ev>0)return;G.ev=G.evac?rr(10,20):rr(28,60);const r=R(),a=R()*6.28,px=P.x+Math.cos(a)*18,pz=P.z+Math.sin(a)*18;
 if(r<.25){G.black=rr(1.8,3.5);snd('x','zap','sfx')}
 else if(r<.5){for(let i=0;i<6;i++)setTimeout(()=>{if(state==='play')snd('step','mstep','mon',pos3(px+i*.3,pz,0),.8)},i*620)}
 else if(r<.7)snd('x','clang','sfx',pos3(px,pz,3),1.2);
 else if(r<.85){snd('x','door','sfx',pos3(px,pz));setTimeout(()=>snd('x','door','sfx',pos3(px,pz)),1400)}
 else G.fl=3}
let lastT=0;
function loop(ts){requestAnimationFrame(loop);const dt=Math.min(.05,(ts-lastT)/1000||0);lastT=ts;const t=ts/1000;
 if(state==='play'||state==='win'){
  G.t+=dt;
  if(state==='play'){if(!G.dying)updatePlayer(dt);updateMonster(dt);events(dt)}
  else{G.winT+=dt;const nx=P.x+3*dt;if(!hitP(nx,P.z))P.x=nx;P.yaw+=(-Math.PI/2-P.yaw)*dt*2;$('fade').style.opacity=clamp(G.winT/3,0,1);if(G.winT>3.2){document.exitPointerLock();show('win');state='won'}}
  if(G.dying){G.dyT+=dt;const a=Math.atan2(M.x-P.x,M.z-P.z);P.yaw+=wrap(Math.atan2(-(M.x-P.x),-(M.z-P.z))-P.yaw)*Math.min(1,dt*6);P.pitch+=(.5-P.pitch)*dt*4;G.shake=Math.max(G.shake,.4);G.flash=Math.max(G.flash,G.dyT*.8);if(G.dyT>1.2&&state==='play')die()}
  DOORS.forEach(d=>{if(d.open&&d.k<1){d.k=Math.min(1,d.k+dt*1.4);d.m.position.y=WH/2+d.k*(WH-.3)}});
  if(G.black>0)G.black-=dt;if(G.fl>0)G.fl-=dt;
  if(G.evac){G.alarm-=dt;if(G.alarm<=0){G.alarm=1.6;snd('x','siren','amb',null,1)}}
  animMonster(dt);
 }
 if(state==='play'||state==='win'||state==='starting'||state==='menu'){updLamps(t,dt)}
 // camera
 const fx=S.fx,bobv=fx&&P.ground?Math.sin(P.bob*2)*.045*(P.run?1.6:1)*Math.min(1,Math.hypot(P.vx,P.vz)/2):0;
 G.shake=Math.max(0,(G.shake||0)-dt*.8);const sh=fx?G.shake:0;
 camera.position.set(P.x,P.y+P.eye+bobv,P.z);camera.rotation.set(P.pitch+(R()-.5)*.04*sh,P.yaw+(R()-.5)*.04*sh,fx?Math.sin(P.bob)*.004*(P.run?2:1)+(R()-.5)*.03*sh:0);
 if(camera.fov!==P.fov){camera.fov=fx?P.fov:72;camera.updateProjectionMatrix()}
 const dm=Math.hypot(M.x-P.x,M.z-P.z),bk=G.black>0||G.fl>0;
 spot.intensity=P.flash?1.7*(bk&&R()<.5?.15:1)*(dm<12&&dm>3&&R()<.1?.2:1):0;
 amb.intensity=.55+(G.flash||0)*.5;G.flash=Math.max(0,(G.flash||0)-dt*.9);$('flash').style.opacity=Math.min(1,G.flash);
 setListener();renderer.render(scene,camera)}
/* ---------- UI / SETTINGS ---------- */
function applyS(){applyVol();const q=CFG.quality[S.q];renderer.setPixelRatio(Math.min(q.pr,devicePixelRatio));renderer.setSize(innerWidth,innerHeight);
 if(renderer.shadowMap.enabled!==q.shadow){renderer.shadowMap.enabled=q.shadow;spot.castShadow=q.shadow;scene.traverse(o=>{if(o.material)o.material.needsUpdate=true})}
 camera.far=60*S.view;scene.fog.far=38*S.view;camera.updateProjectionMatrix();try{localStorage.setItem('dread_s',JSON.stringify(S))}catch(e){}}
const ctl={sMaster:['master',100],sMon:['monster',100],sAmb:['ambient',100],sSens:['sens',100],sView:['view',100]};
for(const id in ctl){const[k,d]=ctl[id];$(id).value=S[k]*d;$(id).oninput=e=>{S[k]=e.target.value/d;applyS()}}
$('sQ').value=S.q;$('sQ').onchange=e=>{S.q=e.target.value;applyS()};$('sFx').checked=S.fx;$('sFx').onchange=e=>{S.fx=e.target.checked;applyS()};
let setFrom='menu';const openSet=()=>$('settings').classList.remove('hidden');
$('bStart').onclick=begin;$('bRetry').onclick=begin;$('bAgain').onclick=begin;$('bRest').onclick=begin;$('bRes').onclick=()=>{lock()};
$('bSet').onclick=openSet;$('bSet2').onclick=openSet;$('bBack').onclick=()=>$('settings').classList.add('hidden');
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()});
loadJSON().then(()=>{applyS();reset();$('hud').classList.add('hidden');requestAnimationFrame(loop)});
