import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {browser,js,css,deferred} from './helpers/service-worker-runtime.mjs';
const source=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const current='trauma-team-international-shell-v11-development';
const previous='trauma-team-international-shell-v11-previous';
function clock(){
 const timers=new Map();let next=0;
 return {timers,setTimeout(fn,delay){assert.equal(delay,1500);timers.set(++next,fn);return next;},clearTimeout(id){timers.delete(id);},
  expire(){assert.equal(timers.size,1);for(const [id,fn] of timers){timers.delete(id);fn();}}
 };
}
const checkpoint=()=>new Promise(resolve=>setImmediate(resolve));
for(const stage of ['open','current-match','keys','previous-match'])test(`pending ${stage} cannot block a successful online script`,async()=>{
 const timer=clock(),b=browser(source,{timerHost:timer}),gate=deferred(),entered=deferred();
 await b.caches.open(current);await b.caches.open(previous);
 b.state.responses.set('/assets/current.js',js('export const fromNetwork=true'));
 const block=()=>{entered.resolve();return gate.promise;};
 if(stage==='open')b.state.openHook=block;
 if(stage==='current-match'||stage==='previous-match')b.state.matchHook=name=>{if(name===(stage==='current-match'?current:previous))return block();};
 if(stage==='keys')b.state.keysHook=block;
 const pending=b.request('./assets/current.js');await entered.promise;
 assert.equal(b.calls.length,0);timer.expire();
 const response=await pending;assert.equal(response.status,200);assert.match(await response.text(),/fromNetwork/);assert.equal(b.calls.length,1);
 assert.equal(timer.timers.size,0);gate.resolve();await b.flush();
});
test('runtime lookup skips model storage and reaches a later complete shell without waiting',async()=>{
 const timer=clock(),b=browser(source,{timerHost:timer}),models='trauma-team-international-models-v5';
 await b.caches.open(current);await b.caches.open(models);
 await (await b.caches.open(previous)).put('./assets/new.js',js('export const retained=true'));
 b.state.matchHook=name=>{assert.notEqual(name,models,'JS lookup must not queue behind model writes');};
 b.state.online=false;const response=await b.request('./assets/new.js');assert.match(await response.text(),/retained/);
 assert.equal(b.calls.length,0);assert.equal(timer.timers.size,0);
});
test('stylesheet reads have the same online progress guarantee and MIME checks',async()=>{
 const timer=clock(),b=browser(source,{timerHost:timer}),gate=deferred(),entered=deferred();
 b.state.responses.set('/assets/theme.css',css('body{color:red}'));
 b.state.openHook=()=>{entered.resolve();return gate.promise;};
 const pending=b.request('./assets/theme.css');await entered.promise;timer.expire();
 const response=await pending;assert.equal(response.headers.get('content-type'),'text/css');assert.match(await response.text(),/color:red/);
 gate.resolve();await b.flush();assert.equal(timer.timers.size,0);
});
test('an offline request can still use a valid cache response arriving after the read budget',async()=>{
 const timer=clock(),b=browser(source,{timerHost:timer}),gate=deferred(),entered=deferred();
 await (await b.caches.open(current)).put('./assets/slow.js',js('export const offline=true'));
 b.state.online=false;b.state.matchHook=()=>{entered.resolve();return gate.promise;};
 let delivered=false;const pending=b.request('./assets/slow.js').then(response=>{delivered=true;return response;});
 await entered.promise;timer.expire();await checkpoint();assert.equal(delivered,false);assert.equal(b.calls.length,1);
 gate.resolve();const response=await pending;assert.equal(response.status,200);assert.match(await response.text(),/offline/);assert.equal(timer.timers.size,0);
});
test('successful cache hits and rejected reads clear the scheduled deadline',async()=>{
 const timer=clock(),b=browser(source,{timerHost:timer});await(await b.caches.open(current)).put('./assets/hit.js',js());
 assert.equal((await b.request('./assets/hit.js')).status,200);assert.equal(b.calls.length,0);assert.equal(timer.timers.size,0);
 b.state.unavailable=true;b.state.responses.set('/assets/network.js',js());assert.equal((await b.request('./assets/network.js')).status,200);
 assert.equal(timer.timers.size,0);await b.flush();
});
for(const [status,mime] of [[503,'text/plain'],[404,'text/plain'],[200,'text/html']])test(`a late valid copy survives network status ${status} with ${mime}`,async()=>{
 const timer=clock(),b=browser(source,{timerHost:timer}),gate=deferred(),entered=deferred();
 await (await b.caches.open(current)).put('./assets/slow.js',js('export const retained=true'));
 b.state.responses.set('/assets/slow.js',new Response('upstream failed',{status,headers:{'content-type':mime}}));
 b.state.matchHook=()=>{entered.resolve();return gate.promise;};
 let delivered=false;const pending=b.request('./assets/slow.js').then(response=>{delivered=true;return response;});
 await entered.promise;timer.expire();await checkpoint();assert.equal(delivered,false);
 gate.resolve();const response=await pending;assert.equal(response.status,200);assert.match(await response.text(),/retained/);assert.equal(timer.timers.size,0);
});
