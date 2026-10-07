import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';import {visibleSymptoms} from '../src/symptomFilters.js';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const cases=[
 ['gastroenteritis-pattern',{part:'Rectus abdominis muscle.r',layer:'muscle',signs:['腹泻','发热']},['绞痛','恶心','呕吐']],
 ['renal-colic-pattern',{part:'Kidney.r',layer:'organ',feelings:['绞痛'],signs:['血尿']},['腰腹向腹股沟放射']],
 ['joint-inflammation',{part:'Patella.r',layer:'skeleton',signs:['红肿','活动受限']},['疼痛','局部发热']],
 ['minor-injury-bruise',{part:'Humerus.r',layer:'skeleton',feelings:['疼痛'],triggers:['外伤后']},['淤青','局部压痛','局部肿胀']]
];
for(const [id,report,notReported] of cases)test(`reference pattern does not turn possible features into patient facts: ${id}`,()=>{
 for(const field of ['feelings','signs','timing','triggers']){const available=new Set(visibleSymptoms(k,{parts:[report.part],layer:report.layer,kind:field}).map(t=>t.id));for(const tag of report[field]||[])assert.ok(available.has(tag),tag);}
 const item=assessSymptoms(k,{reports:[report]}).items.find(c=>c.id===id);assert.ok(item,'the existing evidence gate is unchanged');
 for(const tag of notReported)assert.ok(!item.why.includes(tag));assert.match(item.shortDescription.zh,/可/);assert.match(item.shortDescription.en,/may /);
});
test('the existing delayed-soreness observation supports one broad card without becoming two diagnostic facts',()=>{
 for(const [part,layer] of [['Rectus femoris muscle.r','muscle'],['Tibia.r','skeleton']]){
  const report={part,layer,timing:['新运动后1至3天']};assert.ok(visibleSymptoms(k,{parts:[part],layer,kind:'timing'}).some(t=>t.id==='新运动后1至3天'));
  const a=assessSymptoms(k,{reports:[report]});assert.equal(a.triageLevel,null);assert.equal(a.items.length,1);assert.ok(a.items[0].basic);assert.deepEqual(a.items[0].why,['新运动后1至3天']);assert.deepEqual(a.items[0].evidenceFamilies,['exercise']);
  const warning=assessSymptoms(k,{reports:[{...report,signs:['尿色深','肌力下降']}]});assert.equal(warning.triageLevel,'emergency');
 }
 for(const tag of ['持续1至3天','刚刚开始','持续加重','短暂发作'])assert.deepEqual(assessSymptoms(k,{reports:[{part:'Rectus femoris muscle.r',layer:'muscle',timing:[tag]}]}).items,[]);
});
