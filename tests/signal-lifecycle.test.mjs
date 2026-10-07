// Actual React/R3F hooks with a mocked renderer. These checks cover logical
// render work, invalidation and resource lifetime, not GPU image quality/FPS.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),repo=new URL('../',import.meta.url).pathname;
const listeners=()=>{const map=new Map();return{addEventListener(type,fn){if(!map.has(type))map.set(type,new Set());map.get(type).add(fn);},removeEventListener(type,fn){map.get(type)?.delete(fn);},emit(type){for(const fn of map.get(type)||[])fn({type});},count:()=>[...map.values()].reduce((sum,set)=>sum+set.size,0)};};
const preference={...listeners(),matches:false},doc={...listeners(),hidden:false};
globalThis.document=doc;globalThis.window={matchMedia:()=>preference,devicePixelRatio:1};
if(!globalThis.navigator)globalThis.navigator={};
globalThis.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),16);globalThis.cancelAnimationFrame=clearTimeout;
const React=require('react'),THREE=require('three'),fiber=require('@react-three/fiber');fiber.extend(THREE);
const compiled=require('esbuild').buildSync({stdin:{contents:fs.readFileSync(new URL('../src/SignalDisplay.jsx',import.meta.url),'utf8'),sourcefile:repo+'src/SignalDisplay.jsx',resolveDir:repo+'src',loader:'jsx'},bundle:true,platform:'node',format:'cjs',packages:'external',write:false}).outputFiles[0].text;
const module={exports:{}};new Function('module','exports','require',compiled)(module,module.exports,require);const Display=module.exports.default;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const until=async predicate=>{const deadline=performance.now()+4000;while(!predicate()){assert.ok(performance.now()<deadline,'React effect timed out');await sleep(10);}};
test('cached scene follows DPR and context recovery while idle, hidden and reduced-motion work stays bounded',async()=>{
 let ratio=1,target=null,postScene,validImage=false,calls=[];const targets=[];const noop=()=>{};
 const canvas={...listeners(),style:{}};
 const gl={domElement:canvas,render(scene){calls.push(target?'scene':'post');if(target)validImage=true;else postScene=scene;},setPixelRatio:value=>{ratio=value;},getPixelRatio:()=>ratio,setSize:noop,setRenderTarget:value=>{target=value;if(value&&!targets.includes(value))targets.push(value);},setClearColor:noop,clear:noop,xr:{addEventListener:noop,removeEventListener:noop},shadowMap:{},capabilities:{isWebGL2:true}};
 const root=fiber.createRoot(canvas);root.configure({gl,size:{width:390,height:844,top:0,left:0},frameloop:'never',dpr:1,camera:{position:[0,0,3.8],fov:38}});
 let invalidate;const pending=new Set(),nativeSet=globalThis.setTimeout,nativeClear=globalThis.clearTimeout;
 globalThis.setTimeout=(fn,delay,...args)=>{let token;token=nativeSet(()=>{pending.delete(token);fn(...args);},delay);if(fn===invalidate)pending.add(token);return token;};
 globalThis.clearTimeout=token=>{pending.delete(token);return nativeClear(token);};
 try{
  const render=active=>root.render(React.createElement(Display,{active,signal:'skeleton',readySignal:0,idleFps:12}));
  render(true);await until(()=>canvas.count()===2&&preference.count()===1);
  const store=fiber._roots.get(canvas).store;invalidate=store.getState().invalidate;
  const frame=()=>{calls=[];fiber.advance(performance.now()/1000,false,store.getState());return calls.slice();};
  assert.deepEqual(frame(),['scene','post']);assert.deepEqual(frame(),['post']);
  const rt=targets[0];assert.deepEqual([rt.width,rt.height],[390,844]);
  store.getState().setDpr(1.5);await until(()=>rt.width===585);assert.equal(ratio,1.5);assert.equal(rt.height,1266);assert.deepEqual(frame(),['scene','post']);assert.deepEqual(frame(),['post']);
  store.getState().setDpr(2);await sleep(20);frame();assert.deepEqual([rt.width,rt.height],[585,1266],'offscreen quality cap stays 1.5');
  store.getState().scene.userData.anatomyRevision=1;assert.deepEqual(frame(),['scene','post']);
  store.getState().camera.position.x=.1;assert.deepEqual(frame(),['scene','post']);
  store.getState().setSize(400,800);await until(()=>rt.width===600);assert.deepEqual([rt.width,rt.height],[600,1200]);assert.deepEqual(frame(),['scene','post']);
  render(false);await until(()=>frame().length===0);assert.equal(pending.size,0);
  let hiddenDisposes=0;const hiddenDispose=()=>hiddenDisposes++;rt.addEventListener('dispose',hiddenDispose);
  store.getState().setSize(0,0);await sleep(20);assert.deepEqual(frame(),[]);assert.deepEqual([rt.width,rt.height],[600,1200]);assert.equal(hiddenDisposes,0);assert.equal(pending.size,0);
  store.getState().scene.userData.anatomyRevision=7;store.getState().camera.position.x=.25;
  render(true);await sleep(20);assert.deepEqual(frame(),[],'active before a nonzero viewport still does not draw');
  rt.removeEventListener('dispose',hiddenDispose);store.getState().setSize(844,390);await until(()=>rt.width===1266);
  assert.deepEqual(frame(),['scene','post']);assert.deepEqual([rt.width,rt.height],[1266,585]);assert.equal(store.getState().scene.userData.anatomyRevision,7);assert.equal(targets.length,1,'About reuses the existing render target');
  validImage=false;canvas.emit('webglcontextlost');assert.equal(pending.size,0);assert.deepEqual(frame(),[]);assert.equal(pending.size,0);
  canvas.emit('webglcontextrestored');assert.deepEqual(frame(),['scene','post']);assert.equal(validImage,true);assert.deepEqual(frame(),['post']);
  doc.hidden=true;doc.emit('visibilitychange');assert.equal(pending.size,0);frame();assert.equal(pending.size,0);
  doc.hidden=false;doc.emit('visibilitychange');frame();assert.equal(pending.size,1);
  preference.matches=true;preference.emit('change');frame();const uniforms=postScene.children[0].material.uniforms;assert.equal(uniforms.motion.value,0);assert.equal(uniforms.burst.value,0);assert.equal(pending.size,0);
  let targetDisposes=0,materialDisposes=0,geometryDisposes=0;rt.addEventListener('dispose',()=>targetDisposes++);postScene.children[0].material.addEventListener('dispose',()=>materialDisposes++);postScene.children[0].geometry.addEventListener('dispose',()=>geometryDisposes++);
  root.unmount();await until(()=>canvas.count()===0&&doc.count()===0&&preference.count()===0);
  assert.deepEqual([targetDisposes,materialDisposes,geometryDisposes],[1,1,1]);assert.equal(pending.size,0);
 }finally{root.unmount();await sleep(600);globalThis.setTimeout=nativeSet;globalThis.clearTimeout=nativeClear;}
});
