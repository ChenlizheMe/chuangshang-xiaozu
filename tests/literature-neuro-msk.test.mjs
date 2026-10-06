import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
import {evidenceFamily} from '../src/symptomLanguage.js';
import {LITERATURE_RULE_IDS} from '../src/literatureTriage.js';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const fields=['feelings','signs','timing','triggers'];
const assess=(part,layer,tags)=>{
 const report={part,layer,...Object.fromEntries(fields.map(field=>[field,tags.filter(tag=>k[field].some(t=>t.id===tag))]))};
 const available=new Set(fields.flatMap(kind=>visibleSymptoms(k,{parts:[part],layer,kind}).map(t=>t.id)));
 for(const tag of tags)assert.ok(available.has(tag),`Input must be selectable: ${part} ${tag}`);
 return assessSymptoms(k,{reports:[report]});
};
const cases=[
 ['hot joint without reported fever','Patella.r','skeleton',['疼痛','红肿','局部发热','突然起病','无法承重'],'same-day'],
 ['headache with fever and progression','Frontal bone','skeleton',['紧箍感','双侧头痛','发热','持续加重'],'same-day'],
 ['headache with neurological change, onset unknown','Frontal bone','skeleton',['跳痛','畏光','复视','肌力下降'],'same-day'],
 ['sudden head pain and diplopia','Frontal bone','skeleton',['跳痛','畏光','复视','突然起病'],'emergency'],
 ['sudden hand weakness','Scaphoid bone.r','skeleton',['拇食中指麻木','肌力下降','突然起病'],'emergency'],
 ['back pain and fever despite posture clues','Lumbar vertebra L3','skeleton',['酸痛','久坐后','活动后缓解','发热'],'same-day'],
 ['exercise muscle and urine warning','Rectus femoris muscle.r','muscle',['酸痛','新运动后1至3天','尿色深','肌力下降'],'emergency'],
 ['injured ankle cannot bear weight','Talus.r','skeleton',['扭伤后','无法承重','局部肿胀'],'same-day'],
 ['injured knee locked','Patella.r','skeleton',['扭伤后','关节卡住'],'same-day']
];
for(const [name,part,layer,tags,level] of cases)test(`literature-derived warning: ${name}`,()=>{
 const r=assess(part,layer,tags);assert.equal(r.triageLevel,level);
 assert.ok(r.items.every(c=>c.priority&&c.advice.zh===r.urgent[0].zh));assert.ok(r.items.every(c=>!c.lifestyle));
});
for(const [name,part,layer,tags] of [
 ['isolated swelling','Patella.r','skeleton',['局部肿胀']],['isolated fever','Patella.r','skeleton',['发热']],
 ['motor onset not supplied','Scaphoid bone.r','skeleton',['拇食中指麻木','肌力下降']],
 ['fatigue is not motor weakness','Scaphoid bone.r','skeleton',['疲劳乏力','突然起病']],
 ['ordinary delayed soreness','Rectus femoris muscle.r','muscle',['酸痛','新运动后1至3天']],
 ['ordinary postural pain','Lumbar vertebra L3','skeleton',['酸痛','久坐后','活动后缓解']],
 ['photophobia alone is not a neurological deficit','Frontal bone','skeleton',['跳痛','畏光']],
 ['ordinary ankle swelling after a twist','Talus.r','skeleton',['扭伤后','局部肿胀']]
])test(`nearby case is not automatically escalated: ${name}`,()=>assert.equal(assess(part,layer,tags).triageLevel,null));
test('explicit vomiting conflicts with tension-type interpretation without inventing migraine',()=>{
 const r=assess('Frontal bone','skeleton',['紧箍感','双侧头痛','呕吐']);assert.ok(r.items.every(c=>c.basic));
 for(const extra of ['畏光','恶心'])assert.ok(assess('Frontal bone','skeleton',['紧箍感','双侧头痛',extra]).items.some(c=>c.id==='head-pressure-pattern'));
});
test('a symmetric sensory pattern requires actual distribution rather than inferred model laterality',()=>{
 assert.ok(!assess('Tibia.l','skeleton',['灼烧','感觉减退']).items.some(c=>c.id==='peripheral-neuropathy'));
 assert.ok(assess('Tibia.l','skeleton',['麻木','双侧手足对称']).items.some(c=>c.id==='peripheral-neuropathy'));
});
test('down-leg radiation is not an independent second observation or an unreported fact',()=>{
 assert.equal(evidenceFamily('沿腿向下'),evidenceFamily('放射痛'));
 for(const tags of [['放射痛','麻木'],['放射痛','沿腿向下']])assert.ok(!assess('Lumbar vertebra L3','skeleton',tags).items.some(c=>c.id==='sciatic-neuralgia'));
 assert.ok(assess('Lumbar vertebra L3','skeleton',['放射痛','沿腿向下','麻木']).items.some(c=>c.id==='sciatic-neuralgia'));
});
test('reference descriptions do not invent elbow localization, bilateral symptoms or a gait finding',()=>{
 const u=assess('Scaphoid bone.r','skeleton',['无名小指麻木','夜间麻木']).items.find(c=>c.id==='ulnar-nerve-irritation');assert.ok(u);assert.doesNotMatch(u.name.zh,/肘部/);
 const cord=assess('Lumbar vertebra L3','skeleton',['排尿困难','放射痛']).items.find(c=>c.id==='spinal-cord-warning');assert.ok(cord);assert.doesNotMatch(cord.shortDescription.zh,/双侧|步态不稳/);
});

test('every added disposition rule has an explicit source scope and regression reference',()=>{
 const review=JSON.parse(fs.readFileSync(new URL('../data/evidence-review-2026-10.json',import.meta.url)));
 for(const id of LITERATURE_RULE_IDS){const entry=review.entries.find(e=>e.rules?.includes(id));assert.ok(entry,id);assert.ok(entry.sources.length);assert.ok(entry.positiveExamples.length);assert.ok(entry.negativeExamples.length);assert.ok(entry.tests.length);}
});

test('generic repetitive use is not silently relabeled as a recent exercise episode',()=>{
 const r=assess('Rectus femoris muscle.r','muscle',['酸痛','反复用力','尿色深','肌力下降']);
 assert.ok(!r.urgent.some(w=>w.id==='exercise-muscle-urine-warning'));
});

test('the same exercise/urine/strength warning does not depend on selecting a bone or muscle model',()=>{
 for(const [part,layer] of [['Tibia.l','skeleton'],['Rectus femoris muscle.r','muscle']]){
  const r=assess(part,layer,['酸痛','新运动后1至3天','尿色深','肌力下降']);
  assert.equal(r.triageLevel,'emergency');assert.ok(r.urgent.some(w=>w.id==='exercise-muscle-urine-warning'));
 }
});
test('a swollen purulent joint area does not need an extra selected heat or fever observation',()=>{
 const r=assess('Patella.r','skeleton',['局部肿胀','局部压痛','流脓']);
 assert.equal(r.triageLevel,'same-day');assert.ok(r.urgent.some(w=>w.id==='hot-swollen-joint'));
 assert.ok(r.items.every(item=>item.priority));
});
