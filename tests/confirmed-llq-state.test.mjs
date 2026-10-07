import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
import {selectionReducer,emptySelection,assessmentReports} from '../src/selectionState.js';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/confirmed-llq-cases.json',import.meta.url)));
const fields=['feelings','signs','timing','triggers'];
const assess=r=>assessSymptoms(k,{reports:[r]});
for(const c of fixture.cases)test(`confirmed LLQ boundary: ${c.name}`,()=>{
 const r=c.input;
 if(c.uiReachable)for(const field of fields){const available=new Set(visibleSymptoms(k,{parts:[r.part],layer:r.layer,kind:field}).map(t=>t.id));for(const tag of r[field])assert.ok(available.has(tag),`${field}: ${tag}`);}
 const a=assess(r);assert.equal(a.triageLevel,c.wantLevel);
 assert.deepEqual(a.items.map(x=>x.id).filter(id=>!id.startsWith('basic-')),c.referenceIds.filter(id=>!id.startsWith('basic-')),'specific reference gates remain unchanged');
 if(a.triageLevel)for(const item of a.items)for(const lang of ['zh','en'])assert.equal(item.advice[lang],a.urgent[0][lang]);
});
test('LLQ evidence removal and location edits recompute the action without stale escalation',()=>{
 let s=selectionReducer(emptySelection,{type:'toggle',part:'Rectus abdominis muscle.r',layer:'muscle'});
 const change=patch=>{s=selectionReducer(s,{type:'update',id:s.reports[0].id,patch});return assessSymptoms(k,{reports:assessmentReports(s)});};
 assert.equal(change({location:'llq',feelings:['疼痛'],signs:['发热']}).triageLevel,'same-day');
 assert.equal(change({feelings:[]}).triageLevel,null);
 assert.equal(change({feelings:['疼痛'],location:'unknown'}).triageLevel,null);
 assert.equal(change({location:'llq',signs:[],timing:['持续加重']}).triageLevel,'same-day');
 assert.equal(change({feelings:[]}).triageLevel,null);
 assert.equal(change({feelings:['疼痛'],signs:['血便']}).triageLevel,'emergency');
});
test('organ reference and remote pain are not confirmed local LLQ pain',()=>{
 assert.equal(assess({part:'Descending colon',layer:'organ',location:'unknown',feelings:['疼痛'],signs:['发热']}).triageLevel,null);
 for(const tag of ['肩尖痛','侧腰痛','向背部放射']){
  const a=assess({part:'Rectus abdominis muscle.r',layer:'muscle',location:'llq',feelings:[tag],signs:['发热']});
  assert.ok(!a.urgent.some(w=>w.id==='confirmed-left-lower-pain-warning'),tag);
 }
});
test('diverticular reference does not assert unreported bowel changes',()=>{
 const a=assess(fixture.cases[0].input),c=a.items.find(c=>c.id==='diverticular-left-abdominal');
 assert.ok(!c.why.includes('排便改变'));
 assert.match(c.shortDescription.zh,/可伴/);assert.match(c.shortDescription.en,/may occur/);
});
