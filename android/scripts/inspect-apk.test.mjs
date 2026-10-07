import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyApkBadging,verifyBundledInventory} from './inspect-apk.mjs';

// Metadata spelling produced by the actual Build Tools 35 CI APK inspection.
const badging=`package: name='cn.traumateam.app' versionCode='1' versionName='1.0.0' platformBuildVersionName='15' platformBuildVersionCode='35' compileSdkVersion='35' compileSdkVersionCodename='15'
minSdkVersion:'26'
targetSdkVersion:'35'
uses-permission: name='android.permission.INTERNET'
application-label:'创伤小组'
`;
test('release metadata accepts the actual aapt2 minSdkVersion field',()=>{
 assert.doesNotThrow(()=>verifyApkBadging(badging));
});
test('the metadata gate still rejects wrong APIs, identity, permissions and debug builds',()=>{
 for(const invalid of [badging.replace("minSdkVersion:'26'","minSdkVersion:'25'"),badging.replace("minSdkVersion:'26'",''),badging+"minSdkVersion:'27'\n",badging.replace("targetSdkVersion:'35'","targetSdkVersion:'34'"),badging.replace('cn.traumateam.app','cn.traumateam.app.debug'),badging+"uses-permission: name='android.permission.CAMERA'\n",badging+'application-debuggable\n'])assert.throws(()=>verifyApkBadging(invalid));
});

function packagedFixture(){
 const files=new Map();
 const assets={};
 const lines=[];
 for(const [logical,mime] of [
  ['/anatomy/skeleton-mobile.glb','model/gltf-binary'],
  ['/anatomy/muscle-mobile.glb','model/gltf-binary'],
  ['/anatomy/organs-mobile.glb','model/gltf-binary'],
  ['/draco/draco_decoder.js','text/javascript'],
  ['/draco/draco_wasm_wrapper.js','text/javascript'],
  ['/draco/draco_decoder.wasm','application/wasm'],
 ]){
  const bytes=Buffer.from(`fixture bytes for ${logical}`);
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const extension=logical.slice(logical.lastIndexOf('.'));
  const versionedPath=logical.slice(0,-extension.length)+'.'+sha256+extension;
  const url=versionedPath+`?${extension==='.glb'?'v=5&':''}sha256=${sha256}`;
  assets[logical]={sha256,size:bytes.length,mime,versionedPath,url};
  files.set(logical,bytes);
  lines.push(`${versionedPath}=${sha256}|${mime}|${bytes.length}|${logical.slice(1)}`);
 }
 return {inventory:{schema:1,assets},properties:lines.sort().join('\n')+'\n',readAsset:logical=>files.get(logical)};
}
test('packaged JSON, Java properties and actual bytes agree for all six files',()=>{
 const fixture=packagedFixture();
 assert.doesNotThrow(()=>verifyBundledInventory(fixture.inventory,fixture.properties,fixture.readAsset));
});
test('properties reject missing, duplicate, conflicting and Java escape/continuation forms',()=>{
 const {inventory,properties,readAsset}=packagedFixture();
 const first=properties.split('\n')[0];
 const hash=first.split('=')[1].split('|')[0];
 const conflicting=first.replaceAll(hash,'0'.repeat(64));
 for(const [name,text] of [
  ['empty',''],
  ['missing entry',properties.slice(first.length+1)],
  ['duplicate entry',properties+first+'\n'],
  ['conflicting same logical file',properties+conflicting+'\n'],
  ['malformed unicode','bad=\\uNOT0\n'],
  ['escaped key',properties.replace('/anatomy/','\\u002fanatomy/')],
  ['continuation',properties.replace('=','=\\\n')],
  ['comment',properties+'# additional text\n'],
 ])assert.throws(()=>verifyBundledInventory(inventory,text,readAsset),undefined,name);
});
test('inventory and packaged byte mutations cannot pass by keeping properties unchanged',()=>{
 const {inventory,properties,readAsset}=packagedFixture();
 const logical='/anatomy/skeleton-mobile.glb';
 for(const patch of [
  {sha256:'A'.repeat(64)}, {size:0}, {size:16*1024*1024+1}, {size:1.5},
  {mime:'text/html'}, {versionedPath:'/anatomy/other.glb'},
  {url:inventory.assets[logical].url+'&extra=1'},
 ]){
  const changed=structuredClone(inventory);
  Object.assign(changed.assets[logical],patch);
  assert.throws(()=>verifyBundledInventory(changed,properties,readAsset));
 }
 const missing=structuredClone(inventory); delete missing.assets[logical];
 assert.throws(()=>verifyBundledInventory(missing,properties,readAsset));
 const renamed=structuredClone(inventory);
 renamed.assets['/anatomy/../unexpected.glb']=renamed.assets[logical]; delete renamed.assets[logical];
 assert.throws(()=>verifyBundledInventory(renamed,properties,()=>assert.fail('Unapproved paths must not be read')));
 assert.throws(()=>verifyBundledInventory(inventory,properties,name=>{
  const bytes=Buffer.from(readAsset(name)); if(name===logical)bytes[0]^=1; return bytes;
 }));
});
