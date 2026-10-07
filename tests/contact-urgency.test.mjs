import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
import {assertSelectableStructure} from './helpers/selectable-anatomy.mjs';
const knowledge=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const fields=['feelings','signs','timing','triggers'];
function assess(part,tags){
 assertSelectableStructure(part,'organ');
 const report={part,layer:'organ',location:'unknown'};
 for(const field of fields){
  report[field]=tags.filter(id=>knowledge[field].some(tag=>tag.id===id));
  const visible=new Set(visibleSymptoms(knowledge,{parts:[part],layer:'organ',kind:field}).map(tag=>tag.id));
  for(const id of report[field])assert.ok(visible.has(id),`${part}: ${field}/${id}`);
 }
 return assessSymptoms(knowledge,{reports:[report]});
}
// These are existing disposition/reference boundaries, not clinical validation.
const cases=[
 ['Kidney.l',['血尿'],'prompt','basic-priority-kidney'],
 ['Kidney.r',['血尿'],'prompt','basic-priority-kidney'],
 ['Urinary bladder',['血尿'],'prompt','basic-priority-bladder'],
 ['Kidney.l',['血尿','发热'],'same-day','basic-priority-kidney'],
 ['Kidney.l',['血尿','发冷'],'same-day','basic-priority-kidney'],
 ['Urinary bladder',['血尿','排尿困难'],'emergency','basic-priority-bladder'],
 ['Kidney.l',['血尿','晕厥'],'emergency','basic-priority-kidney'],
 ['Kidney.l',['绞痛','血尿','发热'],'emergency','renal-colic-pattern'],
 ['Kidney.l',['尿色深'],null,'basic-systemic-kidney'],
 ['Urinary bladder',['尿频'],null,'basic-urinary-bladder'],
 ['Liver',['黄疸'],'prompt','basic-priority-liver'],
 ['Gallbladder',['黄疸'],'prompt','basic-priority-biliary'],
 ['Liver',['黄疸','发热'],'same-day','basic-priority-liver'],
 ['Liver',['黄疸','发冷'],'same-day','basic-priority-liver'],
 ['Gallbladder',['疼痛','黄疸','发热'],'emergency','biliary-colic-pattern'],
 ['Liver',['黄疸','晕厥'],'emergency','basic-priority-liver'],
 ['Liver',['尿色深'],null,'basic-systemic-liver'],
 ['Liver',['苍白便'],null,'basic-abdomen-liver'],
 ['Liver',['黄疸','尿色深'],'prompt','hepatobiliary-pattern']
];
for(const [part,tags,level,id] of cases)test(`contact wording preserves existing disposition and reference: ${part}/${tags.join('+')}`,()=>{
 const result=assess(part,tags);assert.equal(result.triageLevel,level);assert.deepEqual(result.items.map(item=>item.id),[id]);
 for(const item of result.items){
  assert.ok(item.why.every(tag=>tags.includes(tag)),'unreported observations are not added');
  if(level)for(const lang of ['zh','en'])assert.equal(item.advice[lang],result.urgent[0][lang]);
 }
 const contact=result.urgent.filter(warning=>warning.level==='prompt');
 for(const warning of contact){
  assert.match(warning.zh,/今天联系医疗机构分诊/);assert.match(warning.en,/contact a medical service today for triage/);
  assert.match(warning.zh,/由医护确定/);assert.match(warning.en,/so a clinician can/);
  assert.match(warning.zh,/既往.*随访安排/);assert.match(warning.en,/follow-up plan/);
 }
 if(level==='emergency')assert.equal(result.urgent[0].level,'emergency','contact advice cannot displace emergency action');
 if(!tags.includes('血尿')&&!tags.includes('黄疸'))assert.equal(contact.length,0,'dark urine/frequency/pale stool cannot invent either finding');
});
test('contact guidance retains the existing safety net without assigning a blood subtype or cause',()=>{
 const blood=assess('Kidney.l',['血尿']).urgent[0],jaundice=assess('Liver',['黄疸']).urgent[0];
 assert.ok(blood.zh.endsWith('伴发热或排尿变化应当日评估；如剧痛或无法排尿，立即急诊。'));
 assert.ok(blood.en.endsWith('Fever or urinary changes need same-day assessment; severe pain or inability to pass urine needs emergency care.'));
 assert.ok(jaundice.zh.endsWith('伴发热或明显腹痛应急诊。'));
 assert.ok(jaundice.en.endsWith('Fever or significant abdominal pain needs urgent care.'));
 assert.match(blood.zh,/发现方式/);assert.match(blood.en,/how it was found/);
 assert.match(jaundice.zh,/发现时间/);assert.match(jaundice.en,/when it was noticed/);
 for(const warning of [blood,jaundice]){
  assert.doesNotMatch(warning.zh,/已确认|低风险|没有警示|已排除|确诊癌症/);
  assert.doesNotMatch(warning.en,/confirmed low risk|no warning signs|ruled out|diagnosed cancer/i);
 }
});
