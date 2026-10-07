import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {safePartLabel,anatomyIdentity} from '../src/anatomyLabels.js';import {clinicalProfile} from '../src/clinicalRegions.js';
const expected=[
 ['ventral parts of lateral intertransversarii lumborum muscles','腰横突间外侧肌腹侧部','spine'],
 ['dorsal parts of lateral intertransversarii lumborum muscles','腰横突间外侧肌背侧部','spine'],
 ['interspinales colli muscles','颈棘间肌','neck'],
 ['interspinales lumborum muscles','腰棘间肌','spine'],
 ['interspinales thoracis muscles','胸棘间肌','spine'],
 ['intertransverse ligaments','横突间韧带','spine'],
 ['interspinous ligaments','棘间韧带','spine']
];
for(const [file,layer,count] of [['muscle-mobile.glb','muscle',10],['muscle-optimized.glb','muscle',10],['muscular_male.glb','muscle',10],['skeleton-mobile.glb','skeleton',3],['skeletal_male.glb','skeleton',3]])test(`intertransverse and interspinous names stay distinct in ${file}`,()=>{
 const data=fs.readFileSync(new URL('../public/anatomy/'+file,import.meta.url));const gltf=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());let checked=0;
 for(const node of gltf.nodes){const identity=anatomyIdentity(node.name||'');const entry=expected.find(([name])=>identity.name.toLowerCase()===name);if(!entry)continue;checked++;
  const label=safePartLabel(node.name,layer),prefix=identity.side==='left'?'左侧':identity.side==='right'?'右侧':'';
  assert.equal(label.zh,prefix+entry[1]);assert.equal(clinicalProfile(node.name,layer).region,entry[2]);
  assert.equal(label.en.toLowerCase(),(identity.side?identity.side+' ':'')+entry[0]);
  assert.equal(clinicalProfile(node.name,layer).side,identity.side);
 }
 assert.equal(checked,count,'the existing GLB names remain present on both sides');
});
