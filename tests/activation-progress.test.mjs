import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {browser,html,js,css,deferred} from './helpers/service-worker-runtime.mjs';
const source=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const prefix='trauma-team-international-';
const names={legacy:prefix+'shell-v7',previous:prefix+'shell-v11-previous',obsolete:prefix+'models-v4',models:prefix+'models-v5',current:prefix+'shell-v11-development',future:prefix+'shell-v11-future'};
const model='./anatomy/skeleton-mobile.glb?v=5',existingModel='./anatomy/organs-mobile.glb?v=5';
const binary=body=>new Response(body,{headers:{'content-type':'model/gltf-binary'}});
const checkpoint=()=>new Promise(resolve=>setImmediate(resolve));
function clock(){const timers=new Map();let sequence=0;return {timers,setTimeout(fn,delay){assert.equal(delay,1500);timers.set(++sequence,fn);return sequence;},clearTimeout(id){timers.delete(id);},expire(){assert.equal(timers.size,1,'one total maintenance deadline');for(const[id,fn]of timers){timers.delete(id);fn();}}};}
async function fixture(){
 const timer=clock(),b=browser(source,{timerHost:timer});
 await(await b.caches.open(names.legacy)).put(model,binary('legacy v5'));
 const old=await b.caches.open(names.previous);
 await old.put('./index.html',html('complete previous page'));
 for(const path of ['./assets/old.js','./assets/old-lazy.js'])await old.put(path,js());
 await old.put('./assets/old.css',css());await old.put('./offline-ready',new Response('previous'));
 await(await b.caches.open(names.obsolete)).put('./old.bin',new Response('obsolete'));
 await(await b.caches.open(names.models)).put(existingModel,binary('existing v5'));
 b.state.defaultResponse=url=>url.endsWith('/index.html')?html('current complete page'):new Response('static shell asset');
 await b.lifecycle('install');
 await(await b.caches.open(names.future)).put('./assets/future.js',js('future staging'));
 await(await b.caches.open('unrelated-cache')).put('./unrelated',new Response('unrelated'));
 b.calls.length=0;b.writes.length=0;b.deletes.length=0;
 return {b,timer};
}
const storageStages=['storage-keys','models-open','migration-open','migration-keys','migration-target-match','migration-source-match','migration-put','retention-open','retention-ready','retention-keys','retention-runtime','delete'];
function inject(b,stage,effect){
 const entered=deferred(),trace=[];let fired=false,previousOpens=0,previousKeys=0;
 const hit=(point,detail)=>{trace.push([point,detail]);if(point===stage&&!fired){fired=true;entered.resolve();return effect();}};
 b.state.keysHook=()=>hit('storage-keys');
 b.state.openHook=name=>{if(name===names.previous)previousOpens++;return hit(name===names.models?'models-open':name===names.legacy?'migration-open':name===names.previous&&previousOpens===2?'retention-open':'other-open',name);};
 b.state.cacheKeysHook=name=>{if(name===names.previous)previousKeys++;return hit(name===names.legacy?'migration-keys':name===names.previous&&previousKeys===2?'retention-keys':'other-keys',name);};
 b.state.matchHook=(name,url)=>hit(name===names.models&&url===b.normalize(model)?'migration-target-match':name===names.legacy&&url===b.normalize(model)?'migration-source-match':name===names.previous&&url.endsWith('/offline-ready')?'retention-ready':name===names.previous&&url.endsWith('/assets/old.js')?'retention-runtime':'other-match',[name,url]);
 b.state.putHook=(name,url)=>hit(name===names.models&&url===b.normalize(model)?'migration-put':'other-put',[name,url]);
 b.state.deleteHook=name=>hit(name===names.legacy?'delete':'other-delete',name);
 b.state.claimHook=()=>hit('claim');
 return {entered,trace};
}
function clearHooks(b){for(const key of ['keysHook','openHook','cacheKeysHook','matchHook','putHook','deleteHook','claimHook'])b.state[key]=null;}
async function assertCopies(b){
 clearHooks(b);b.state.online=false;
 for(const path of ['./index.html','./offline-ready','./assets/old.js','./assets/old-lazy.js','./assets/old.css'])assert.ok(b.stores.get(names.previous)?.has(b.normalize(path)),`complete previous shell retains ${path}`);
 assert.ok(b.stores.get(names.future)?.has(b.normalize('./assets/future.js')));
 assert.ok(b.stores.get('unrelated-cache')?.has(b.normalize('./unrelated')));
 assert.equal(await(await b.request(model)).text(),'legacy v5');assert.equal(await(await b.request(existingModel)).text(),'existing v5');
 assert.equal((await b.request('./assets/old-lazy.js')).status,200);
 assert.equal(await(await b.request('./','navigate')).text(),'current complete page');
}
for(const stage of storageStages)test(`activation deadline releases pending ${stage}; late completion starts no more maintenance`,async()=>{
 const {b,timer}=await fixture(),gate=deferred(),{entered,trace}=inject(b,stage,()=>gate.promise);
 let settled=false;const activation=b.lifecycle('activate').then(()=>{settled=true;});
 await entered.promise;await checkpoint();assert.equal(settled,false);assert.equal(b.workerState.claimed,true);
 timer.expire();await activation;assert.equal(timer.timers.size,0);
 const traceAtExpiry=trace.slice(),deletesAtExpiry=[...b.deletes];
 // An issued deletion may finish later, so its migration must already be safe.
 if(stage==='delete'){assert.ok(b.stores.get(names.models)?.has(b.normalize(model)));assert.deepEqual(deletesAtExpiry,[]);}
 else assert.deepEqual(deletesAtExpiry,[]);
 gate.resolve();await checkpoint();assert.deepEqual(trace,traceAtExpiry,'no later storage API call after expiration');
 assert.deepEqual(b.deletes,stage==='delete'?[names.legacy]:[],'only an already-issued deletion may finish');
 if(stage==='migration-put'){assert.ok(b.stores.has(names.legacy));assert.ok(b.stores.get(names.models)?.has(b.normalize(model)),'late put may safely add a copy');}
 if(stage==='delete')assert.ok(b.stores.has(names.obsolete),'next deletion is never issued');
 await assertCopies(b);
});
for(const stage of ['storage-keys','models-open','retention-open','retention-ready','retention-keys','retention-runtime'])test(`rejected ${stage} still attempts claim and clears the maintenance timer`,async()=>{
 const {b,timer}=await fixture();inject(b,stage,()=>Promise.reject(new Error('Injected storage rejection')));
 await b.lifecycle('activate');assert.equal(b.workerState.claimed,true);assert.equal(timer.timers.size,0);assert.deepEqual(b.deletes,[]);await assertCopies(b);
});
for(const stage of ['migration-put','delete'])test(`late ${stage} rejection after expiration is handled and stops cleanup`,async()=>{
 const {b,timer}=await fixture(),gate=deferred(),{entered,trace}=inject(b,stage,()=>gate.promise);
 const activation=b.lifecycle('activate');await entered.promise;timer.expire();await activation;const before=trace.slice();
 gate.reject(new Error('Late failure'));await checkpoint();assert.deepEqual(trace,before);assert.deepEqual(b.deletes,[]);assert.ok(b.stores.has(names.legacy));await assertCopies(b);
});
test('fast maintenance migrates v5, retains the complete previous shell and future staging, and clears its timer',async()=>{
 const {b,timer}=await fixture();await b.lifecycle('activate');assert.equal(b.workerState.claimed,true);assert.equal(timer.timers.size,0);assert.deepEqual(b.deletes,[names.legacy,names.obsolete]);await assertCopies(b);
});
test('a read that settles before the deadline finishes normal maintenance',async()=>{
 const {b,timer}=await fixture(),gate=deferred(),{entered}=inject(b,'storage-keys',()=>gate.promise);
 const activation=b.lifecycle('activate');await entered.promise;gate.resolve();await activation;assert.equal(timer.timers.size,0);assert.deepEqual(b.deletes,[names.legacy,names.obsolete]);await assertCopies(b);
});
test('claim rejection is handled separately from successful cache maintenance',async()=>{
 const {b,timer}=await fixture();inject(b,'claim',()=>Promise.reject(new Error('Claim failed')));await b.lifecycle('activate');assert.equal(b.workerState.claimed,false);assert.equal(timer.timers.size,0);assert.deepEqual(b.deletes,[names.legacy,names.obsolete]);await assertCopies(b);
});
test('the storage budget does not pretend to settle a pending clients.claim',async()=>{
 const {b,timer}=await fixture(),storageGate=deferred(),claimGate=deferred(),storageEntered=deferred(),claimEntered=deferred();
 b.state.keysHook=()=>{storageEntered.resolve();return storageGate.promise;};b.state.claimHook=()=>{claimEntered.resolve();return claimGate.promise;};
 let settled=false;const activation=b.lifecycle('activate').then(()=>{settled=true;});
 await Promise.all([storageEntered.promise,claimEntered.promise]);timer.expire();await checkpoint();assert.equal(settled,false);assert.equal(b.workerState.claimed,false);
 claimGate.resolve();await activation;assert.equal(b.workerState.claimed,true);assert.equal(timer.timers.size,0);assert.deepEqual(b.deletes,[]);
 storageGate.resolve();await checkpoint();assert.deepEqual(b.deletes,[]);await assertCopies(b);
});
