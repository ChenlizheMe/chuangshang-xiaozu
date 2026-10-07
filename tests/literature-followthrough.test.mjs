import {assertSelectableStructure} from './helpers/selectable-anatomy.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const fields=['feelings','signs','timing','triggers'];
const assess=(part,layer,tags)=>{
 assertSelectableStructure(part,layer);
 const report={part,layer,...Object.fromEntries(fields.map(f=>[f,tags.filter(t=>k[f].some(o=>o.id===t))]))};
 const visible=new Set(fields.flatMap(kind=>visibleSymptoms(k,{parts:[part],layer,kind}).map(o=>o.id)));
 for(const tag of tags)assert.ok(visible.has(tag),`${part}: ${tag}`);
 return assessSymptoms(k,{reports:[report]});
};
test('reported motor loss warrants examination without assuming acute onset or measured severity',()=>{
 const r=assess('Scaphoid bone.r','skeleton',['拇食中指麻木','肌力下降']);
 assert.equal(r.triageLevel,'prompt');assert.ok(r.items.some(c=>c.id==='carpal-tunnel'));assert.match(r.urgent[0].zh,/核实起病/);
 assert.equal(assess('Scaphoid bone.r','skeleton',['拇食中指麻木','肌力下降','突然起病']).triageLevel,'emergency');
 assert.equal(assess('Scaphoid bone.r','skeleton',['疲劳乏力','突然起病']).triageLevel,null);
});
for(const [part,layer] of [['Vertebra L3','skeleton'],['Longissimus colli muscle.l','muscle']])test(`reported unintentional weight loss with regional pain warrants review: ${part}`,()=>{
 const r=assess(part,layer,['酸痛','久坐后','体重下降']);assert.equal(r.triageLevel,'prompt');
 assert.match(r.urgent[0].zh,/无意中体重下降/);assert.match(r.urgent[0].en,/unintentional weight loss have been reported/);
 assert.equal(assess(part,layer,['体重下降']).triageLevel,null);
 assert.equal(assess(part,layer,['酸痛','久坐后']).triageLevel,null);
 assert.equal(assess(part,layer,['酸痛','体重下降','发热']).triageLevel,'same-day');
});
for(const [part,layer,id] of [
 ['Vertebra L3','skeleton','vertebral-mechanical-pain'],
 ['Longissimus colli muscle.l','muscle','neck-muscle-tension'],
 ['Dorsal parts of lateral intertransversarii lumborum muscles.l','muscle','thoracolumbar-myofascial']
])test(`trauma is not explained by posture alone: ${part}`,()=>{
 assert.ok(assess(part,layer,['酸痛','久坐后']).items.some(c=>c.id===id));
 for(const injury of ['外伤后','扭伤后']){
  const r=assess(part,layer,['酸痛','久坐后',injury]);assert.ok(!r.items.some(c=>c.id===id));assert.notEqual(r.triageLevel,'emergency');
  if(injury==='外伤后')assert.ok(r.items.some(c=>['minor-injury-bruise','muscle-strain'].includes(c.id)));
  else{assert.ok(r.items.every(c=>c.basic));assert.equal(r.items[0].name.zh,'受伤后的颈背不适');assert.match(r.items[0].advice.zh,/避免加重动作或强行拉伸/);assert.doesNotMatch(r.items[0].name.en,/posture|mechanical/i);}
 }
});
test('trigeminal-pattern sensory change prompts assessment without excluding the reference',()=>{
 const tags=['电击','触碰诱发','短暂发作'];
 const ordinary=assess('Frontal bone','skeleton',tags);assert.equal(ordinary.triageLevel,null);
 const r=assess('Frontal bone','skeleton',[...tags,'感觉减退']);assert.equal(r.triageLevel,'prompt');
 assert.ok(r.items.some(c=>c.id==='trigeminal-neuralgia'));assert.match(r.urgent[0].zh,/不等于排除/);
});
