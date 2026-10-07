import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {browser,deferred,html} from './helpers/service-worker-runtime.mjs';
const source=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const models='trauma-team-international-models-v5',legacy='trauma-team-international-shell-v10';
// Synthetic payloads test delivery/lifetime only; model decoding is tested separately.
const resources=[
 ['./anatomy/skeleton-mobile.glb?v=5','model/gltf-binary','glb-payload'],
 ['./draco/draco_decoder.wasm','application/wasm','wasm-payload'],
 ['./draco/draco_wasm_wrapper.js','application/javascript','wrapper-payload'],
 ['./draco/draco_decoder.js','application/javascript','decoder-payload']
];
const response=(mime,body)=>new Response(body,{headers:{'content-type':mime}});
const checkpoint=()=>new Promise(resolve=>setImmediate(resolve));
function clock(){const timers=new Map();let next=0;return {timers,setTimeout(fn,delay){assert.equal(delay,1500);timers.set(++next,fn);return next;},clearTimeout(id){timers.delete(id);},expire(){assert.equal(timers.size,1);for(const [id,fn] of timers){timers.delete(id);fn();}}};}
for(const [path,mime,body] of resources)for(const stage of ['open','current-match','keys','legacy-match'])test(`${path}: pending ${stage} yields to a successful online response`,async()=>{
 const timer=clock(),b=browser(source,{timerHost:timer}),gate=deferred(),entered=deferred();await b.caches.open(models);await b.caches.open(legacy);
 b.state.responses.set(b.normalize(path),response(mime,body));const block=()=>{entered.resolve();return gate.promise;};
 if(stage==='open')b.state.openHook=block;
 if(stage==='keys')b.state.keysHook=block;
 if(stage==='current-match'||stage==='legacy-match')b.state.matchHook=name=>{if(name===(stage==='current-match'?models:legacy))return block();};
 const pending=b.request(path);await entered.promise;assert.equal(b.calls.length,0);timer.expire();
 const online=await pending;assert.equal(online.status,200);assert.equal(await online.text(),body,'body may be consumed before storage resumes');assert.equal(b.calls.length,1);assert.equal(timer.timers.size,0);
 gate.resolve();await b.flush();assert.equal(b.writes.length,1);b.state.openHook=null;b.state.matchHook=null;b.state.keysHook=null;b.state.online=false;
 assert.equal(await (await b.request(path)).text(),body,'completed background write remains usable offline');assert.equal(b.calls.length,1);
});
for(const [path,mime,body] of resources)test(`${path}: fast valid cache remains offline-first without a network call`,async()=>{
 const timer=clock(),b=browser(source,{timerHost:timer});await (await b.caches.open(models)).put(path,response(mime,body));b.state.online=false;
 assert.equal(await (await b.request(path)).text(),body);assert.equal(b.calls.length,0);assert.equal(timer.timers.size,0);
});
for(const [path,mime,body] of resources)for(const failure of ['network','404','503','html'])test(`${path}: ${failure} still accepts a late valid cached copy`,async()=>{
 const timer=clock(),b=browser(source,{timerHost:timer}),gate=deferred(),entered=deferred();await (await b.caches.open(models)).put(path,response(mime,body));
 b.state.matchHook=name=>{if(name===models){entered.resolve();return gate.promise;}};
 if(failure==='network')b.state.online=false;
 else b.state.responses.set(b.normalize(path),failure==='html'?html('<html>not a decoder</html>'):new Response('temporary failure',{status:Number(failure)}));
 let delivered=false;const pending=b.request(path).then(value=>{delivered=true;return value;});await entered.promise;timer.expire();await checkpoint();assert.equal(b.calls.length,1);assert.equal(delivered,false);
 gate.resolve();const saved=await pending;assert.equal(saved.status,200);assert.equal(await saved.text(),body);assert.equal(timer.timers.size,0);assert.equal(b.writes.length,1,'failed network response does not replace the good copy');
});
for(const [path] of resources)test(`${path}: HTML is never supplied as a model or decoder when no valid cache exists`,async()=>{
 const timer=clock(),b=browser(source,{timerHost:timer});await (await b.caches.open(models)).put(path,html('<html>bad cached shell</html>'));b.state.responses.set(b.normalize(path),html('<html>bad network shell</html>'));
 const result=await b.request(path);assert.equal(result.status,502);assert.equal(await result.text(),'Invalid anatomy resource');assert.equal(timer.timers.size,0);assert.equal(b.writes.length,1);
});
