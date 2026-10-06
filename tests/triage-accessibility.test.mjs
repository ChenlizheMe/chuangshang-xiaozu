import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
import {PAIN_TAGS} from '../src/symptomLanguage.js';
const knowledge=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const allVisible=(part,layer)=>['feelings','signs','timing','triggers'].flatMap(kind=>visibleSymptoms(knowledge,{parts:[part],layer,kind}).map(t=>t.id));
const assess=(part,layer,tags)=>assessSymptoms(knowledge,{reports:[{part,layer,feelings:tags}]});
const cases=[
 ['sudden persistent chest pain','Sternum','skeleton',['疼痛','突然起病','持续数小时']],
 ['abdominal wall sudden severe pain','Rectus abdominis muscle.r','muscle',['突发剧痛']],
 ['tooth breathing difficulty','Upper first molar tooth.r','skeleton',['呼吸困难']],
 ['tooth swallowing difficulty','Upper first molar tooth.r','skeleton',['吞咽困难']],
 ['pelvic pregnancy and fainting','Levator ani.or','muscle',['疼痛','可能怀孕','晕厥']],
 ['pelvic black stool','Levator ani.or','muscle',['疼痛','黑便']],
 ['pelvic sudden severe pain','Levator ani.or','muscle',['突发剧痛']],
 ['flank pain with fever','Lumbar vertebra L3','skeleton',['侧腰痛','发热']],
 ['back colic with blood in urine','Lumbar vertebra L3','skeleton',['绞痛','血尿']],
];
for(const [name,part,layer,tags] of cases)test(`existing selectors reach triage: ${name}`,()=>{
 const visible=allVisible(part,layer);for(const tag of tags)assert.ok(visible.includes(tag),`${part}: hidden ${tag}`);
 const result=assess(part,layer,tags);assert.ok(result.urgent.length,`${name}: missing priority guidance`);
 assert.ok(!result.items.some(item=>item.lifestyle));
 assert.ok(!result.items.some(item=>item.id==='basic-spine-spine'||item.id==='basic-pelvis-pelvis'));
});
const chestPain=[...PAIN_TAGS,'放射痛','突发剧痛'].filter(tag=>knowledge.feelings.some(t=>t.id===tag));
for(const pain of chestPain)test(`chest triage does not depend on pain synonym: ${pain}`,()=>{
 for(const sign of ['气短','冷汗','恶心','出汗']){
  const tags=allVisible('Sternum','skeleton');assert.ok(tags.includes(sign),`hidden ${sign}`);
  assert.ok(assess('Sternum','skeleton',[pain,sign]).urgent.length,`${pain} + ${sign}`);
 }
});
for(const [name,part,layer,tags] of [
 ['sudden chest pain without persistence input','Sternum','skeleton',['疼痛','突然起病','刚刚开始']],
 ['isolated chest ache','Sternum','skeleton',['酸痛']],
 ['isolated chest nausea','Sternum','skeleton',['恶心']],
 ['local tooth tension','Upper first molar tooth.r','skeleton',['紧绷']],
 ['postural back ache','Lumbar vertebra L3','skeleton',['酸痛','久坐后']],
 ['isolated flank pain','Lumbar vertebra L3','skeleton',['侧腰痛']],
 ['pelvic muscle tension','Levator ani.or','muscle',['紧绷']],
])test(`neighboring input does not falsely trigger emergency triage: ${name}`,()=>{
 assert.equal(assess(part,layer,tags).urgent.length,0);
});


test('dental triage additions preserve existing cranial swallowing inputs',()=>{
 for(const part of ['Frontal bone','Temporal bone.r'])assert.ok(allVisible(part,'skeleton').includes('吞咽困难'));
});
