import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {orderPriorityGuidance,applyPriorityGuidance} from '../src/priorityGuidance.js';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const run=(part,layer,tags,location='unknown')=>assessSymptoms(k,{reports:[{part,layer,location,feelings:tags}]});
const cases=[
 ['emergency','Sternum','skeleton',['压迫感','气短']],
 ['same-day','Tibia.l','skeleton',['单侧肿胀']],
 ['prompt','Kidney.l','organ',['血尿']],
 ['prompt','Oesophagus','organ',['吞咽困难']],
 ['same-day','Patella.r','skeleton',['局部肿胀','发热','活动受限']],
 ['emergency','Rectus abdominis muscle.r','muscle',['疼痛','运动后','突发剧痛']],
 ['same-day','Rectus abdominis muscle.r','muscle',['绞痛','排便后缓解','腹泻','反复数月','持续加重'],'rlq']
];
for(const [level,part,layer,tags,location] of cases)test(`disposition overrides conflicting reference advice: ${part} / ${level} / ${tags.join('+')}`,()=>{
 const result=run(part,layer,tags,location);assert.equal(result.triageLevel,level);assert.ok(result.items.length);
 for(const item of result.items){assert.equal(item.priority,true);assert.equal(item.priorityLevel,level);assert.deepEqual(item.advice,{zh:result.urgent[0].zh,en:result.urgent[0].en});assert.match(item.threshold.zh,/参考匹配/);}
});
test('ordinary inputs keep existing non-priority advice and do not acquire urgency',()=>{
 const result=run('Lumbar vertebra L3','skeleton',['酸痛','久坐后','活动后缓解']);
 assert.equal(result.triageLevel,null);assert.deepEqual(result.urgent,[]);assert.ok(result.items.some(c=>c.id==='sitting-posture'));
 assert.ok(result.items.every(c=>!c.priority));
});
test('coexisting prompt and emergency observations display the more urgent actual guidance first',()=>{
 const result=run('Kidney.l','organ',['血尿','晕厥']);
 assert.equal(result.triageLevel,'emergency');assert.equal(result.urgent[0].level,'emergency');
 assert.ok(result.urgent.some(w=>w.level==='prompt'));assert.ok(result.items.every(c=>c.advice.zh===result.urgent[0].zh));
});
test('ordering dispositions does not mutate warnings or reference data',()=>{
 const warnings=[{zh:'soon',en:'soon',level:'prompt'},{zh:'today',en:'today',level:'same-day'},{zh:'now',en:'now',level:'emergency'}];
 const before=structuredClone(warnings);const result=orderPriorityGuidance(warnings);assert.deepEqual(result.map(w=>w.level),['emergency','same-day','prompt']);assert.deepEqual(warnings,before);
 const item={id:'reference',advice:{zh:'ordinary',en:'ordinary'}};applyPriorityGuidance([item],result);assert.equal(item.advice.zh,'ordinary');
});

test('duplicate wording cannot downgrade the higher-priority disposition',()=>{
 const result=orderPriorityGuidance([{zh:'same',en:'same',level:'prompt'},{zh:'same',en:'same',level:'emergency'}]);
 assert.equal(result.length,1);assert.equal(result[0].level,'emergency');
});

for(const [part,tags,expected] of [['Liver',['黄疸','发热'],'same-day'],['Kidney.l',['血尿','发热'],'same-day'],['Liver',['黄疸'],'prompt'],['Kidney.l',['血尿'],'prompt']])test(`selected escalation facts determine the current tier: ${part} / ${tags.join('+')}`,()=>{
 const result=run(part,'organ',tags);assert.equal(result.triageLevel,expected);
 assert.ok(result.items.every(item=>item.priorityLevel===expected));
});
test('pregnancy and actual shoulder-tip pain escalate beyond the conditional safety net',()=>{
 const result=run('Rectus abdominis muscle.r','muscle',['疼痛','可能怀孕','肩尖痛'],'llq');
 assert.equal(result.triageLevel,'emergency');assert.match(result.urgent[0].zh,/立即急诊/);
});

test('location, timing or pregnancy possibility alone do not invent abdominal pain',()=>{
 for(const [tags,location] of [[['持续加重'],'rlq'],[['可能怀孕'],'unknown'],[['可能怀孕','持续数小时'],'unknown']]){
  const result=run('Rectus abdominis muscle.r','muscle',tags,location);assert.deepEqual(result.urgent,[]);assert.deepEqual(result.items,[]);
 }
 assert.equal(run('Rectus abdominis muscle.r','muscle',['疼痛','可能怀孕']).triageLevel,'same-day');
 assert.equal(run('Rectus abdominis muscle.r','muscle',['腹痛迁移至右下腹']).triageLevel,'same-day');
});
