import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
import {reportLocationOptions} from '../src/reportLocation.js';
import {CLINICAL_RULES} from '../src/clinicalRules.js';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/ui-rule-reachability.json',import.meta.url)));
// These generated fixtures prove software reachability, not clinical truth.
// Independently chosen positive/negative and safety cases live in other suites.
for(const {id,report} of fixture.cases)test(`current selector-to-rule path: ${id}`,()=>{
 for(const kind of ['feelings','signs','timing','triggers']){
  const visible=new Set(visibleSymptoms(k,{parts:[report.part],layer:report.layer,kind}).map(t=>t.id));
  for(const tag of report[kind])assert.ok(visible.has(tag),`${kind}: ${tag}`);
 }
 if(report.location!=='unknown')assert.ok(reportLocationOptions(report).some(([id])=>id===report.location));
 assert.ok(assessSymptoms(k,{reports:[report]}).items.some(c=>c.id===id));
});
test('reachability coverage accounts for every existing rule and the inactive anatomy branch',()=>{
 const ids=new Set([...fixture.cases.map(c=>c.id),...fixture.unavailable.map(c=>c.id)]);
 assert.deepEqual([...ids].sort(),Object.keys(CLINICAL_RULES).sort());
 assert.deepEqual(fixture.unavailable.map(c=>c.id),['autonomic-assessment']);
});
