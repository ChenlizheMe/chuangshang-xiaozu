import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function verifyApkBadging(badging){
assert.match(badging,/package: name='cn\.traumateam\.app' versionCode='1' versionName='1\.0\.0'/);
assert.deepEqual([...badging.matchAll(/^minSdkVersion:'([^']+)'$/gm)].map(x=>x[1]),['26']);
assert.match(badging,/targetSdkVersion:'35'/);
assert.deepEqual([...badging.matchAll(/uses-permission: name='([^']+)'/g)].map(x=>x[1]),['android.permission.INTERNET']);
assert.ok(!badging.includes('application-debuggable'));
}
const BUNDLED_FILES = new Map([
 ['/anatomy/skeleton-mobile.glb','model/gltf-binary'],
 ['/anatomy/muscle-mobile.glb','model/gltf-binary'],
 ['/anatomy/organs-mobile.glb','model/gltf-binary'],
 ['/draco/draco_decoder.js','text/javascript'],
 ['/draco/draco_wasm_wrapper.js','text/javascript'],
 ['/draco/draco_decoder.wasm','application/wasm'],
]);
export function verifyBundledInventory(inventory,properties,readAsset){
 assert.equal(inventory.schema,1);
 assert.ok(inventory.assets&&typeof inventory.assets==='object'&&!Array.isArray(inventory.assets));
 assert.deepEqual(Object.keys(inventory.assets).sort(),[...BUNDLED_FILES.keys()].sort());
 const expectedProperties=[];
 for(const [logical,mime] of BUNDLED_FILES){
  const entry=inventory.assets[logical];
  assert.ok(entry&&typeof entry==='object');
  assert.equal(typeof entry.sha256,'string');
  assert.match(entry.sha256,/^[0-9a-f]{64}$/);
  assert.ok(Number.isSafeInteger(entry.size)&&entry.size>0&&entry.size<=16*1024*1024);
  assert.equal(entry.mime,mime);
  const extension=path.extname(logical);
  const versionedPath=`${logical.slice(0,-extension.length)}.${entry.sha256}${extension}`;
  assert.equal(entry.versionedPath,versionedPath);
  assert.equal(entry.url,`${versionedPath}?${extension==='.glb'?'v=5&':''}sha256=${entry.sha256}`);
  const bytes=readAsset(logical);
  assert.equal(bytes.length,entry.size);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
  expectedProperties.push(`${versionedPath}=${entry.sha256}|${mime}|${entry.size}|${logical.slice(1)}`);
 }
 // The build generator owns this ASCII format. Require its exact text instead
 // of partially emulating Java Properties escapes, continuation or duplicate keys.
 assert.equal(properties,expectedProperties.sort().join('\n')+'\n',
  'packaged-assets.properties must exactly match the verified six-file inventory');
}
export async function inspectApk(apk,badgingFile){
verifyApkBadging(await readFile(badgingFile,'utf8'));
const files=execFileSync('unzip',['-Z1',apk],{encoding:'utf8'}).trim().split('\n');
assert.ok(files.includes('assets/packaged-assets.properties'));
assert.equal(files.filter(x=>/^assets\/anatomy\/.*\.glb$/.test(x)).length,3);
assert.equal(files.filter(x=>/^assets\/draco\//.test(x)).length,3);
assert.ok(!files.some(x=>/^assets\/.*(?:\.html$|\/sw\.js$|\/dist\/)/.test(x)));
assert.ok(!files.some(x=>/\.(?:jks|keystore|p12|pem|key)$/.test(x)));
const inventory=JSON.parse(execFileSync('unzip',['-p',apk,'assets/packaged-assets.json'],{encoding:'utf8'}));
const properties=execFileSync('unzip',['-p',apk,'assets/packaged-assets.properties'],{encoding:'utf8'});
verifyBundledInventory(inventory,properties,logical=>
 execFileSync('unzip',['-p',apk,`assets${logical}`],{maxBuffer:16*1024*1024}));
for(const notice of ['assets/anatomy/LICENSE','assets/anatomy/NOTICE','assets/licenses/DRACO-LICENSE.txt','assets/licenses/DRACO-NOTICE.txt'])assert.ok(files.includes(notice));
console.log('APK checked: cn.traumateam.app 1.0.0 (1), min API 26, target API 35, INTERNET only, not debuggable; content-addressed assets only.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await inspectApk(...process.argv.slice(2));
