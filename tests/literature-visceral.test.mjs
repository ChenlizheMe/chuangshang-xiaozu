import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const fields=['feelings','signs','timing','triggers'];
const assess=(part,layer,location,tags)=>{
 const report={part,layer,location,...Object.fromEntries(fields.map(field=>[field,tags.filter(tag=>k[field].some(t=>t.id===tag))]))};
 const visible=new Set(fields.flatMap(kind=>visibleSymptoms(k,{parts:[part],layer,kind}).map(t=>t.id)));
 for(const tag of tags)assert.ok(visible.has(tag),`${part}: ${tag} must be reachable`);
 return assessSymptoms(k,{reports:[report]});
};
const cases=[
 ['blood vomiting cannot be hidden by chest selection','Sternum','skeleton','unknown',['呕血'],'emergency'],
 ['left upper trauma','Rectus abdominis muscle.l','muscle','luq',['疼痛','外伤后'],'same-day'],
 ['splenic area trauma with shoulder pain','Spleen','organ','unknown',['肩尖痛','外伤后'],'emergency'],
 ['renal colic with fever','Kidney.l','organ','unknown',['绞痛','腰腹向腹股沟放射','发热'],'emergency'],
 ['ureteric colic with chills','Ureter.l','organ','unknown',['绞痛','腰腹向腹股沟放射','发冷'],'emergency'],
 ['right upper pain with fever','Rectus abdominis muscle.r','muscle','ruq',['疼痛','发热'],'same-day'],
 ['biliary area fever','Gallbladder','organ','unknown',['疼痛','发热'],'same-day'],
 ['biliary area pain fever and jaundice','Gallbladder','organ','unknown',['疼痛','发热','黄疸'],'emergency'],
 ['worsening upper pain vomiting without reported radiation','Pancreas','organ','unknown',['疼痛','呕吐','持续加重'],'same-day'],
 ['constipation fever','Descending colon','organ','llq',['便秘','干硬便','发热'],'same-day'],
 ['constipation vomiting','Descending colon','organ','llq',['便秘','干硬便','呕吐'],'same-day'],
 ['epigastric pressure cold sweat onset unspecified','Rectus abdominis muscle.r','muscle','epigastric',['压迫感','冷汗','恶心'],'same-day'],
 ['sudden epigastric pressure cold sweat','Rectus abdominis muscle.r','muscle','epigastric',['压迫感','冷汗','恶心','突然起病'],'emergency']
];
for(const [name,part,layer,location,tags,level] of cases)test(`professional visceral source boundary: ${name}`,()=>{
 const r=assess(part,layer,location,tags);assert.equal(r.triageLevel,level);assert.ok(r.items.every(c=>c.priority&&c.advice.zh===r.urgent[0].zh));
 assert.ok(!r.items.some(c=>c.lifestyle));
});
for(const [name,part,layer,location,tags] of [
 ['ordinary reflux','Stomach','organ','unknown',['反酸','灼烧']],
 ['ordinary constipation','Descending colon','organ','llq',['便秘','干硬便']],
 ['frequency alone','Urinary bladder','organ','unknown',['尿频']],
 ['meal-related upper fullness and nausea','Stomach','organ','unknown',['餐后饱胀','恶心']],
 ['upper pressure without cold sweat','Rectus abdominis muscle.r','muscle','epigastric',['压迫感','恶心']],
 ['old trauma tag without actual pain','Spleen','organ','unknown',['外伤后']],
 ['generic back colic without fever','Lumbar vertebra L3','skeleton','flank',['绞痛']],
 ['fever at an abdominal location without pain','Rectus abdominis muscle.r','muscle','ruq',['发热']]
])test(`neighboring visceral input is not escalated without the reviewed combination: ${name}`,()=>assert.equal(assess(part,layer,location,tags).triageLevel,null));
test('the existing pancreatic reference accepts left upper as well as epigastric symptoms',()=>{
 for(const location of ['luq','epigastric']){
  const r=assess('Rectus abdominis muscle.l','muscle',location,['疼痛','向背部放射','呕吐']);
  assert.ok(r.items.some(c=>c.id==='pancreatitis-pattern'));assert.equal(r.triageLevel,'same-day');
 }
 const r=assess('Rectus abdominis muscle.l','muscle','llq',['疼痛','向背部放射','呕吐']);assert.ok(!r.items.some(c=>c.id==='pancreatitis-pattern'));
});

const sourceCases=JSON.parse(fs.readFileSync(new URL('./fixtures/visceral-source-cases.json',import.meta.url)));
for(const c of sourceCases.cases)test(`independent visceral reference/evidence case: ${c.name}`,()=>{
 const tags=fields.flatMap(field=>c.report[field]);
 const r=assess(c.report.part,c.report.layer,c.report.location,tags);
 assert.equal(r.items.some(item=>item.id===c.conditionId),c.shouldMatch);
});

test('an explicitly painful radiation label does not require a redundant generic pain checkbox',()=>{
 for(const tags of [['向背部放射','呕吐'],['向背部放射','呕吐','持续加重']]){
  const r=assess('Pancreas','organ','unknown',tags);assert.equal(r.triageLevel,'same-day');
  assert.ok(!r.items.some(c=>c.id==='pancreatitis-pattern'),'reference gate is not loosened by the triage semantic fix');
 }
 const r=assess('Pancreas','organ','unknown',['呕吐','持续加重']);assert.equal(r.triageLevel,null,'timing still does not invent pain');
});
test('exertional chest-pressure wording is real chest discomfort for triage',()=>{
 for(const [part,layer,tags] of [['Heart','organ',['运动诱发胸闷','冷汗']],['Sternum','skeleton',['运动诱发胸闷','气短']]]){
  const r=assess(part,layer,'unknown',tags);assert.equal(r.triageLevel,'emergency');assert.ok(!r.items.some(c=>c.id==='cardiac-ischaemia-warning'));
 }
 const r=assess('Heart','organ','unknown',['运动诱发胸闷']);assert.equal(r.triageLevel,'same-day');assert.ok(r.items.every(c=>c.basic));
});

test('chest tenderness is reported pain but does not by itself create an emergency',()=>{
 const r=assess('Sternum','skeleton','unknown',['局部压痛','活动诱发','气短']);assert.equal(r.triageLevel,'emergency');
 assert.ok(r.items.every(c=>c.priority));
 assert.equal(assess('Sternum','skeleton','unknown',['局部压痛','活动诱发']).triageLevel,null);
});
test('pain at a named remote site is not silently relabeled as local upper abdominal pain',()=>{
 for(const tag of ['肩尖痛','侧腰痛','腰腹向腹股沟放射']){
  const r=assess('Rectus abdominis muscle.r','muscle','epigastric',[tag,'呕吐','持续加重']);
  assert.ok(!r.urgent.some(w=>w.id==='upper-abdominal-pain-vomiting'));
 }
});

test('pain already expressed by a timing or trigger label is not erased from triage',()=>{
 for(const pain of ['油腻餐后痛','进食后腹痛']){
  const r=assess('Rectus abdominis muscle.r','muscle','ruq',[pain,'发热']);assert.equal(r.triageLevel,'same-day');
  assert.equal(assess('Rectus abdominis muscle.r','muscle','ruq',[pain]).triageLevel,null);
 }
 assert.equal(assess('Rectus abdominis muscle.l','muscle','luq',['转身牵拉痛','外伤后']).triageLevel,'same-day');
 assert.equal(assess('Sternum','skeleton','unknown',['新运动后1至3天','气短']).triageLevel,'emergency');
 assert.equal(assess('Sternum','skeleton','unknown',['新运动后1至3天']).triageLevel,null);
});
