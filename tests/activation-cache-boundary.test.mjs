import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {browser,js,html} from './helpers/service-worker-runtime.mjs';
const source=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const prefix='trauma-team-international-',current=prefix+'shell-v11-development';
for(const futureComplete of [false,true])test(`missing current generation preserves a ${futureComplete?'complete':'staging'} newer shell and every existing model`,async()=>{
 const b=browser(source),old=await b.caches.open(prefix+'shell-v11-old');
 await old.put('./offline-ready',new Response('ready'));await old.put('./index.html',html('old complete page'));await old.put('./assets/old.js',js('export const old=true'));
 const legacy=await b.caches.open(prefix+'shell-v9');await legacy.put('./anatomy/skeleton-mobile.glb?v=5',new Response('old GLB',{headers:{'content-type':'model/gltf-binary'}}));
 await b.caches.open(current);
 const future=await b.caches.open(prefix+'shell-v11-future');await future.put('./assets/future.js',js('export const future=true'));
 if(futureComplete){await future.put('./offline-ready',new Response('ready'));await future.put('./index.html',html('future complete page'));}
 const models=await b.caches.open(prefix+'models-v5');await models.put('./draco/draco_decoder.wasm',new Response('decoder',{headers:{'content-type':'application/wasm'}}));
 await b.caches.delete(current);b.deletes.length=0;b.writes.length=0;
 const names=await b.caches.keys(),snapshot=await Promise.all(names.map(async name=>[name,await Promise.all([...(b.stores.get(name)||[])].map(async([url,r])=>[url,await r.clone().text()]))]));
 await b.lifecycle('activate');assert.equal(b.workerState.claimed,true);assert.deepEqual(await b.caches.keys(),names);assert.deepEqual(b.deletes,[]);assert.deepEqual(b.writes,[]);assert.equal(b.calls.length,0);
 const after=await Promise.all(names.map(async name=>[name,await Promise.all([...(b.stores.get(name)||[])].map(async([url,r])=>[url,await r.clone().text()]))]));assert.deepEqual(after,snapshot);
});
test('an empty cache catalog does not prevent activation from claiming clients',async()=>{
 const b=browser(source);await b.lifecycle('activate');assert.equal(b.workerState.claimed,true);assert.deepEqual(await b.caches.keys(),[]);assert.equal(b.calls.length,0);
});
