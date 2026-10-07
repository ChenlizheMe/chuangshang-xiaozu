import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
import {reportLocationOptions} from '../src/reportLocation.js';
import {PAIN_TAGS,LOCAL_PAIN_TAGS,REPORTED_PAIN_TAGS,evidenceFamily} from '../src/symptomLanguage.js';
import {assertSelectableStructure} from './helpers/selectable-anatomy.mjs';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const f=JSON.parse(fs.readFileSync(new URL('./fixtures/regional-night-pain.json',import.meta.url)));
const fields=['feelings','signs','timing','triggers'];
for(const {name,report,wantLevel}of f.cases)test(`regional night-pain observation: ${name}`,()=>{
 assertSelectableStructure(report.part,report.layer);
 for(const field of fields){const visible=new Set(visibleSymptoms(k,{parts:[report.part],layer:report.layer,kind:field}).map(t=>t.id));for(const tag of report[field])assert.ok(visible.has(tag),`${field}:${tag}`);}
 if(report.location!=='unknown')assert.ok(reportLocationOptions(report).some(([id])=>id===report.location),'explicit location remains editable');
 const before=structuredClone(report),result=assessSymptoms(k,{reports:[report]});
 assert.equal(result.triageLevel,wantLevel);assert.deepEqual(report,before);assert.ok(result.items.every(item=>item.basic),'night pain does not loosen a disease gate');
 if(report.timing.includes('夜间痛')){
  assert.ok(result.reportedSymptoms.includes('夜间痛'));assert.ok(!result.reportedSymptoms.includes('疼痛'));
  const explicitPain={...report,feelings:[...report.feelings,'疼痛'],timing:report.timing.filter(tag=>tag!=='夜间痛')};
  assert.deepEqual(result.urgent,assessSymptoms(k,{reports:[explicitPain]}).urgent,'reuse the original pain premise only, without changing its action');
 }
 if(result.urgent.length)for(const item of result.items)for(const lang of ['zh','en'])assert.equal(item.advice[lang],result.urgent[0][lang]);
});
test('regional recognition does not rewrite global pain families or classify night pain as severe or pressure',()=>{
 assert.equal(evidenceFamily('夜间痛'),'spontaneous');
 for(const set of [PAIN_TAGS,LOCAL_PAIN_TAGS,REPORTED_PAIN_TAGS])assert.ok(!set.has('夜间痛'));
 const report={part:'Rectus abdominis muscle.r',layer:'muscle',location:'epigastric',feelings:['压迫感'],signs:['冷汗'],timing:[],triggers:[]};
 const ordinary=assessSymptoms(k,{reports:[report]});assert.equal(ordinary.triageLevel,'same-day');
 assert.deepEqual(assessSymptoms(k,{reports:[{...report,timing:['夜间痛']}]}).urgent,ordinary.urgent);
 assert.equal(f.cases.filter(c=>c.builtParity).length,17);
});
test('night pain keeps explicit unknown/diffuse and unrelated anatomical inputs outside quadrant-specific warnings',()=>{
 for(const location of ['unknown','diffuse']){
  const r={part:'Rectus abdominis muscle.r',layer:'muscle',location,timing:['夜间痛'],signs:['发热']};
  assert.equal(assessSymptoms(k,{reports:[r]}).triageLevel,null);
 }
 // API-only negative: these valid labels do not provide a local abdominal pain fact.
 for(const tag of ['肩尖痛','侧卧肩痛','单侧头痛']){
  const r={part:'Rectus abdominis muscle.r',layer:'muscle',location:'llq',feelings:[tag],signs:['发热']};
  assert.ok(!assessSymptoms(k,{reports:[r]}).urgent.some(w=>w.id==='confirmed-left-lower-pain-warning'));
 }
});
