// Actual React/R3F reconciler and event routing with synthetic geometry and a
// mocked GL renderer. This verifies lifecycle/raycast work, not browser FPS.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const repo=new URL('../',import.meta.url).pathname;
if(!globalThis.navigator)globalThis.navigator={};
globalThis.window={matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),devicePixelRatio:1};
globalThis.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),16);globalThis.cancelAnimationFrame=clearTimeout;
const React=require('react'),THREE=require('three'),fiber=require('@react-three/fiber');fiber.extend(THREE);
const {build}=require('esbuild');let source=fs.readFileSync(new URL('../src/AnatomyViewer.jsx',import.meta.url),'utf8');
source=source.replace("import {Canvas,useLoader,useThree} from '@react-three/fiber';","import {Canvas,useThree} from '@react-three/fiber'; const useLoader=Object.assign((Loader,url)=>globalThis.__loadTestModel(url),{preload:()=>{},clear:()=>{}});").replace("import {Html} from '@react-three/drei';","const Html=()=>null;").replace('function Model(', 'export function Model(');
const compiled=(await build({stdin:{contents:source,sourcefile:repo+'src/AnatomyViewer.jsx',resolveDir:repo+'src',loader:'jsx'},bundle:true,platform:'node',format:'cjs',external:['react','@react-three/fiber'],plugins:[{name:'share-three-instance',setup(build){build.onResolve({filter:/^three$/},args=>({path:args.path,external:true}));}} ],write:false})).outputFiles[0].text;
const module={exports:{}};new Function('module','exports','require',compiled)(module,module.exports,require);const {Model}=module.exports;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const until=async predicate=>{const deadline=performance.now()+4000;while(!predicate()){assert.ok(performance.now()<deadline,'React lifecycle transition timed out');await sleep(20);}};
const asset=name=>{const scene=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(.25,.5,.15),new THREE.MeshStandardMaterial());mesh.name=name;mesh.position.set(0,.857,.005);scene.add(mesh);return {scene,mesh,parser:{associations:new Map(),json:{nodes:[]}}};};
test('hidden Suspense models cannot be picked and one visible branch raycasts only once',async()=>{
 const skeleton=asset('Femur.l'),muscle=asset('Rectus femoris muscle.r');let resolve,ready=false;const pending=new Promise(r=>{resolve=r;});
 globalThis.__loadTestModel=url=>{if(/muscl/.test(url)){if(!ready)throw pending;return muscle;}return skeleton;};
 const noop=()=>{};const canvas={addEventListener:noop,removeEventListener:noop,style:{},getBoundingClientRect:()=>({width:390,height:844,left:0,top:0})};
 const gl={render:noop,setPixelRatio:noop,setSize:noop,domElement:canvas,xr:{addEventListener:noop,removeEventListener:noop},shadowMap:{},capabilities:{isWebGL2:true}};
 const root=fiber.createRoot(canvas);root.configure({gl,events:fiber.events,size:{width:390,height:844,top:0,left:0},frameloop:'never',camera:{position:[0,0,3.8],fov:38}});
 const approximate={current:null},selected=[],choices=[];
 const render=layer=>root.render(React.createElement(React.Suspense,{fallback:React.createElement('group',{name:'loading'})},React.createElement(Model,{layer,selectedParts:selected,onPart:p=>choices.push({layer,part:p.part}),registerApproximatePick:approximate})));
 const event={offsetX:195,offsetY:422,clientX:195,clientY:422,pointerId:1,button:0,target:canvas};
 try{
  render('skeleton');await until(()=>approximate.current);const state=fiber._roots.get(canvas).store.getState();state.scene.updateMatrixWorld(true);state.camera.updateMatrixWorld(true);
  assert.equal(state.internal.interaction.length,1);let rays=0;const raycast=skeleton.mesh.raycast;skeleton.mesh.raycast=function(...args){rays++;return raycast.apply(this,args);};
  state.events.handlers.onPointerMove(event);assert.equal(rays,1);
  state.events.handlers.onPointerDown(event);state.events.handlers.onPointerUp(event);assert.deepEqual(choices.splice(0),[{layer:'skeleton',part:'Femur.l'}]);
  const staleApproximate=approximate.current;state.events.handlers.onPointerDown(event);
  render('muscle');await until(()=>state.scene.children.some(o=>o.name==='loading'));state.scene.updateMatrixWorld(true);
  assert.equal(approximate.current,null);assert.equal(skeleton.mesh.visible,true,'mesh visibility alone is not a sufficient guard');
  state.events.handlers.onPointerUp(event);state.events.handlers.onPointerDown(event);state.events.handlers.onPointerUp(event);staleApproximate(event);assert.deepEqual(choices,[]);
  ready=true;resolve();await until(()=>approximate.current&&approximate.current!==staleApproximate);state.scene.updateMatrixWorld(true);
  staleApproximate(event);assert.deepEqual(choices,[],'a replaced cached root stays inactive');
  state.events.handlers.onPointerDown(event);state.events.handlers.onPointerUp(event);assert.deepEqual(choices.splice(0),[{layer:'muscle',part:'Rectus femoris muscle.r'}]);assert.equal(state.internal.interaction.length,1);
 }finally{root.unmount();await sleep(600);assert.equal(approximate.current,null);}
});
