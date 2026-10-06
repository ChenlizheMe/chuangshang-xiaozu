import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';import {visibleSymptoms} from '../src/symptomFilters.js';import {clinicalProfile} from '../src/clinicalRegions.js';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));const fields=['feelings','signs','timing','triggers'];
const assess=(part,layer,tags)=>{const available=new Set(fields.flatMap(kind=>visibleSymptoms(k,{parts:[part],layer,kind}).map(t=>t.id)));for(const tag of tags)assert.ok(available.has(tag),`${part}: ${tag}`);return assessSymptoms(k,{reports:[{part,layer,...Object.fromEntries(fields.map(f=>[f,tags.filter(t=>k[f].some(x=>x.id===t))]))}]});};
test('actual unable-to-pass-urine observation is immediately assessed across existing regions',()=>{
 for(const [part,layer]of [['Rectus abdominis muscle.r','muscle'],['Anterior longitudinal ligament','skeleton'],['Levator ani.or','muscle']]){const a=assess(part,layer,['排尿困难']);assert.equal(a.triageLevel,'emergency');assert.ok(a.items.every(x=>x.advice.zh===a.urgent[0].zh));assert.match(a.urgent[0].zh,/尿不出来/);}
});
test('all actual urinary-organ meshes expose the same existing inability observation',()=>{
 const b=fs.readFileSync(new URL('../public/anatomy/organs-mobile.glb',import.meta.url));const doc=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
 const names=doc.nodes.filter(n=>n.mesh!==undefined&&['kidney','ureter','bladder'].includes(clinicalProfile(n.name,'organ').organ)).map(n=>n.name);assert.equal(names.length,8);
 for(const part of names)assert.equal(assess(part,'organ',['排尿困难']).triageLevel,'emergency',part);
});
test('reduced volume or frequency alone is not relabeled inability to urinate',()=>{
 for(const [part,tag]of [['Kidney.l','尿频'],['Urinary bladder','尿频'],['Urinary bladder','尿急']])assert.notEqual(assess(part,'organ',[tag]).triageLevel,'emergency');
 assert.notEqual(assess('Rectus abdominis muscle.r','muscle',['尿量减少']).triageLevel,'emergency');
 // API defense only: reduced-volume input is not currently offered by urinary-organ selectors.
 for(const tag of ['尿量减少','尿急'])assert.notEqual(assessSymptoms(k,{reports:[{part:'Kidney.l',layer:'organ',signs:[tag]}]}).triageLevel,'emergency');
});
test('saddle warning remains independent and highest priority is monotonic',()=>{
 const part='Anterior longitudinal ligament';const a=assess(part,'skeleton',['会阴麻木']);assert.equal(a.triageLevel,'emergency');
 const b=assess(part,'skeleton',['会阴麻木','排尿困难']);assert.equal(b.triageLevel,'emergency');assert.ok(b.urgent.some(x=>x.id==='unable-to-urinate'));
});
