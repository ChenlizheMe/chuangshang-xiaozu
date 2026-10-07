import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
import {PAIN_TAGS,LOCAL_PAIN_TAGS,REPORTED_PAIN_TAGS,evidenceFamily} from '../src/symptomLanguage.js';
import {RULE_PAIN_TAGS} from '../src/clinicalRules.js';
import {assertSelectableStructure} from './helpers/selectable-anatomy.mjs';
const knowledge=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/head-night-pain.json',import.meta.url)));
const fields=['feelings','signs','timing','triggers'];

for(const {name,report,wantLevel} of fixture.cases)test(`head night-pain observation: ${name}`,()=>{
 assertSelectableStructure(report.part,report.layer);
 for(const field of fields){
  const visible=new Set(visibleSymptoms(knowledge,{parts:[report.part],layer:report.layer,kind:field}).map(tag=>tag.id));
  for(const tag of report[field])assert.ok(visible.has(tag),`${field}: ${tag} must be selectable`);
 }
 const before=structuredClone(report),result=assessSymptoms(knowledge,{reports:[report]});
 assert.equal(result.triageLevel,wantLevel);assert.deepEqual(report,before);
 assert.ok(result.items.every(item=>item.basic),'the observation must not create a specific disease reference');
 if(report.part==='Frontal bone'&&report.timing.includes('夜间痛')){
  assert.ok(result.reportedSymptoms.includes('夜间痛'));
  assert.ok(!result.reportedSymptoms.includes('疼痛'),'do not manufacture a general pain tag');
  const explicitPain={...report,feelings:[...report.feelings,'刺痛'],timing:report.timing.filter(tag=>tag!=='夜间痛')};
  assert.deepEqual(result.urgent,assessSymptoms(knowledge,{reports:[explicitPain]}).urgent,
   'the real selectable stinging observation invokes the same pre-existing head action');
 }
 if(result.urgent.length)for(const item of result.items)for(const lang of ['zh','en'])assert.equal(item.advice[lang],result.urgent[0][lang]);
});

test('head recognition preserves global pain sets, evidence families and disease gates',()=>{
 for(const tags of [PAIN_TAGS,LOCAL_PAIN_TAGS,REPORTED_PAIN_TAGS])assert.ok(!tags.has('夜间痛'));
 assert.ok(!RULE_PAIN_TAGS.includes('夜间痛'));
 assert.equal(evidenceFamily('夜间痛'),'spontaneous');
 const r={part:'Frontal bone',layer:'skeleton',location:'unknown',feelings:['刺痛'],signs:[],timing:['夜间痛'],triggers:[]};
 const result=assessSymptoms(knowledge,{reports:[r]});
 assert.equal(result.triageLevel,null);assert.ok(result.items.every(item=>item.basic));
 assert.deepEqual(new Set(result.reportedSymptoms),new Set(['刺痛','夜间痛']));
 assert.equal(fixture.cases.filter(item=>item.builtParity).length,11);
});
