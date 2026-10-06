import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {clinicalProfile} from '../src/clinicalRegions.js';import {assessSymptoms} from '../src/clinicalEngine.js';import {visibleSymptoms} from '../src/symptomFilters.js';import {evidenceFamily} from '../src/symptomLanguage.js';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));const fields=['feelings','signs','timing','triggers'];
const meshNames=file=>{const b=fs.readFileSync(new URL(`../public/anatomy/${file}`,import.meta.url));return JSON.parse(b.subarray(20,20+b.readUInt32LE(12))).nodes.filter(n=>n.mesh!==undefined).map(n=>n.name);};
const groups=[[/pectoralis major/i,'chest'],[/iliocostalis (?:colli|cervicis)/i,'neck'],[/iliocostalis (?:lumborum|thoracis)/i,'spine'],[/digastric|sternothyroid/i,'throat'],[/pronator teres/i,'upper-limb'],[/opponens digiti minimi muscle of foot/i,'foot']];
for(const file of ['muscular_male.glb','muscle-mobile.glb'])test(`complete identities resolve before misleading word fragments: ${file}`,()=>{
 const names=meshNames(file);for(const [pattern,expected] of groups){const matches=names.filter(n=>pattern.test(n));assert.ok(matches.length,`${file}: ${pattern}`);for(const name of matches)assert.equal(clinicalProfile(name,'muscle').region,expected,name);}
});
const assess=(part,layer,tags)=>{const report={part,layer,...Object.fromEntries(fields.map(f=>[f,tags.filter(t=>k[f].some(x=>x.id===t))]))};const v=new Set(fields.flatMap(kind=>visibleSymptoms(k,{parts:[part],layer,kind}).map(x=>x.id)));for(const tag of tags)assert.ok(v.has(tag),`${part}: ${tag}`);return assessSymptoms(k,{reports:[report]});};
test('all pectoral subdivisions retain chest warning access and ordinary load controls',()=>{
 for(const part of meshNames('muscle-mobile.glb').filter(n=>/pectoralis major/i.test(n))){
  assert.equal(assess(part,'muscle',['压迫感']).triageLevel,'same-day',part);
  assert.equal(assess(part,'muscle',['压迫感','冷汗']).triageLevel,'emergency',part);
  assert.equal(assess(part,'muscle',['酸痛','反复用力']).triageLevel,null,part);
 }
});
test('iliocostalis fever combinations receive the existing neck/back warning, not chest observation',()=>{
 for(const part of meshNames('muscle-mobile.glb').filter(n=>/iliocostalis/i.test(n))){assert.equal(assess(part,'muscle',['疼痛','发热']).triageLevel,'same-day');assert.equal(assess(part,'muscle',['疼痛']).triageLevel,null);}
});
test('digastric/hyoid areas expose existing swallowing options instead of abdominal ones',()=>{
 for(const part of meshNames('muscle-mobile.glb').filter(n=>/digastric|sternothyroid/i.test(n))){
  const v=new Set(fields.flatMap(kind=>visibleSymptoms(k,{parts:[part],layer:'muscle',kind}).map(x=>x.id)));
  assert.ok(v.has('吞咽痛'));assert.ok(!v.has('腹部僵硬'));assert.equal(assess(part,'muscle',['吞咽困难']).triageLevel,'same-day');
 }
});
test('similarly named neighboring identities keep their original regions',()=>{
 for(const [part,region] of [['Rectus abdominis muscle.r','abdomen'],['Clavicular part of deltoid muscle.l','shoulder'],['Teres major muscle.l','shoulder'],['Opponens digiti minimi muscle of hand.l','hand'],['Sternum','chest']])assert.equal(clinicalProfile(part,'muscle').region,region,part);
});
test('sudden hearing reduction already contains the hearing observation and duplicates count once',()=>{
 const forms=[['疼痛','突然听力下降'],['疼痛','突然听力下降','听力下降'],['疼痛','听力下降','突然起病']];
 for(const tags of forms){const r=assess('Malleus.l','skeleton',tags);assert.equal(r.triageLevel,'same-day');assert.deepEqual(r.items.map(x=>x.id),['ear-infection-pattern']);assert.equal(r.items[0].score,6);assert.equal(r.items[0].evidenceFamilies.filter(f=>f==='hearing').length,1);}
 assert.equal(evidenceFamily('听力下降'),evidenceFamily('突然听力下降'));
 assert.equal(assess('Malleus.l','skeleton',['疼痛','听力下降']).triageLevel,null);
});
test('swelling warnings do not add unreported pain or onset in either language',()=>{
 for(const [part,tags] of [['Tibia.l',['单侧肿胀']],['Patella.l',['局部肿胀','发热']]]){
  const w=assess(part,'skeleton',tags).urgent[0];assert.doesNotMatch(w.zh,/新发|肿痛/);assert.doesNotMatch(w.en.split(';')[0],/new |painful|pain /i);
 }
 for(const id of ['reflux-dyspepsia-pattern','pyelonephritis-pattern']){const c=k.conditions.find(x=>x.id===id);assert.match(c.threshold.zh,/立即急诊/);assert.match(c.threshold.en,/emergency care/i);}
});
