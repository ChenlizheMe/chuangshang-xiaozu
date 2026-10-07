import {assertSelectableStructure} from './helpers/selectable-anatomy.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';import {visibleSymptoms} from '../src/symptomFilters.js';import {evidenceFamily,LOCAL_PAIN_TAGS,hasReportedPain} from '../src/symptomLanguage.js';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url))),fields=['feelings','signs','timing','triggers'];
const report=(part,layer,tags,location='unknown')=>({part,layer,location,...Object.fromEntries(fields.map(field=>[field,tags.filter(tag=>k[field].some(t=>t.id===tag))]))});
const assess=r=>assessSymptoms(k,{reports:[r]});
const available=r=>{assertSelectableStructure(r.part,r.layer);for(const field of fields){const visible=new Set(visibleSymptoms(k,{parts:[r.part],layer:r.layer,kind:field}).map(t=>t.id));for(const tag of r[field])assert.ok(visible.has(tag),`${r.part}: ${tag}`);}};
test('biting is still one pain evidence family, but not arbitrary local pain',()=>{
 assert.equal(evidenceFamily('咬合痛'),evidenceFamily('疼痛'));assert.ok(!LOCAL_PAIN_TAGS.has('咬合痛'));assert.equal(hasReportedPain(new Set(['咬合痛'])),false);
 for(const part of ['Lower canine.l','Mandible'])assert.ok(assess(report(part,'skeleton',['疼痛','咬合痛'])).items.every(c=>c.basic));
});
for(const [part,layer,tags,location,forbidden] of [
 ['Humerus.l','skeleton',['咬合痛','外伤后'],'unknown','minor-injury-bruise'],
 ['Patella.l','skeleton',['咬合痛','上下楼加重'],'unknown','patellofemoral-pain'],
 ['Rectus abdominis muscle.r','muscle',['咬合痛','持续加重'],'rlq','appendicitis-pattern'],
 ['Spleen','organ',['咬合痛','外伤后'],'unknown','splenic-injury-warning'],
 ['Sternocleidomastoid muscle.l','muscle',['咬合痛','久坐后'],'unknown','neck-muscle-tension']
])test(`legacy biting input does not fabricate local pain: ${part}`,()=>{
 const r=report(part,layer,tags,location),a=assess(r);assert.equal(a.triageLevel,null);assert.ok(!a.items.some(c=>c.id===forbidden));assert.ok(a.items.every(c=>c.basic));assert.ok(a.items[0].matchedSymptoms.includes('咬合痛'));assert.match(a.items[0].shortDescription.zh,/咬东西时痛/);assert.match(a.items[0].shortDescription.en,/Pain on biting/);
});
test('the same existing option is restricted to dental, jaw and head/neck referral entries',()=>{
 for(const [part,layer] of [['Lower canine.l','skeleton'],['Mandible','skeleton'],['Incus.l','skeleton'],['Frontal bone','skeleton'],['Vertebra C3','skeleton']])available(report(part,layer,['咬合痛']));
 for(const [part,layer] of [['Humerus.l','skeleton'],['Patella.l','skeleton'],['Vertebra L3','skeleton'],['Rectus abdominis muscle.r','muscle'],['Spleen','organ'],['Pancreas','organ'],['Gallbladder','organ']]){assertSelectableStructure(part,layer);assert.ok(!visibleSymptoms(k,{parts:[part],layer,kind:'feelings'}).some(t=>t.id==='咬合痛'));}
});
for(const [part,tags,id] of [
 ['Lower canine.l',['咬合痛','牙龋洞'],'dental-caries'],['Lower canine.l',['咬合痛','外伤后'],'dental-fracture'],['Lower canine.l',['咬合痛','牙龈肿胀'],'dental-abscess'],['Mandible',['咬合痛','张口弹响'],'tmj-dysfunction'],['Incus.l',['疼痛','耳道流液'],'ear-infection-pattern']
])test(`existing independent evidence still reaches ${id}`,()=>{const r=report(part,'skeleton',tags);available(r);assert.ok(assess(r).items.some(c=>c.id===id));});
test('reported biting pain and systemic fever keeps same-day advice without diagnosing an ear or local infection',()=>{
 for(const part of ['Lower canine.l','Mandible','Incus.l','Frontal bone','Vertebra C3','Humerus.l']){
  const a=assess(report(part,'skeleton',['咬合痛','发热']));assert.equal(a.triageLevel,'same-day');assert.ok(!a.items.some(c=>c.id==='ear-infection-pattern'));
  if(!['Lower canine.l','Mandible'].includes(part))assert.ok(a.urgent.some(w=>w.id==='biting-pain-fever-review'));
 }
 for(const part of ['Incus.l','Frontal bone','Vertebra C3'])assert.equal(assess(report(part,'skeleton',['咬合痛'])).triageLevel,null);
});
test('independent local pain, bruising, urinary and skin observations keep their own assessment',()=>{
 for(const tags of [['咬合痛','疼痛','外伤后'],['咬合痛','外伤后','淤青']]){
  const a=assess(report('Humerus.l','skeleton',tags)),c=a.items.find(c=>c.id==='minor-injury-bruise');assert.ok(c);assert.ok(!c.why.includes('咬合痛'));assert.match(c.shortDescription.zh,/已报告咬东西时痛/);
 }
 for(const [tags,id] of [[['咬合痛','尿频'],'basic-urinary-spine'],[['咬合痛','皮疹'],'basic-skin-spine'],[['咬合痛','疼痛'],'basic-spine-spine'],[['咬合痛','疲劳乏力'],'basic-fatigue-spine'],[['咬合痛','体重下降'],'basic-systemic-spine']]){
  const a=assess(report('Lumbar vertebra L3','skeleton',tags));assert.equal(a.items[0].id,id);assert.match(a.items[0].shortDescription.zh,/已报告咬东西时痛/);assert.deepEqual(a.items[0].why,tags.filter(tag=>tag!=='咬合痛'));
 }
 const arm=assess(report('Humerus.l','skeleton',['咬合痛','疼痛'])).items[0];assert.deepEqual(arm.why,['疼痛']);assert.ok(arm.matchedSymptoms.includes('咬合痛'));
});
test('separate explicit danger facts are retained even in a legacy wrong-region report',()=>{
 for(const [part,layer,tags,level] of [['Humerus.l','skeleton',['咬合痛','呼吸困难'],'emergency'],['Incus.l','skeleton',['咬合痛','突然听力下降'],'same-day'],['Pancreas','organ',['咬合痛','向背部放射','呕吐'],'same-day'],['Incus.l','skeleton',['咬合痛','发热','突然单侧无力'],'emergency']])assert.equal(assess(report(part,layer,tags)).triageLevel,level);
});
