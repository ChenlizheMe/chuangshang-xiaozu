import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
import {ANATOMY_MODELS,isVisibleAnatomyMesh} from '../src/anatomyModels.js';
import {clinicalProfile} from '../src/clinicalRegions.js';

const knowledge=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url),'utf8'));
const selectableTags=new Set([...knowledge.feelings,...knowledge.signs].map(tag=>tag.id));

test('all assessment cards have concise bilingual descriptions, triggers and thresholds',()=>{
 for(const condition of knowledge.conditions){
  for(const field of ['shortDescription','triggers','advice','threshold']){
   for(const lang of ['zh','en'])assert.ok(condition[field]?.[lang]?.trim(),`${condition.id} missing ${field}.${lang}`);
  }
  assert.ok(condition.shortDescription.zh.length<=70,`${condition.id} description is too long`);
  assert.ok(condition.advice.zh.length<=85,`${condition.id} advice is too long`);
 }
});

test('the visible muscle resource routes every selectable muscle to a clinical region',()=>{
 assert.deepEqual(Object.keys(ANATOMY_MODELS),['skeleton','muscle']);
 assert.equal(ANATOMY_MODELS.muscle.file,'muscle-optimized.glb');
 const bytes=fs.readFileSync(new URL(`../public/anatomy/${ANATOMY_MODELS.muscle.file}`,import.meta.url));
 const atlas=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 const muscles=atlas.nodes.filter(node=>node.mesh!==undefined&&isVisibleAnatomyMesh(node.name,'muscle'));
 assert.ok(muscles.length>200);
 for(const name of ['Cauda equina','Corpus callosum','Median nerve.l','Brachial plexus','Cornea.l'])assert.equal(isVisibleAnatomyMesh(name,'muscle'),false,`${name} must be excluded from the muscle view`);
 for(const name of ['Rectus abdominis muscle.l','Palpebral part of orbicularis oculil','Masseter muscle.r'])assert.equal(isVisibleAnatomyMesh(name,'muscle'),true,`${name} must remain visible`);
 for(const muscle of muscles){
  assert.notEqual(clinicalProfile(muscle.name,'muscle').region,'general',muscle.name);
  const result=assessSymptoms(knowledge,{parts:[muscle.name],layer:'muscle',feelings:knowledge.feelings.map(tag=>tag.id),signs:knowledge.signs.map(tag=>tag.id)});
  assert.ok(result.items.length,`${muscle.name} has no assessment`);
 }
});

test('feelings and signs stay in separate selector groups',()=>{
 const feelings=new Set(knowledge.feelings.map(tag=>tag.id));
 assert.deepEqual(knowledge.signs.filter(tag=>feelings.has(tag.id)),[]);
 assert.ok(!feelings.has('轻微'));
 assert.ok(!feelings.has('剧烈'));
});

test('medication cards contain OTC categories only',()=>{
 const restricted=/(?<!非)处方|prescription|抗生素|antibiotic|激素|steroid|镇静|sedative|阿片|opioid|抗凝|anticoagulant|抗病毒|antiviral|抗癫痫|antiepileptic/i;
 for(const condition of knowledge.conditions){
  assert.ok(condition.medication?.zh&&!restricted.test(condition.medication.zh),`${condition.id} exposes restricted medication text`);
  assert.ok(condition.medication?.en&&!restricted.test(condition.medication.en),`${condition.id} exposes restricted medication text`);
 }
});

test('every differential uses a selectable symptom tag',()=>{
 for(const condition of knowledge.conditions){
  for(const tag of [...condition.feelings,...condition.signs]){
   assert.ok(selectableTags.has(tag),`${condition.id} references missing selector tag: ${tag}`);
  }
 }
});

test('dental symptoms rank a concrete dental differential',()=>{
 const result=assessSymptoms(knowledge,{parts:['Upper first molar tooth.r'],layer:'skeleton',feelings:['冷热敏感','夜间痛'],signs:['牙龋洞']});
 assert.equal(result.items[0].id,'dental-caries');
 assert.match(result.items[0].summary,/龋|牙本质/);
});

