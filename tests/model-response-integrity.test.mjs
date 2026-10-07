import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {browser,deferred} from './helpers/service-worker-runtime.mjs';

const source=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const prefix='trauma-team-international-',models=prefix+'models-v5';
const bytes=Buffer.from('complete model or decoder bytes');
const hash=body=>createHash('sha256').update(body).digest('hex');
const binary=body=>new Response(body,{headers:{'content-type':'application/octet-stream'}});
const versioned=(name,body=bytes)=>name.replace(/\.(glb|wasm|js)$/,`.${hash(body)}.$1`)+`?sha256=${hash(body)}`+(name.endsWith('.glb')?'&v=5':'');
const nextTurn=()=>new Promise(resolve=>setImmediate(resolve));
async function until(predicate){for(let i=0;i<100&&!predicate();i++)await new Promise(resolve=>setTimeout(resolve,1));assert.ok(predicate(),'expected asynchronous checkpoint');}
function controlledTimers(){
 const pending=new Map();let id=0;
 return {pending,setTimeout(fn,ms){pending.set(++id,{fn,ms});return id;},clearTimeout(id){pending.delete(id);},
  expire(){const [id,{fn,ms}]=pending.entries().next().value;assert.equal(ms,1500);pending.delete(id);fn();}};
}

for(const scope of ['/','/project/'])for(const name of ['./anatomy/model.glb','./draco/draco_wasm_wrapper.js','./draco/draco_decoder.js','./draco/draco_decoder.wasm']){
 test(`hashed resource rejects wrong successful bytes and recovers at its exact URL: ${scope}${name}`,async()=>{
  const b=browser(source,{scope}),url=versioned(name),bad=Buffer.from(bytes);bad[0]^=1;
  b.state.responses.set(b.normalize(url),binary(bad));
  assert.equal((await b.request(url)).status,502);await b.flush();assert.equal(b.writes.length,0);
  b.state.responses.set(b.normalize(url),binary(bytes));
  assert.deepEqual(Buffer.from(await (await b.request(url)).arrayBuffer()),bytes);await b.flush();assert.equal(b.writes.length,1);
  b.state.online=false;
  assert.deepEqual(Buffer.from(await (await b.request(url)).arrayBuffer()),bytes);assert.equal(b.calls.length,2);
 });
}

test('bad current and older copies are skipped while a healthy exact-key offline copy is retained',async()=>{
 const b=browser(source),url=versioned('./anatomy/model.glb');
 const current=await b.caches.open(models),badOld=await b.caches.open(prefix+'shell-v9'),goodOld=await b.caches.open(prefix+'shell-v10');
 await current.put(url,binary('bad current'));await badOld.put(url,binary('bad older'));await goodOld.put(url,binary(bytes));
 b.state.online=false;const writes=b.writes.length;
 assert.deepEqual(Buffer.from(await (await b.request(url)).arrayBuffer()),bytes);
 assert.equal(b.calls.length,0);assert.equal(b.writes.length,writes);assert.deepEqual(b.deletes,[]);
 assert.equal(await (await current.match(url)).text(),'bad current','validation does not delete other downloads or race cache writes');
});

test('a good different version cannot satisfy an older hash request or poison its key',async()=>{
 const b=browser(source),old=versioned('./anatomy/model.glb'),newBytes=Buffer.from('new model version'),next=versioned('./anatomy/model.glb',newBytes);
 await (await b.caches.open(models)).put(next,binary(newBytes));
 b.state.responses.set(b.normalize(old),binary(newBytes));
 assert.equal((await b.request(old)).status,502);await b.flush();
 assert.equal(await (await b.caches.open(models)).match(old),undefined);
 b.state.online=false;assert.deepEqual(Buffer.from(await (await b.request(next)).arrayBuffer()),newBytes);
});

test('only the precise content-addressed filename triggers hashing; query-only and legacy names keep compatibility',async()=>{
 let digests=0;const cryptoHost={subtle:{digest(...args){digests++;return webcrypto.subtle.digest(...args);}}};
 const b=browser(source,{cryptoHost}),h=hash(bytes);
 const legacy=[`./anatomy/model.glb?sha256=${h}`,`./anatomy/model.${h.slice(1)}.glb`,`./anatomy/model.0${h}.glb`,
  `./anatomy/model.${h.toUpperCase()}.glb`,`./anatomy/model.${h}.backup.glb`,`./draco/${h}/decoder.wasm`];
 for(const url of legacy){b.state.responses.set(b.normalize(url),binary(bytes));assert.equal((await b.request(url)).status,200);}
 assert.equal(digests,0);
 const url=versioned('./anatomy/model.glb');b.state.responses.set(b.normalize(url),binary(bytes));
 assert.equal((await b.request(url)).status,200);assert.equal(digests,1);
 await b.flush();
});

test('hash verification waits for the complete stream and leaves the delivered response readable',async()=>{
 const b=browser(source),url=versioned('./anatomy/model.glb');let controller,settled=false;
 const stream=new ReadableStream({start(value){controller=value;}});
 b.state.responses.set(b.normalize(url),binary(stream));
 const pending=b.request(url).then(response=>{settled=true;return response;});
 await until(()=>b.calls.length===1);controller.enqueue(bytes.subarray(0,7));await nextTurn();assert.equal(settled,false);
 controller.enqueue(bytes.subarray(7));controller.close();
 const response=await pending;assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
 await b.flush();assert.equal(b.writes.length,1);
});

