import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {anatomyIdentity,safePartLabel} from '../src/anatomyLabels.js';
import {clinicalProfile} from '../src/clinicalRegions.js';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
import {isVisibleAnatomyMesh} from '../src/anatomyModels.js';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const fields=['feelings','signs','timing','triggers'];
function meshNames(file){const b=fs.readFileSync(new URL('../public/anatomy/'+file,import.meta.url));const doc=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));return new Set(doc.nodes.filter(n=>n.mesh!==undefined).map(n=>n.name));}
function assess(part,tags,location='unknown'){
 const r={part,layer:'muscle',location,...Object.fromEntries(fields.map(field=>[field,tags.filter(id=>k[field].some(t=>t.id===id))]))};
 for(const field of fields){const visible=new Set(visibleSymptoms(k,{parts:[part],layer:'muscle',kind:field}).map(t=>t.id));for(const id of r[field])assert.ok(visible.has(id),`${part}: ${id} is a current option`);}
 return assessSymptoms(k,{reports:[r]});
}
for(const file of ['muscle-mobile.glb','muscle-optimized.glb'])test(`${file}: reviewed identities retain side and separate foot, hand, back and pelvic structures`,()=>{
 const names=meshNames(file);
 for(const suffix of ['l','r'])for(const [name,zh,region] of [
  ['(Opponens digiti minimi muscle of foot)','小趾对跖肌','foot'],
  ['Opponens digiti minimi muscle of hand','小指对掌肌','hand'],
  ['Opponens pollicis muscle','拇对掌肌','hand'],
  ['Rotatores','回旋肌','spine'],
  ['Pubo-analis muscle',null,'pelvis'],
  ['Pectineus muscle','耻骨肌','hip']
 ]){
  const raw=`${name}.${suffix}`,side=suffix==='l'?'left':'right',prefix=suffix==='l'?'左侧':'右侧';
  assert.ok(names.has(raw),`${raw} exists in ${file}`);assert.ok(isVisibleAnatomyMesh(raw,'muscle'));
  const identity=anatomyIdentity(raw),label=safePartLabel(raw,'muscle'),profile=clinicalProfile(raw,'muscle');
  assert.equal(identity.side,side);assert.equal(profile.side,side);assert.equal(profile.region,region);assert.equal(profile.tissue,'muscle');
  if(zh)assert.equal(label.zh,prefix+zh);
  assert.equal(label.en,`${side==='left'?'Left':'Right'} ${identity.name}`);
 }
});
test('corrected back and pelvic identities reach existing regional safety paths without inferring a disease',()=>{
 for(const suffix of ['l','r']){
  const back=`Rotatores.${suffix}`,pelvis=`Pubo-analis muscle.${suffix}`;
  assert.equal(assess(back,['疼痛','发热']).triageLevel,'same-day');
  assert.equal(assess(back,['酸痛']).triageLevel,null);
  assert.ok(assess(back,['酸痛']).items.every(c=>!c.id.includes('head')));
  const pelvic=assess(pelvis,['疼痛','发热'],'llq');assert.equal(pelvic.triageLevel,'same-day');
  assert.ok(pelvic.items.every(c=>c.basic));
  assert.equal(assess(pelvis,['疼痛','可能怀孕','晕厥']).triageLevel,'emergency');
  assert.equal(assess(pelvis,['疼痛']).triageLevel,null);
 }
});
test('real cerebral gyri retain head routing; corrected muscle identities do not broaden component-word matching',()=>{
 const names=meshNames('nervous_male.glb');
 for(const raw of ['Angular gyrus.l','Angular gyrus.r','Cingulate gyrus (Posteroventral part*).l','Cingulate gyrus (Posteroventral part*).r']){assert.ok(names.has(raw));assert.equal(clinicalProfile(raw,'nerve').region,'head');}
});

for(const file of ['muscle-mobile.glb','muscle-optimized.glb'])test(`${file}: whole Plantaris identity remains distinct from plantar foot structures`,()=>{
 const names=meshNames(file);
 for(const suffix of ['l','r'])for(const [name,zh,region] of [['Plantaris muscle','跖肌','lower-limb'],['Soleus muscle','比目鱼肌','lower-limb'],['Calcaneal tendon','跟腱','ankle'],['Plantar aponeurosis','足底腱膜','foot']]){
  const part=`${name}.${suffix}`,profile=clinicalProfile(part,'muscle');assert.ok(names.has(part));assert.ok(isVisibleAnatomyMesh(part,'muscle'));
  assert.equal(profile.region,region);assert.equal(profile.label.zh,(suffix==='l'?'左侧':'右侧')+zh);assert.equal(profile.label.en,(suffix==='l'?'Left ':'Right ')+name);
  assert.equal(profile.side,suffix==='l'?'left':'right');
 }
});
test('Plantaris ordinary pain uses the existing broad lower-limb assessment, not an assumed sole location',()=>{
 for(const part of ['Plantaris muscle.l','Plantaris muscle.r']){
  const normal=assess(part,['疼痛']);assert.equal(normal.triageLevel,null);assert.equal(normal.items.length,1);assert.equal(normal.items[0].id,'basic-lower-limb-lower-limb');
  assert.equal(assess(part,['新运动后1至3天','尿色深','肌力下降']).triageLevel,'emergency');
 }
});
