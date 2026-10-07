import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
import {ANATOMY_MODELS,isVisibleAnatomyMesh} from '../src/anatomyModels.js';
const knowledge=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const fields=['feelings','signs','timing','triggers'];
const warning='painful-gum-swelling-review';
const meshes=new Map();
function assertMesh(part,layer){
 if(!meshes.has(layer))meshes.set(layer,[ANATOMY_MODELS[layer].file,ANATOMY_MODELS[layer].mobileFile].map(file=>{
  const bytes=fs.readFileSync(new URL(`../public/anatomy/${file}`,import.meta.url)),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  return new Set(gltf.nodes.filter(node=>node.mesh!==undefined&&isVisibleAnatomyMesh(node.name,layer)).map(node=>node.name));
 }));
 for(const names of meshes.get(layer))assert.ok(names.has(part),`${part} must exist in both deployed ${layer} assets`);
}
function report(part,tags,layer='skeleton',checkUI=true){
 const r={part,layer,...Object.fromEntries(fields.map(field=>[field,tags.filter(id=>knowledge[field].some(tag=>tag.id===id))]))};
 if(checkUI){assertMesh(part,layer);for(const field of fields){const visible=new Set(visibleSymptoms(knowledge,{parts:[part],layer,kind:field}).map(tag=>tag.id));for(const id of r[field])assert.ok(visible.has(id),`${part} ${field}: ${id}`);}}
 return r;
}
const assess=(part,tags,layer='skeleton',checkUI=true,k=knowledge)=>assessSymptoms(k,{reports:[report(part,tags,layer,checkUI)]});
for(const [part,layer] of [['Lower canine.l','skeleton'],['Mandible','skeleton'],['Superficial part of masseter.r','muscle']])for(const pain of ['疼痛','咬合痛','持续冷热痛','自发痛','夜间痛'])test(`${part}: ${pain} with reported gum swelling routes dental contact today`,()=>{
 const result=assess(part,[pain,'牙龈肿胀'],layer);assert.equal(result.triageLevel,'same-day');assert.ok(result.urgent.some(item=>item.id===warning));
 assert.ok(result.items.every(item=>item.advice.zh===result.urgent[0].zh));assert.match(result.urgent.find(item=>item.id===warning).en,/contact a dentist today/);
});
for(const tags of [['咬合痛'],['咬合痛','外伤后'],['牙龈肿胀'],['牙龈出血','牙龈肿胀'],['冷热敏感','刺激去除即缓解'],['冷热敏感','刺激去除即缓解','牙龈肿胀'],['紧绷','牙龈肿胀']])test(`nearby observation does not acquire the new painful-swelling action: ${tags.join('+')}`,()=>{
 const result=assess('Lower canine.l',tags);assert.ok(!result.urgent.some(item=>item.id===warning));assert.ok(!['same-day','emergency'].includes(result.triageLevel));
});
test('injury does not prove infection or become a requirement for the dental contact action',()=>{
 const result=assess('Lower canine.l',['咬合痛','牙龈肿胀','外伤后']);assert.equal(result.triageLevel,'same-day');
 assert.deepEqual(new Set(result.items.map(item=>item.id)),new Set(['dental-abscess','dental-fracture']));
 const text=result.urgent.find(item=>item.id===warning);assert.match(text.zh,/不能据此确诊脓肿或判断已扩散/);assert.match(text.en,/do not establish an abscess or spread/);
 assert.doesNotMatch(text.zh,/没有发热|没有危险/);
});
for(const danger of ['张口受限','吞咽困难','呼吸困难'])test(`existing higher danger still wins: ${danger}`,()=>{
 const result=assess('Lower canine.l',['咬合痛','牙龈肿胀',danger]);assert.equal(result.triageLevel,'emergency');assert.equal(result.urgent[0].level,'emergency');assert.ok(result.items.every(item=>item.advice.en===result.urgent[0].en));
});
test('the action depends on reported observations, not candidate names or scores',()=>{
 const k={...knowledge,conditions:knowledge.conditions.filter(item=>!['dental-abscess','dental-fracture'].includes(item.id))};
 const result=assess('Lower canine.l',['咬合痛','牙龈肿胀','外伤后'],'skeleton',true,k);assert.equal(result.triageLevel,'same-day');assert.ok(result.urgent.some(item=>item.id===warning));
});
test('API-only wrong-area and remote-pain combinations cannot invent oral pain',()=>{
 for(const tags of [['侧腰痛','牙龈肿胀'],['放射痛','牙龈肿胀'],['单侧头痛','牙龈肿胀']])assert.ok(!assess('Lower canine.l',tags,'skeleton',false).urgent.some(item=>item.id===warning));
 assert.ok(!assess('Humerus.l',['疼痛','牙龈肿胀'],'skeleton',false).urgent.some(item=>item.id===warning));
});
