import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const run=(part,layer,tags)=>assessSymptoms(k,{reports:[{part,layer,feelings:tags}]});
for(const [part,layer] of [['Anterior longitudinal ligament','skeleton'],['Pectineus muscle.r','muscle'],['Levator ani.or','muscle'],['Rectus abdominis muscle.r','muscle'],['Urinary bladder','organ']]){
 for(const symptom of ['尿痛','尿频','尿急'])test(`single urinary symptom stays broad and is not called a strain: ${part} / ${symptom}`,()=>{
  const result=run(part,layer,[symptom]);assert.equal(result.items.length,1);
  const card=result.items[0];assert.ok(card.basic);assert.match(card.name.zh,/排尿/);
  assert.deepEqual(card.why,[symptom]);assert.match(card.advice.zh,/安排评估/);
  assert.ok(!result.items.some(c=>c.id==='urinary-tract-infection-pattern'));
 });
}
for(const [part,layer] of [['Anterior longitudinal ligament','skeleton'],['Pectineus muscle.r','muscle'],['Kidney.l','organ']])test(`isolated flank pain retains musculoskeletal and urinary possibilities: ${part}`,()=>{
 const result=run(part,layer,['侧腰痛']);assert.equal(result.items.length,1);
 assert.ok(result.items[0].basic);assert.match(result.items[0].name.zh,/肌骨与尿路/);
 assert.deepEqual(result.items[0].why,['侧腰痛']);assert.equal(result.urgent.length,0);
 for(const flag of ['发热','血尿']){
  const flagged=run(part,layer,['侧腰痛',flag]);assert.ok(flagged.urgent.length);
  assert.ok(!flagged.items.some(c=>c.id.startsWith('basic-flank')));
 }
});
test('urinary findings cannot be explained away by a posture match',()=>{
 const result=run('Anterior longitudinal ligament','skeleton',['酸痛','久坐后','活动后缓解','尿痛']);
 assert.ok(result.items.every(c=>c.basic));assert.match(result.items[0].name.zh,/排尿/);
});
test('urinary fever preserves priority while ordinary paired symptoms retain the existing UTI reference',()=>{
 const urgent=run('Anterior longitudinal ligament','skeleton',['尿痛','发热']);assert.ok(urgent.urgent.length);
 assert.ok(urgent.items.every(c=>!c.id.startsWith('basic-urinary')));
 assert.ok(run('Anterior longitudinal ligament','skeleton',['尿痛','尿频']).items.some(c=>c.id==='urinary-tract-infection-pattern'));
});

test('the real urinary observation remains visible after other canonical-field inputs',()=>{
 const report={part:'Anterior longitudinal ligament',layer:'skeleton',feelings:['酸痛','麻木','侧腰痛'],signs:['尿频']};
 const card=assessSymptoms(k,{reports:[report]}).items[0];
 assert.ok(card.basic);assert.match(card.name.zh,/排尿/);assert.equal(card.why[0],'尿频');
 assert.ok(card.why.length<=3);assert.equal(new Set(card.evidenceFamilies).size,card.why.length);
 assert.ok(card.why.every(tag=>[...report.feelings,...report.signs].includes(tag)));
});