test('an upstream body failure is not cached and a later valid response can recover',async()=>{
 const b=browser(source),url=versioned('./anatomy/model.glb');let controller;
 b.state.responses.set(b.normalize(url),binary(new ReadableStream({start(value){controller=value;}})));
 const pending=b.request(url);await until(()=>b.calls.length===1);controller.enqueue(bytes.subarray(0,5));controller.error(new TypeError('Body transfer aborted'));
 assert.equal((await pending).status,502);await b.flush();assert.equal(b.writes.length,0);
 b.state.responses.set(b.normalize(url),binary(bytes));assert.deepEqual(Buffer.from(await (await b.request(url)).arrayBuffer()),bytes);await b.flush();
});

for(const cryptoHost of [null,{}, {subtle:{digest:async()=>{throw new Error('Digest unavailable');}}}])test('unavailable or rejected digest fails safely and does not erase a healthy offline copy',async()=>{
 const b=browser(source,{cryptoHost}),url=versioned('./anatomy/model.glb');
 await (await b.caches.open(models)).put(url,binary(bytes));const writes=b.writes.length;
 b.state.responses.set(b.normalize(url),binary(bytes));assert.equal((await b.request(url)).status,502);await b.flush();
 assert.equal(b.writes.length,writes);assert.deepEqual(b.deletes,[]);
 const restored=browser(source,{stores:b.stores});restored.state.online=false;
 assert.deepEqual(Buffer.from(await (await restored.request(url)).arrayBuffer()),bytes);
});

test('cache digest may finish after the read budget without replacing the healthy network response',async()=>{
 const timerHost=controlledTimers(),gate=deferred();let digests=0,delayedFinished=false;
 const cryptoHost={subtle:{async digest(...args){const delayed=++digests===1;if(delayed)await gate.promise;const result=await webcrypto.subtle.digest(...args);if(delayed)delayedFinished=true;return result;}}};
 const b=browser(source,{timerHost,cryptoHost}),url=versioned('./anatomy/model.glb');
 await (await b.caches.open(models)).put(url,binary('bad cache'));
 b.state.responses.set(b.normalize(url),binary(bytes));const pending=b.request(url);
 await until(()=>digests===1&&timerHost.pending.size===1);timerHost.expire();
 const response=await pending;assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);await b.flush();
 gate.resolve();await until(()=>delayedFinished);await nextTurn();assert.equal(digests,2);
 assert.deepEqual(Buffer.from(await (await (await b.caches.open(models)).match(url)).arrayBuffer()),bytes);
 assert.equal(b.calls.length,1);assert.equal(timerHost.pending.size,0);
});

test('wrong hashed network bytes become a bounded retryable error while optional storage stays pending',async()=>{
 const timerHost=controlledTimers(),gate=deferred(),b=browser(source,{timerHost}),url=versioned('./anatomy/model.glb');
 b.state.openHook=()=>gate.promise;b.state.responses.set(b.normalize(url),binary('wrong complete body'));
 const pending=b.request(url);
 await until(()=>timerHost.pending.size===1);timerHost.expire();
 await until(()=>b.calls.length===1&&timerHost.pending.size===1);timerHost.expire();
 assert.equal((await pending).status,502);assert.equal(b.writes.length,0);
 gate.resolve();await nextTurn();await b.flush();assert.equal(b.writes.length,0);assert.equal(timerHost.pending.size,0);
});

test('activation migrates a validated older copy instead of keeping corrupted current bytes',async()=>{
 const b=browser(source),url=versioned('./anatomy/model.glb');
 await (await b.caches.open(prefix+'shell-v7')).put(url,binary(bytes));
 await b.caches.open(prefix+'shell-v11-development');
 await (await b.caches.open(models)).put(url,binary('bad current'));
 await b.lifecycle('activate');b.state.online=false;
 assert.deepEqual(Buffer.from(await (await b.request(url)).arrayBuffer()),bytes);assert.equal(b.calls.length,0);
});

test('activation digest completing after maintenance expiry cannot write or retire caches',async()=>{
 const timerHost=controlledTimers(),gate=deferred();let calls=0,finished=false;
 const cryptoHost={subtle:{async digest(...args){calls++;await gate.promise;const result=await webcrypto.subtle.digest(...args);finished=true;return result;}}};
 const b=browser(source,{timerHost,cryptoHost}),url=versioned('./anatomy/model.glb');
 await (await b.caches.open(prefix+'shell-v7')).put(url,binary(bytes));
 await b.caches.open(prefix+'shell-v11-development');const writes=b.writes.length;
 const activation=b.lifecycle('activate');await until(()=>calls===1&&timerHost.pending.size===1);timerHost.expire();await activation;
 assert.equal(b.workerState.claimed,true);gate.resolve();await until(()=>finished);await nextTurn();
 assert.equal(b.writes.length,writes);assert.deepEqual(b.deletes,[]);
});
