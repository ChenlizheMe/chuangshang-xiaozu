import test from 'node:test';
import assert from 'node:assert/strict';
import {createViewerModule} from '../src/viewerModule.js';

test('a rejected viewer module keeps its technical cause and only reloads after manual retry',async()=>{
 const cause=new TypeError('Failed to fetch viewer chunk');let loads=0,reloads=0,resets=0;
 const viewer=createViewerModule(async()=>{loads++;throw cause;});
 await assert.rejects(viewer.load(),error=>error.code==='ANATOMY_MODULE_LOAD_FAILED'&&error.message===cause.message&&error.cause===cause);
 assert.equal(reloads,0);viewer.retry('skeleton',()=>resets++,()=>reloads++);
 assert.equal(loads,1,'retry must not import again into the already rejected lazy wrapper');
 assert.equal(reloads,1);assert.equal(resets,0);
});
test('an available viewer retries only its selected GLB resource and retains the module',async()=>{
 let loads=0,resets=0,reloads=0;const cleared=[];
 const module={default(){},clearAnatomyCache:layer=>cleared.push(layer)};
 const viewer=createViewerModule(async()=>{loads++;return module;});assert.equal(await viewer.load(),module);
 viewer.retry('muscle',()=>resets++,()=>reloads++);viewer.retry('organ',()=>resets++,()=>reloads++);
 assert.deepEqual(cleared,['muscle','organ']);assert.equal(loads,1);assert.equal(resets,2);assert.equal(reloads,0);
});
test('synchronous loader errors are classified without automatic recovery loops',async()=>{
 const viewer=createViewerModule(()=>{throw 'module unavailable';});
 await assert.rejects(viewer.load(),error=>error.code==='ANATOMY_MODULE_LOAD_FAILED'&&error.message==='module unavailable');
});
