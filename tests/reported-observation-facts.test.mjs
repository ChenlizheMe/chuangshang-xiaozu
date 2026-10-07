import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
import {evidenceFamily,LOCAL_PAIN_TAGS,PAIN_TAGS} from '../src/symptomLanguage.js';
import {assertSelectableStructure} from './helpers/selectable-anatomy.mjs';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const fields=['feelings','signs','timing','triggers'];
function assess(part,layer,tags){
 assertSelectableStructure(part,layer);
 const report={part,layer,location:'unknown'};
 for(const field of fields){
  report[field]=tags.filter(tag=>k[field].some(option=>option.id===tag));
  const available=new Set(visibleSymptoms(k,{parts:[part],layer,kind:field}).map(t=>t.id));
  for(const tag of report[field])assert.ok(available.has(tag),`${part}: ${field}:${tag}`);
 }
 assert.equal(fields.flatMap(field=>report[field]).length,tags.length,'Every observation is classified once');
 return assessSymptoms(k,{reports:[report]});
}
const has=(result,id)=>result.items.some(item=>item.id===id);
const assertPriorityAdvice=result=>{for(const item of result.items)for(const lang of ['zh','en'])assert.equal(item.advice[lang],result.urgent[0][lang]);};
for(const part of ['Vertebra L3','Vertebra C3']){
 for(const [sign,level] of [['发热','same-day'],['发冷','same-day'],['体重下降','prompt']])test(`${part}: night pain reuses the existing ${sign} disposition`,()=>{
  const r=assess(part,'skeleton',['夜间痛',sign]);
  assert.equal(r.triageLevel,level);assert.ok(r.items.every(item=>item.basic));
  assertPriorityAdvice(r);
  assert.deepEqual(r.urgent,assess(part,'skeleton',['疼痛',sign]).urgent);
 });
 test(`${part}: night pain alone does not imply severe pain or a disease`,()=>{
  const r=assess(part,'skeleton',['夜间痛']);assert.equal(r.triageLevel,null);
  assert.equal(r.items.length,1);assert.ok(r.items[0].basic);assert.deepEqual(r.reportedSymptoms,['夜间痛']);
  assert.equal(assess(part,'skeleton',['发热']).triageLevel,null);
  assert.equal(assess(part,'skeleton',['持续数小时']).items.length,0);
 });
}
test('night pain remains outside disease pain gates and the global local-pain set',()=>{
 assert.equal(evidenceFamily('夜间痛'),'spontaneous');assert.ok(!PAIN_TAGS.has('夜间痛'));assert.ok(!LOCAL_PAIN_TAGS.has('夜间痛'));
 const r=assess('Lower canine.l','skeleton',['夜间痛']);assert.equal(r.triageLevel,'prompt');assert.ok(!has(r,'dental-pulpitis'));
 assert.equal(assess('Rectus abdominis muscle.r','muscle',['夜间痛','发热']).triageLevel,null);
});
test('night pain with an independent emergency preserves the highest action',()=>{
 const r=assess('Vertebra L3','skeleton',['夜间痛','发热','突然单侧无力']);assert.equal(r.triageLevel,'emergency');
 assert.ok(r.urgent.some(w=>w.id==='neck-back-pain-fever'));assertPriorityAdvice(r);
});
test('elbow-provoked numbness is a sensory observation, not a new ulnar diagnosis',()=>{
 const r=assess('Humerus.l','skeleton',['屈肘加重']);assert.equal(r.items[0].id,'basic-sensory-upper-limb');assert.equal(r.triageLevel,null);
 assert.deepEqual(r.items[0].why,['屈肘加重']);assert.ok(!has(r,'ulnar-nerve-irritation'));
 assert.ok(has(assess('Humerus.l','skeleton',['屈肘加重','无名小指麻木']),'ulnar-nerve-irritation'));
 assert.equal(assess('Humerus.l','skeleton',['反复用力']).items[0].id,'basic-upper-limb-upper-limb');
 assert.equal(assess('Humerus.l','skeleton',['屈肘加重','突然起病']).triageLevel,null);
});
for(const part of ['Frontal bone','Mandible','Incus.l'])test(`${part}: facial numbness keeps the reported site and unknown onset`,()=>{
 const r=assess(part,'skeleton',['面部麻木']);assert.match(r.items[0].id,/^basic-sensory-/);assert.equal(r.triageLevel,null);
 assert.deepEqual(r.items[0].why,['面部麻木']);assert.deepEqual(r.reportedSymptoms,['面部麻木']);
 assert.match(r.items[0].shortDescription.zh,/已报告面部麻木/);assert.match(r.items[0].shortDescription.en,/Facial numbness has been reported/);
 assert.match(r.items[0].shortDescription.en,/does not establish the symptom side/);
 assert.equal(assess(part,'skeleton',['面部麻木','反复数月']).triageLevel,null);
 const sudden=assess(part,'skeleton',['面部麻木','突然起病']);assert.equal(sudden.triageLevel,'emergency');
 assert.ok(sudden.urgent.some(w=>w.id==='sudden-facial-numbness'));
 assertPriorityAdvice(sudden);
});
test('known facial emergency action survives additional details and deletion recalculates it',()=>{
 const tags=['面部麻木','突然起病','突然单侧无力'];const r=assess('Frontal bone','skeleton',tags);
 assert.equal(r.triageLevel,'emergency');assert.ok(r.urgent.some(w=>w.id==='sudden-facial-numbness'));
 assert.equal(assess('Frontal bone','skeleton',['面部麻木','突然单侧无力']).triageLevel,'emergency');
 assert.equal(assess('Frontal bone','skeleton',['面部麻木']).triageLevel,null);
 assert.deepEqual(assess('Frontal bone','skeleton',[...tags].reverse()),r);
});
for(const [part,layer]of [['Patella.l','skeleton'],['Talus.r','skeleton'],['Pectineus muscle.r','muscle']]){
 test(`${part}: shoulder-specific pain cannot supply local bursitis evidence or a local suggestion`,()=>{
  const r=assess(part,layer,['侧卧肩痛','局部肿胀']);assert.ok(!has(r,'bursitis-pattern'));
  assert.ok(r.reportedSymptoms.includes('侧卧肩痛'));assert.equal(r.triageLevel,null);
  assert.ok(r.items.every(item=>!item.why.includes('侧卧肩痛')));assert.match(r.items[0].shortDescription.zh,/不能证明所选非肩部/);
  assert.ok(!assess(part,layer,['局部肿胀']).suggestions.includes('侧卧肩痛'));
 });
 test(`${part}: actual local tenderness remains sufficient, without using remote shoulder pain`,()=>{
  const r=assess(part,layer,['侧卧肩痛','局部肿胀','局部压痛']);const card=r.items.find(item=>item.id==='bursitis-pattern');
  assert.ok(card);assert.ok(card.why.includes('局部压痛'));assert.ok(!card.why.includes('侧卧肩痛'));assert.ok(!card.matchedSymptoms.includes('侧卧肩痛'));
  assert.ok(r.reportedSymptoms.includes('侧卧肩痛'));
  assert.match(card.shortDescription.zh,/可出现/);assert.match(card.shortDescription.en,/may involve/);
 });
}
test('shoulder-local observation retains its existing bursitis reference',()=>{
 const r=assess('Scapula.l','skeleton',['侧卧肩痛','局部肿胀']);const card=r.items.find(item=>item.id==='bursitis-pattern');
 assert.ok(card);assert.ok(card.why.includes('侧卧肩痛'));assert.equal(r.triageLevel,null);
});
test('restricting remote shoulder evidence never hides an independent warning',()=>{
 const r=assess('Patella.l','skeleton',['侧卧肩痛','局部肿胀','发热']);assert.equal(r.triageLevel,'same-day');
 assert.ok(!has(r,'bursitis-pattern'));assertPriorityAdvice(r);
});

test('remote shoulder-only observation stays visible without supplying local pain',()=>{
 const r=assess('Patella.l','skeleton',['侧卧肩痛']);assert.equal(r.items.length,1);assert.ok(r.items[0].basic);
 assert.match(r.items[0].name.zh,/需核实实际部位/);assert.deepEqual(r.items[0].why,['侧卧肩痛']);assert.equal(r.triageLevel,null);
});
test('remote shoulder context does not displace independent fatigue, skin or urinary observations',()=>{
 for(const [part,layer,tag,expected]of [['Patella.l','skeleton','疲劳乏力','fatigue'],['Patella.l','skeleton','皮疹','skin'],['Pectineus muscle.r','muscle','尿频','urinary']]){
  const r=assess(part,layer,['侧卧肩痛',tag]);assert.match(r.items[0].id,new RegExp('^basic-'+expected+'-'));assert.ok(!r.items[0].why.includes('侧卧肩痛'));assert.ok(r.items[0].why.includes(tag));assert.ok(r.reportedSymptoms.includes('侧卧肩痛'));
 }
});
