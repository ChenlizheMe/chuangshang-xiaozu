// Actual worker source with browser-shaped Cache API; this verifies complete
// offline runtime dependencies, not executed WebGL or browser rendering.
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {offlineReleasePlugin} from '../scripts/offline-release.mjs';
import {browser,html,js,css,deferred} from './helpers/service-worker-runtime.mjs';
const file=new URL('../public/sw.js',import.meta.url);
const template=fs.readFileSync(file,'utf8');
const A={id:'audit-A',assets:['./assets/app-A.js','./assets/lazy-A.js','./assets/theme-A.css']};
const B={id:'audit-B',assets:['./assets/app-B.js','./assets/lazy-B.js','./assets/theme-B.css']};
const C={id:'audit-C',assets:['./assets/app-C.js','./assets/lazy-C.js','./assets/theme-C.css']};
const sourceFor=release=>template.replace(/const RELEASE = [^;]+;/,`const RELEASE = ${JSON.stringify(release)};`);
const documentFor=release=>html(`<!doctype html><html><head><script id="offline-release" type="application/json">${JSON.stringify(release)}</script><script type="module" src="${release.assets[0]}"></script><link rel="stylesheet" href="${release.assets[2]}"></head><body>${release.id}</body></html>`);
const route=(b,path,response)=>b.state.responses.set(new URL(path,b.base).pathname,response);
function serve(b,release){route(b,'./',documentFor(release));route(b,'./index.html',documentFor(release));for(const path of release.assets)route(b,path,path.endsWith('.css')?css():js());for(const path of ['./manifest.webmanifest','./icons/icon.svg','./icons/icon-192.png','./icons/icon-512.png'])route(b,path,new Response('static shell asset'));}
async function installed({scope='/',release=A,stores}={}){const b=browser(sourceFor(release),{scope,stores});serve(b,release);await b.lifecycle('install');await b.lifecycle('activate');return b;}
async function offline(b){b.state.online=false;const response=await b.request('./','navigate');const text=await response.text();const match=text.match(/<body>([^<]+)/);const runtime=[];const manifest=text.match(/<script id="offline-release" type="application\/json">([^<]+)/);if(manifest)for(const path of JSON.parse(manifest[1]).assets){const res=await b.request(path);runtime.push({path,status:res.status,mime:res.headers.get('content-type')});}return {status:response.status,label:match?.[1],runtime,complete:runtime.length>0&&runtime.every(r=>r.status===200)};}
const run=(name,fn)=>test(name,async()=>{const result=await fn();assert.equal(result.pass,true,JSON.stringify(result));});
await run('successful_root_install_includes_lazy_without_models',async()=>{const b=await installed();const off=await offline(b);return {pass:off.complete&&off.label===A.id&&!b.calls.some(url=>/anatomy|draco/.test(url)),...off,calls:b.calls};});
await run('successful_project_subpath',async()=>{const b=await installed({scope:'/trauma-team-international/'});const off=await offline(b);return {pass:off.complete&&b.calls.every(url=>new URL(url).pathname.startsWith('/trauma-team-international/')),...off,calls:b.calls};});
await run('failed_new_install_preserves_previous_complete_shell',async()=>{const b=await installed();const next=browser(sourceFor(B),{stores:b.stores});serve(next,B);route(next,B.assets[1],new Response('missing',{status:404}));let rejected=false;try{await next.lifecycle('install');}catch{rejected=true;}const off=await offline(b);return {pass:rejected&&!next.workerState.skipWaiting&&off.complete&&off.label===A.id,rejected,skipWaiting:next.workerState.skipWaiting,...off,cacheNames:await b.caches.keys()};});
await run('cdn_html_and_worker_mismatch_does_not_activate',async()=>{const b=browser(sourceFor(A));serve(b,B);let rejected=false;try{await b.lifecycle('install');}catch{rejected=true;}return {pass:rejected&&!b.workerState.skipWaiting,rejected,skipWaiting:b.workerState.skipWaiting};});
await run('interrupted_navigation_retains_complete_previous_index',async()=>{const b=await installed();serve(b,B);const gate=deferred(),entered=deferred();b.state.fetchHook=url=>{if(url.endsWith('/lazy-B.js')){entered.resolve();return gate.promise;}};let delivered=false;const navigation=b.request('./','navigate').then(response=>{delivered=true;return response;});await entered.promise;const off=await offline(b);gate.reject(new Error('Download interrupted'));await navigation;await b.flush();return {pass:delivered&&off.complete&&off.label===A.id,delivered,...off};});
await run('quota_failure_retains_complete_previous_index',async()=>{const b=await installed();serve(b,B);b.state.putHook=async(name,url)=>{if(url.endsWith('/lazy-B.js'))throw new Error('Quota exceeded');};const online=await b.request('./','navigate');await b.flush();const off=await offline(b);return {pass:online.status===200&&off.complete&&off.label===A.id,onlineStatus:online.status,...off};});
for(const [extension,mime] of [['js','text/plain'],['css','application/json']])await run(`bad_${extension}_mime_cannot_promote_new_index`,async()=>{const b=await installed();serve(b,B);const path=B.assets.find(path=>path.endsWith('.'+extension));route(b,path,new Response(extension==='js'?'export {}':'body{}',{headers:{'content-type':mime}}));const online=await b.request('./','navigate');await b.flush();const off=await offline(b);return {pass:online.status===200&&off.complete&&off.label===A.id,onlineStatus:online.status,...off};});
await run('script_free_hosting_fallback_cannot_replace_app',async()=>{const b=await installed();route(b,'./',html('<html><body>Temporarily unavailable</body></html>'));await b.request('./','navigate');await b.flush();const off=await offline(b);return {pass:off.complete&&off.label===A.id,...off};});
await run('late_older_navigation_cannot_replace_later_completed_release',async()=>{
 const b=await installed();serve(b,B);const gate=deferred(),entered=deferred(),newerWrite=deferred();
 b.state.fetchHook=url=>{if(url.endsWith('/lazy-B.js')){entered.resolve();return gate.promise;}};
 b.state.putHook=async(name,url,response)=>{if(url.endsWith('/index.html')&&(await response.clone().text()).includes(`<body>${C.id}</body>`))newerWrite.resolve();};
 await b.request('./','navigate');await entered.promise;serve(b,C);await b.request('./','navigate');await newerWrite.promise;
 // The in-memory Cache.put finishes after this hook's microtasks; no elapsed
 // wall-time guess is used to decide whether C reached its index commit.
 await new Promise(resolve=>setImmediate(resolve));gate.resolve(js());await b.flush();const off=await offline(b);return {pass:off.complete&&off.label===C.id,...off};
});
await run('storage_unavailable_still_delivers_online_navigation',async()=>{const b=await installed();serve(b,B);b.state.unavailable=true;const online=await b.request('./','navigate');const body=await online.text();await b.flush();return {pass:online.status===200&&body.includes(B.id),status:online.status};});
await run('upgrade_retains_one_previous_runtime_and_model_cache',async()=>{const a=await installed();const models=await a.caches.open('trauma-team-international-models-v5');await models.put('./anatomy/skeleton-mobile.glb?v=5',new Response('GLB',{headers:{'content-type':'application/octet-stream'}}));const b=await installed({release:B,stores:a.stores});const c=await installed({release:C,stores:b.stores});c.state.online=false;const current=await offline(c),previous=await c.request(B.assets[0]),model=await c.request('./anatomy/skeleton-mobile.glb?v=5');return {pass:current.complete&&previous.status===200&&model.status===200&&!c.calls.some(url=>/anatomy|draco/.test(url)),...current,previousStatus:previous.status,modelStatus:model.status,cacheNames:await c.caches.keys()};});
await run('failed_legacy_model_migration_keeps_download_usable',async()=>{const b=browser(sourceFor(A));serve(b,A);const old=await b.caches.open('trauma-team-international-shell-v9');await old.put('./anatomy/skeleton-mobile.glb?v=5',new Response('GLB',{headers:{'content-type':'application/octet-stream'}}));await old.put('./assets/old.js',js());await b.lifecycle('install');b.state.putHook=async(name,url)=>{if(name.endsWith('models-v5'))throw new Error('Quota exceeded');};let activationError;try{await b.lifecycle('activate');}catch(e){activationError=e.message;}b.state.online=false;const model=await b.request('./anatomy/skeleton-mobile.glb?v=5');return {pass:!activationError&&b.workerState.claimed&&model.status===200,activationError,claimed:b.workerState.claimed,modelStatus:model.status,caches:await b.caches.keys()};});
await run('poisoned_current_asset_uses_valid_retained_asset',async()=>{const b=await installed();const old=await b.caches.open('trauma-team-international-shell-v10');await old.put(A.assets[0],js());for(const name of await b.caches.keys())if(name.includes('shell-v11-'))await (await b.caches.open(name)).put(A.assets[0],html('<html>upstream fallback</html>'));b.state.online=false;const response=await b.request(A.assets[0]);return {pass:response.status===200,status:response.status,mime:response.headers.get('content-type')};});