test('abdominal quadrant filters the opposite visceral side',()=>{
 const result=assessSymptoms(knowledge,{parts:['Rectus abdominis muscle.r'],layer:'muscle',feelings:['绞痛'],signs:['发热'],location:'rlq',severity:7});
 assert.ok(result.items.some(item=>item.id==='appendicitis-pattern'));
 assert.ok(!result.items.some(item=>item.id==='diverticular-left-abdominal'));
 assert.ok(result.urgent.length>0);
});

test('severe abdominal red flags stay visible above the cards',()=>{
 const result=assessSymptoms(knowledge,{parts:['Rectus abdominis muscle.l'],layer:'muscle',feelings:['钝痛'],signs:['呕血'],location:'epigastric',severity:9});
 assert.ok(result.urgent.length>0);
});

test('new region routes return concrete differentials',()=>{
 const cases=[
  ['Hyoid bone','skeleton','pharyngitis'],
  ['Clavicle.l','skeleton','bone-injury'],
  ['Coccygeus muscle.l','muscle','pelvic-pain'],
  ['Sympathetic trunk','nerve','autonomic-assessment']
 ];
 for(const [part,layer,id] of cases){
  const result=assessSymptoms(knowledge,{parts:[part],layer,feelings:id==='autonomic-assessment'?['心悸']:['钝痛'],signs:id==='autonomic-assessment'?['出汗']:['发热']});
  assert.ok(result.items.some(item=>item.id===id),`${part} did not route to ${id}`);
 }
});

test('selectors hide unrelated regional observations',()=>{
 const mouthSigns=visibleSymptoms(knowledge,{parts:['Masseter muscle.r'],layer:'muscle',kind:'signs'}).map(tag=>tag.id);
 const noseSigns=visibleSymptoms(knowledge,{parts:['Inferior nasal concha bone.l'],layer:'skeleton',kind:'signs'}).map(tag=>tag.id);
 assert.ok(!mouthSigns.includes('鼻塞'));
 assert.ok(!mouthSigns.includes('脓性鼻涕'));
 assert.ok(noseSigns.includes('鼻塞'));
 assert.ok(noseSigns.includes('脓性鼻涕'));
});

test('every atlas mesh supports symptom-based analysis and suppresses position-only cards',()=>{
 for(const [layer,file] of Object.entries({skeleton:'skeletal',muscle:'muscular',nerve:'nervous'})){
  const bytes=fs.readFileSync(new URL(`../public/anatomy/${file}_male.glb`,import.meta.url));
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  for(const node of json.nodes.filter(node=>node.mesh!==undefined)){
   const positionOnly=assessSymptoms(knowledge,{parts:[node.name],layer});
   assert.equal(positionOnly.items.length,0,`${layer}: ${node.name} produced a position-only card`);
   assert.ok(positionOnly.needsEvidence);
   const result=assessSymptoms(knowledge,{parts:[node.name],layer,feelings:knowledge.feelings.map(tag=>tag.id),signs:knowledge.signs.map(tag=>tag.id)});
   assert.ok(result.items.length,`${layer}: ${node.name} produced no differential`);
   assert.ok(result.items.every(item=>item.why.length>=2));
  }
 }
});

test('unrelated symptoms and duplicate body parts cannot satisfy the evidence minimum',()=>{
 for(const parts of [['Frontal bone'],['Frontal bone','Frontal bone']]){
  const result=assessSymptoms(knowledge,{parts,layer:'skeleton',signs:['牙龋洞']});
  assert.equal(result.items.length,0);
  assert.ok(result.needsEvidence);
 }
 const result=assessSymptoms(knowledge,{parts:['Upper first molar tooth.r'],layer:'skeleton',feelings:['冷热敏感','冷热敏感']});
 assert.ok(result.items.length>0);
 assert.ok(result.items.every(item=>item.why.length>=2&&new Set(item.why).size===item.why.length));
 assert.ok(result.items.every(item=>item.matchedSymptoms.length>0));
});

test('urgent guidance survives when no differential reaches the evidence threshold',()=>{
 const result=assessSymptoms(knowledge,{parts:['Rectus abdominis muscle.r'],layer:'muscle',signs:['呕血']});
 assert.equal(result.items.length,0);
 assert.ok(result.urgent.length>0);
});
