import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'android/app/build/generated/bundled-assets');
test('APK assets are a small verified subset, never a frozen website',async()=>{
 execFileSync(process.execPath,[path.join(root,'android/scripts/prepare-assets.mjs')],{cwd:root});
 const manifest=JSON.parse(await readFile(path.join(out,'packaged-assets.json'),'utf8'));
 assert.equal(manifest.schema,1);
 assert.equal(Object.keys(manifest.assets).length,6);
 let total=0;
 for(const [name,entry] of Object.entries(manifest.assets)){
  assert.match(name,/^\/(?:anatomy\/(?:skeleton|muscle|organs)-mobile\.glb|draco\/(?:draco_decoder\.(?:js|wasm)|draco_wasm_wrapper\.js))$/);
  const bytes=await readFile(path.join(out,name));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
  assert.equal(bytes.length,entry.size);
  const ext=path.extname(name);
  assert.equal(entry.versionedPath,`${name.slice(0,-ext.length)}.${entry.sha256}${ext}`);
  const requested=new URL(entry.url,'https://traumateam.cn');
  assert.equal(requested.pathname,entry.versionedPath);
  assert.equal(requested.searchParams.get('sha256'),entry.sha256);
  assert.deepEqual(bytes,await readFile(path.join(root,'public',name)));
  total+=entry.size;
 }
 assert.ok(total<5*1024*1024);
 for(const file of await readdir(out,{recursive:true}))assert.ok(!/\.html$|(?:^|\/)assets\/|sw\.js$|main\..*\.js$/.test(file),file);
 for(const license of ['DRACO-LICENSE.txt','DRACO-NOTICE.txt'])assert.ok((await readFile(path.join(out,'licenses',license))).length>100);
 for(const license of ['LICENSE','NOTICE'])assert.ok((await readFile(path.join(out,'anatomy',license))).length>100);
});
test('manifest grants no sensitive native permissions or insecure connection exceptions',async()=>{
 const xml=await readFile(path.join(root,'android/app/src/main/AndroidManifest.xml'),'utf8');
 assert.deepEqual([...xml.matchAll(/<uses-permission android:name="([^"]+)"/g)].map(x=>x[1]),['android.permission.INTERNET']);
 assert.match(xml,/android:usesCleartextTraffic="false"/);
 assert.match(xml,/android:allowBackup="false"/);
 const main=await readFile(path.join(root,'android/app/src/main/java/cn/traumateam/app/MainActivity.java'),'utf8');
 assert.ok(!main.includes('addJavascriptInterface('));
 assert.ok(!main.includes('Intent.parseUri('));
 assert.ok(!main.includes('.proceed('));
 assert.match(main,/ssl.cancel\(\)/);
 assert.match(main,/setWebContentsDebuggingEnabled\(false\)/);
 assert.match(main,/setServiceWorkerClient/);
});