test('the build plugin gives HTML and worker the same complete deterministic runtime inventory',()=>{
 const bundle={'assets/app-a.js':{},'assets/lazy-a.js':{},'assets/style-a.css':{},'assets/debug.js.map':{},'anatomy/model.glb':{},'draco/decoder.js':{}};
 const build=files=>{const plugin=offlineReleasePlugin(),tags=plugin.transformIndexHtml.handler('',{bundle:files}),release=JSON.parse(tags[0].children);let emitted;plugin.generateBundle.call({emitFile:file=>{emitted=file;}});assert.equal(emitted.fileName,'sw.js');assert.deepEqual(JSON.parse(emitted.source.match(/const RELEASE = ([^;]+);/)[1]),release);return release;};
 const release=build(bundle);assert.deepEqual(release.assets,['./assets/app-a.js','./assets/lazy-a.js','./assets/style-a.css']);assert.deepEqual(build(bundle),release);
 assert.notEqual(build({...bundle,'assets/lazy-b.js':{}}).id,release.id,'a runtime update must update the service-worker release too');
});
await run('a_slow_index_write_cannot_finish_after_a_newer_index_commit',async()=>{
 const b=await installed();serve(b,B);const entered=deferred(),gate=deferred();
 b.state.putHook=async(name,url,response)=>{if(url.endsWith('/index.html')&&(await response.clone().text()).includes(`<body>${B.id}</body>`)){entered.resolve();await gate.promise;}};
 await b.request('./','navigate');await entered.promise;serve(b,C);await b.request('./','navigate');
 await new Promise(resolve=>setImmediate(resolve));gate.resolve();await b.flush();const off=await offline(b);return {pass:off.complete&&off.label===C.id,...off};
});
await run('an_orphan_staging_cache_cannot_displace_the_previous_complete_generation',async()=>{
 const a=await installed();const orphan=await a.caches.open('trauma-team-international-shell-v11-incomplete');await orphan.put('./assets/orphan.js',js());
 const b=await installed({release:B,stores:a.stores});const names=await b.caches.keys();return {pass:names.includes('trauma-team-international-shell-v11-'+A.id)&&!names.includes('trauma-team-international-shell-v11-incomplete'),names};
});
await run('older_activation_does_not_delete_a_future_workers_staging_cache',async()=>{
 const a=await installed();const name='trauma-team-international-shell-v11-future';await (await a.caches.open(name)).put('./assets/future.js',js());await a.lifecycle('activate');return {pass:(await a.caches.keys()).includes(name)};
});
await run('a_manifest_cannot_make_the_worker_fetch_foreign_or_out_of_scope_resources',async()=>{
 const b=await installed();const bad={id:'foreign',assets:['https://example.invalid/private.js','../outside.js']};route(b,'./',documentFor(bad));await b.request('./','navigate');await b.flush();const off=await offline(b);return {pass:off.complete&&off.label===A.id&&!b.calls.some(url=>url.includes('example.invalid')||url.includes('/outside.js')),...off};
});
