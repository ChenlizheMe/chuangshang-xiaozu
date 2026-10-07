import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import viteConfig from '../vite.config.js';
const config=viteConfig({command:'build'});
import {createAnatomyAssetManifest,anatomyAssetManifestPlugin} from '../scripts/anatomy-asset-manifest.mjs';
import {verifyAnatomyAssets} from '../scripts/verify-anatomy-assets.mjs';
import {anatomyAssetUrl} from '../src/anatomyAssetUrls.js';
import {browser} from './helpers/service-worker-runtime.mjs';

const repo=fileURLToPath(new URL('../',import.meta.url)),manifest=createAnatomyAssetManifest();
const require=createRequire(import.meta.url);
const worker=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
async function compiledModule(file){
 const output=await build({entryPoints:[path.join(repo,file)],bundle:true,platform:'node',format:'cjs',packages:'external',write:false,define:config.define});
 const module={exports:{}};new Function('module','exports','require',output.outputFiles[0].text)(module,module.exports,require);return module.exports;
}
test('the manifest versions exactly six current model files and three decoder files from their bytes',()=>{
 assert.equal(manifest.schema,1);assert.equal(Object.keys(manifest.assets).length,9);
 assert.deepEqual(JSON.parse(config.define.__ANATOMY_ASSET_MANIFEST__),manifest);
 for(const [resource,asset] of Object.entries(manifest.assets)){
  const bytes=fs.readFileSync(path.join(repo,'public',resource));
  assert.equal(asset.sha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(asset.size,bytes.length);
  assert.equal(anatomyAssetUrl(resource,manifest),asset.url);
  assert.ok(asset.versionedPath.includes('.'+asset.sha256+'.'));
  const url=new URL(asset.url,'https://traumateam.cn/project/');assert.ok(url.pathname.startsWith('/project/'));
  assert.equal(url.searchParams.getAll('sha256').length,1);assert.equal(url.searchParams.get('sha256'),asset.sha256);
  assert.equal(url.searchParams.get('v'),resource.endsWith('.glb')?'5':null);
 }
});
test('development keeps source resource URLs because content-addressed files are emitted only for builds',()=>{
 assert.deepEqual(viteConfig({command:'serve'}).define,{});
 assert.equal(anatomyAssetUrl('./anatomy/skeleton-mobile.glb'),'./anatomy/skeleton-mobile.glb?v=5');
 assert.equal(anatomyAssetUrl('./draco/draco_decoder.wasm'),'./draco/draco_decoder.wasm');
});
test('the actual Vite-injected URL helper uses the build mapping and fails closed on unknown resources',async()=>{
 const compiled=await compiledModule('src/anatomyAssetUrls.js');
 for(const [resource,asset] of Object.entries(manifest.assets))assert.equal(compiled.anatomyAssetUrl(resource),asset.url);
 assert.throws(()=>compiled.anatomyAssetUrl('./anatomy/unknown.glb'),/Missing anatomy/);
 for(const patch of [{sha256:'bad'},{size:0},{url:manifest.assets['./anatomy/skeleton-mobile.glb'].url+'&sha256='+'a'.repeat(64)},{url:'https://other.example/model.glb'}]){
  const invalid=structuredClone(manifest);Object.assign(invalid.assets['./anatomy/skeleton-mobile.glb'],patch);
  assert.throws(()=>anatomyAssetUrl('./anatomy/skeleton-mobile.glb',invalid),/anatomy asset/);
 }
});
test('every shared Draco manager, including a retry replacement, resolves all libraries to their content URL',async()=>{
 const {createSharedDraco}=await compiledModule('src/dracoLoader.js');
 const get=createSharedDraco({makeLoader:manager=>({manager,setDecoderPath(){},setWorkerLimit(){},dispose(){}})});
 const first=get();
 for(const name of ['draco_decoder.js','draco_wasm_wrapper.js','draco_decoder.wasm'])assert.equal(first.manager.resolveURL('./draco/'+name),manifest.assets['./draco/'+name].url);
 first.manager.onError('library failure');const next=get();assert.notEqual(first,next);
 assert.equal(next.manager.resolveURL('./draco/draco_decoder.wasm'),manifest.assets['./draco/draco_decoder.wasm'].url);
 first.manager.onError('late old failure');assert.equal(get(),next);
});
test('the emitted manifest and verifier detect changed asset bytes and a stale or malformed mapping',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'trauma-anatomy-versions-'));
 try{
  for(const resource of Object.keys(manifest.assets)){const target=path.join(directory,resource);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(repo,'public',resource),target)}
  let emitted;anatomyAssetManifestPlugin(manifest).generateBundle.call({emitFile:file=>{emitted=file;const target=path.join(directory,file.fileName);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,file.source)}});
  assert.deepEqual(verifyAnatomyAssets(directory),manifest);
  const versioned=path.join(directory,manifest.assets['./anatomy/skeleton-mobile.glb'].versionedPath),original=fs.readFileSync(versioned);
  fs.writeFileSync(versioned,Buffer.concat([original,Buffer.from([0])]));assert.throws(()=>verifyAnatomyAssets(directory),/versioned anatomy size/);fs.writeFileSync(versioned,original);
  const target=path.join(directory,'anatomy/skeleton-mobile.glb'),bytes=fs.readFileSync(target);bytes[0]^=1;fs.writeFileSync(target,bytes);
  const changed=createAnatomyAssetManifest(directory);assert.notEqual(changed.assets['./anatomy/skeleton-mobile.glb'].url,manifest.assets['./anatomy/skeleton-mobile.glb'].url);
  for(const resource of Object.keys(manifest.assets).filter(name=>name!=='./anatomy/skeleton-mobile.glb'))assert.deepEqual(changed.assets[resource],manifest.assets[resource]);
  assert.throws(()=>verifyAnatomyAssets(directory),/actual dist bytes/);
  assert.throws(()=>anatomyAssetManifestPlugin(manifest,directory).generateBundle.call({emitFile(){}}),/changed during build/);
  fs.writeFileSync(path.join(directory,emitted.fileName),JSON.stringify(changed));assert.throws(()=>verifyAnatomyAssets(directory),/source assets/);
 }finally{fs.rmSync(directory,{recursive:true,force:true})}
});
test('manifest generation is portable and does not depend on the invoking working directory',()=>{
 const result=execFileSync(process.execPath,[path.join(repo,'scripts/anatomy-asset-manifest.mjs')],{cwd:os.tmpdir(),encoding:'utf8'});
 assert.deepEqual(JSON.parse(result),manifest);
});
for(const scope of ['/','/project/'])test(`model cache and shell migration preserve complete versioned paths in ${scope}`,async()=>{
 const b=browser(worker,{scope}),old=await b.caches.open('trauma-team-international-shell-v7');
 const a='a'.repeat(64),z='b'.repeat(64),legacy='./anatomy/skeleton-mobile.glb',legacyDecoder='./draco/draco_decoder.wasm';
 const modelA=`./anatomy/skeleton-mobile.${a}.glb`,modelB=`./anatomy/skeleton-mobile.${z}.glb`,decoderA=`./draco/draco_decoder.${a}.wasm`,decoderB=`./draco/draco_decoder.${z}.wasm`;
 const current=modelA+'?v=5&sha256='+a,next=modelB+'?v=5&sha256='+z;
 const binary=value=>new Response(value,{headers:{'content-type':'application/octet-stream'}});
 await old.put(legacy+'?v=5',binary('legacy model'));await old.put(legacy+'?v=5&sha256='+a,binary('legacy query-only model'));
 await old.put(current,binary('hash A'));await old.put(legacyDecoder,binary('legacy decoder'));await old.put(decoderA+'?sha256='+a,binary('decoder A'));
 await b.caches.open('trauma-team-international-shell-v11-development');await b.lifecycle('activate');b.state.online=false;
 assert.equal(await (await b.request(current)).text(),'hash A');assert.equal(await (await b.request(decoderA+'?sha256='+a)).text(),'decoder A');
 for(const url of [next,modelA+'?v=6&sha256='+a,modelA+'?v=5',modelA+'?v=5&sha256=wrong',current+'&sha256='+z,current+'&other=1',decoderB+'?sha256='+z])assert.equal((await b.request(url)).status,503,url);
 if(scope!=='/')assert.equal((await b.request('/anatomy/skeleton-mobile.'+a+'.glb?v=5&sha256='+a)).status,503,'root and project caches do not mix');
 b.state.online=true;b.state.responses.set(b.normalize(next),binary('hash B'));assert.equal(await (await b.request(next)).text(),'hash B');await b.flush();b.state.online=false;
 assert.equal(await (await b.request(next)).text(),'hash B');assert.equal(await (await b.request(current)).text(),'hash A');
});
test('a missing old versioned path fails clearly and HTML cannot replace it with a new model',async()=>{
 const b=browser(worker),a='a'.repeat(64),old=`./anatomy/skeleton-mobile.${a}.glb?v=5&sha256=${a}`;
 assert.equal((await b.request(old)).status,404);
 b.state.responses.set(b.normalize(old),new Response('<html>fallback</html>',{headers:{'content-type':'text/html'}}));
 assert.equal((await b.request(old)).status,502);await b.flush();assert.equal(b.writes.length,0);
 b.state.online=false;assert.equal((await b.request(old)).status,503);
});
