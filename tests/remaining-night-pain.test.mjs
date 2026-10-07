import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
import {PAIN_TAGS,LOCAL_PAIN_TAGS,REPORTED_PAIN_TAGS,evidenceFamily} from '../src/symptomLanguage.js';
import {RULE_PAIN_TAGS} from '../src/clinicalRules.js';
import {assertSelectableStructure} from './helpers/selectable-anatomy.mjs';
const knowledge=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/remaining-night-pain.json',import.meta.url)));
const fields=['feelings','signs','timing','triggers'];
for(const {name,report,wantLevel} of fixture.cases)test(`reviewed night-pain observation: ${name}`,()=>{
 assertSelectableStructure(report.part,report.layer);
 for(const field of fields){
  const visible=new Set(visibleSymptoms(knowledge,{parts:[report.part],layer:report.layer,kind:field}).map(tag=>tag.id));
  for(const tag of report[field])assert.ok(visible.has(tag),`${field}: ${tag} must be selectable`);
 }
 const before=structuredClone(report),result=assessSymptoms(knowledge,{reports:[report]});
 assert.equal(result.triageLevel,wantLevel);assert.deepEqual(report,before);
 if(report.timing.includes('夜间痛')){
  assert.ok(result.reportedSymptoms.includes('夜间痛'));
  assert.ok(!result.reportedSymptoms.includes('疼痛'));
  const comparison={...report,feelings:[...new Set([...report.feelings,'刺痛'])],timing:report.timing.filter(tag=>tag!=='夜间痛')};
  assert.deepEqual(result.urgent,assessSymptoms(knowledge,{reports:[comparison]}).urgent,
   'the existing stinging observation uses the same safety action without changing onset or other signals');
 }
 if(result.urgent.length)for(const item of result.items)for(const lang of ['zh','en'])assert.equal(item.advice[lang],result.urgent[0][lang]);
 if(report.part==='Humerus.l')assert.ok(!result.urgent.some(w=>w.id==='eye-injury-review'));
});
test('reviewed eye/exercise recognition does not expand generic pain or reference gates',()=>{
 for(const tags of [PAIN_TAGS,LOCAL_PAIN_TAGS,REPORTED_PAIN_TAGS])assert.ok(!tags.has('夜间痛'));
 assert.ok(!RULE_PAIN_TAGS.includes('夜间痛'));
 assert.equal(evidenceFamily('夜间痛'),'spontaneous');
 for(const c of fixture.cases.filter(c=>c.report.timing.includes('夜间痛')&&!c.report.feelings.length)){
  const result=assessSymptoms(knowledge,{reports:[c.report]});
  assert.ok(result.items.every(item=>item.basic),'night pain must not supply a disease P gate');
 }
 assert.equal(fixture.cases.filter(c=>c.builtParity).length,12);
});
