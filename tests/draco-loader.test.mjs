import test from 'node:test';import assert from 'node:assert/strict';import {createSharedDraco} from '../src/dracoLoader.js';
const provider=()=>{const created=[];const get=createSharedDraco({decoderPath:'./draco/',workerLimit:2,makeManager:()=>({}),makeLoader:manager=>{const decoder={manager,disposed:0,setDecoderPath(path){this.path=path;},setWorkerLimit(limit){this.limit=limit;},dispose(){this.disposed++;}};created.push(decoder);return decoder;}});return {get,created};};
test('layer changes and retries with healthy libraries reuse one bounded worker provider',()=>{
 const {get,created}=provider();const first=get();for(let i=0;i<20;i++)assert.equal(get(),first);assert.equal(created.length,1);assert.equal(first.path,'./draco/');assert.equal(first.limit,2);assert.equal(first.disposed,0);
});
test('a failed decoder initializer is discarded once and the next attempt gets a fresh one',()=>{
 const {get,created}=provider();const first=get();first.manager.onError('draco_decoder.wasm');assert.equal(first.disposed,1);const next=get();assert.notEqual(next,first);assert.equal(created.length,2);assert.equal(next.disposed,0);assert.equal(get(),next);
});
test('late failure notifications from an obsolete initializer cannot clear the replacement',()=>{
 const {get}=provider();const first=get();first.manager.onError('draco_decoder.wasm');const next=get();first.manager.onError('draco_wasm_wrapper.js');assert.equal(get(),next);assert.equal(first.disposed,1);assert.equal(next.disposed,0);
});
