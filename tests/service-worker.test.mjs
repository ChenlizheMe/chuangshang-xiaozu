import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const origin='https://traumateam.cn';
const model='/anatomy/skeleton-mobile.glb?v=5';
const binary=new Uint8Array([0x67,0x6c,0x54,0x46,2,0,0,0]);
const glb=()=>new Response(binary,{headers:{'content-type':'application/octet-stream'}});

// Emulate the Cache API's response cloning and URL keys, with an independently
// controlled network. Scenarios exercise an actual worker upgrade and outage.
function browserCache(){
 const stores=new Map(),listeners={},calls=[];
 const key=request=>new URL(typeof request==='string'?request:request.url,origin+'/').href;
 const state={online:true,invalid:false,unavailable:false,quotaExceeded:false,status:200};
 const fetch=async request=>{
  const url=key(request);calls.push(url);
  if(!state.online)throw new TypeError('Network unavailable');
  return url.includes('.glb')&&!state.invalid?glb():new Response('<html>App shell</html>',{status:state.status,headers:{'content-type':'text/html'}});
 };
 const caches={
  async open(name){
   if(state.unavailable)throw new Error('Storage unavailable');
   if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);
   return {match:async request=>store.get(key(request))?.clone(),put:async(request,response)=>{if(state.quotaExceeded)throw new Error('Storage full');store.set(key(request),response.clone());},keys:async()=>[...store.keys()].map(url=>new Request(url)),addAll:async paths=>{for(const path of paths)store.set(key(path),await fetch(path));}};
  },
  keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name),
  async match(request){if(state.unavailable)throw new Error('Storage unavailable');for(const store of stores.values()){const response=store.get(key(request));if(response)return response.clone();}}
 };
 const self={location:{origin},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(type,handler)=>{listeners[type]=handler;}};
 vm.runInNewContext(source,{self,caches,fetch,URL,Response});
 const lifecycle=async type=>{let pending;listeners[type]({waitUntil:promise=>{pending=promise;}});await pending;};
 const request=async(path,mode='cors')=>{let pending;listeners.fetch({request:{url:key(path),mode,method:'GET'},respondWith:promise=>{pending=promise;}});return pending;};
 return {caches,state,calls,lifecycle,request};
}

test('a UI release preserves earlier model and decoder downloads',async()=>{
 const browser=browserCache(),old=await browser.caches.open('trauma-team-international-shell-v7');
 await old.put(model,glb());await old.put('/draco/draco_wasm_wrapper.js',new Response('decoder',{headers:{'content-type':'application/javascript'}}));
 await browser.caches.open('unrelated-feature-cache');
 await browser.lifecycle('activate');browser.state.online=false;
 const response=await browser.request(model);assert.equal(response.status,200);assert.deepEqual(new Uint8Array(await response.arrayBuffer()),binary);
 assert.equal(await (await browser.request('/draco/draco_wasm_wrapper.js')).text(),'decoder');assert.equal(browser.calls.length,0);
 assert.ok(!(await browser.caches.keys()).includes('trauma-team-international-shell-v7'));
 assert.ok((await browser.caches.keys()).includes('unrelated-feature-cache'));
});

test('an existing independent model cache survives subsequent UI upgrades',async()=>{
 const browser=browserCache(),models=await browser.caches.open('trauma-team-international-models-v5');
 await models.put(model,glb());await browser.caches.open('trauma-team-international-shell-v7');
 await browser.lifecycle('activate');browser.state.online=false;
 assert.equal((await browser.request(model)).status,200);assert.equal(browser.calls.length,0);
});

test('a downloaded model is reused on reload and offline',async()=>{
 const browser=browserCache();await browser.request(model);await browser.request(model);browser.state.online=false;
 const response=await browser.request(model);assert.equal(response.status,200);assert.equal(browser.calls.length,1);
});

test('an uncached model fails as a resource rather than receiving offline HTML',async()=>{
 const browser=browserCache();await browser.lifecycle('install');await browser.lifecycle('activate');browser.state.online=false;
 const page=await browser.request('/', 'navigate');assert.match(await page.text(),/App shell/);
 const response=await browser.request('/anatomy/organs-mobile.glb?v=5');assert.equal(response.status,503);assert.ok(!/html|App shell/.test(await response.text()));
});

test('HTML responses and old geometry versions are not migrated as current models',async()=>{
 const browser=browserCache(),old=await browser.caches.open('trauma-team-international-shell-v7');
 await old.put(model,new Response('<html>Wrong fallback</html>',{headers:{'content-type':'text/html'}}));
 await old.put('/anatomy/organs-mobile.glb?v=4',glb());await browser.lifecycle('activate');browser.state.online=false;
 assert.equal((await browser.request(model)).status,503);assert.equal((await browser.request('/anatomy/organs-mobile.glb?v=5')).status,503);
});

test('an upstream HTML fallback cannot poison a binary resource cache',async()=>{
 const browser=browserCache();browser.state.invalid=true;assert.equal((await browser.request(model)).status,502);
 browser.state.invalid=false;assert.equal((await browser.request(model)).status,200);assert.equal(browser.calls.length,2);
});

test('unavailable cache storage does not prevent an online model from loading',async()=>{
 const browser=browserCache();browser.state.unavailable=true;
 const response=await browser.request(model);assert.equal(response.status,200);assert.deepEqual(new Uint8Array(await response.arrayBuffer()),binary);
});

test('a full storage quota does not discard a successful model download',async()=>{
 const browser=browserCache();browser.state.quotaExceeded=true;
 const response=await browser.request(model);assert.equal(response.status,200);assert.deepEqual(new Uint8Array(await response.arrayBuffer()),binary);
});


test('failed navigation responses do not replace the last usable offline page',async()=>{
 const browser=browserCache();await browser.lifecycle('install');
 browser.state.status=503;assert.equal((await browser.request('/', 'navigate')).status,503);
 await new Promise(resolve=>setImmediate(resolve));browser.state.online=false;
 const offline=await browser.request('/', 'navigate');assert.equal(offline.status,200);
});

test('an uncached script or stylesheet never receives the offline HTML shell',async()=>{
 const browser=browserCache();await browser.lifecycle('install');browser.state.online=false;
 for(const path of ['/assets/lazy-missing.js','/assets/missing.css']){
  const response=await browser.request(path);assert.equal(response.status,503);
  assert.doesNotMatch(response.headers.get('content-type')||'',/html/);
  assert.doesNotMatch(await response.text(),/App shell/);
 }
});

test('cache storage failures do not prevent online static assets loading',async()=>{
 const browser=browserCache();browser.state.unavailable=true;
 assert.equal((await browser.request('/assets/app.js')).status,200);
});

test('offline navigation with no usable cache returns a real response',async()=>{
 const browser=browserCache();browser.state.online=false;
 assert.equal((await browser.request('/', 'navigate')).status,503);
});

test('offline navigation tolerates inaccessible cache storage',async()=>{
 const browser=browserCache();browser.state.online=false;browser.state.unavailable=true;
 assert.equal((await browser.request('/', 'navigate')).status,503);
});
