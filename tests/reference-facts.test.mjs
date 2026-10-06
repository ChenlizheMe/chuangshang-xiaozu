import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
test('brief episodes mean the same seconds-to-minutes interval in both languages',()=>{
 const t=k.timing.find(t=>t.id==='短暂发作');assert.equal(t.zh,'每次几秒到几分钟');assert.equal(t.en,'Seconds to minutes per episode');
 const urine=k.signs.find(t=>t.id==='排尿困难');assert.equal(urine.zh,'尿不出来');assert.equal(urine.en,'Unable to pass urine');
 const exercise=k.timing.find(t=>t.id==='新运动后1至3天');assert.match(exercise.zh,/酸痛/);assert.match(exercise.en,/Soreness/);
});
test('seconds-to-minutes headache is not labeled typical migraine, while danger actions persist',()=>{
 const report={part:'Frontal bone',layer:'skeleton',feelings:['跳痛'],signs:['畏光']};
 assert.ok(assessSymptoms(k,{reports:[report]}).items.some(c=>c.id==='migraine-pattern'));
 const brief={...report,timing:['短暂发作']};const a=assessSymptoms(k,{reports:[brief]});assert.ok(a.items.every(c=>c.basic));assert.equal(a.triageLevel,null);
 const danger=assessSymptoms(k,{reports:[{...brief,signs:['畏光','发热']}]});assert.equal(danger.triageLevel,'same-day');
});
test('pattern descriptions distinguish uncollected distribution, examination and aura facts',()=>{
 const byId=Object.fromEntries(k.conditions.map(c=>[c.id,c]));
 assert.match(byId['spinal-radiculopathy'].shortDescription.zh,/实际起点、分布/);
 assert.match(byId['trigeminal-neuralgia'].shortDescription.zh,/实际面部分布、侧别/);
 assert.match(byId['foot-plantar-pain'].shortDescription.zh,/已报告起床第一步脚跟痛/);
 assert.match(byId['patellofemoral-pain'].shortDescription.zh,/实际痛点/);
 assert.match(byId['stress-bone-injury'].shortDescription.zh,/不能确认是骨点压痛/);
 assert.match(byId['migraine-pattern'].shortDescription.zh,/不能据视觉变化认定先兆/);
 for(const id of ['spinal-radiculopathy','trigeminal-neuralgia','foot-plantar-pain','patellofemoral-pain','stress-bone-injury','migraine-pattern'])assert.match(byId[id].shortDescription.en,/confirm|examination|established|establish|assessment/i);
});

test('seconds-to-minutes tension-like pain also returns to a broad direction',()=>{
 const report={part:'Frontal bone',layer:'skeleton',feelings:['紧箍感'],signs:['双侧头痛']};
 assert.ok(assessSymptoms(k,{reports:[report]}).items.some(c=>c.id==='head-pressure-pattern'));
 const brief={...report,timing:['短暂发作']};assert.ok(assessSymptoms(k,{reports:[brief]}).items.every(c=>c.basic));
 assert.equal(assessSymptoms(k,{reports:[{...brief,signs:['双侧头痛','突然单侧无力']}]}).triageLevel,'emergency');
});
