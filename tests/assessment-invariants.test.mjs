import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {clinicalProfile} from '../src/clinicalRegions.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/ui-rule-reachability.json',import.meta.url)));
const fields=['feelings','signs','timing','triggers'];
const profiles=new Map();
for(const [layer,file] of [['skeleton','skeleton-mobile.glb'],['muscle','muscle-mobile.glb'],['organ','organs-mobile.glb']]){
 const bytes=fs.readFileSync(new URL(`../public/anatomy/${file}`,import.meta.url));
 const model=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 for(const {name} of model.nodes.filter(node=>node.mesh!==undefined)){
  const p=clinicalProfile(name,layer),key=[layer,p.region,p.tissue,p.organ||''].join(':');
  if(!profiles.has(key))profiles.set(key,{part:name,layer});
 }
}
test('every current region/tissue/organ class rejects specific disease cards from one selected observation',()=>{
 let cases=0;
 for(const report of profiles.values())for(const field of fields){
  for(const tag of visibleSymptoms(k,{parts:[report.part],layer:report.layer,kind:field})){
   const result=assessSymptoms(k,{reports:[{...report,[field]:[tag.id]}]});
   assert.ok(result.items.every(item=>item.basic),`${report.part}: ${tag.id}`);
   assert.ok(result.items.every(item=>item.why.every(id=>id===tag.id)),`${report.part}: invented evidence`);cases++;
  }
 }
 console.log(`Single-observation invariant: ${cases} synthetic inputs across ${profiles.size} current anatomy classes; not clinical validation.`);
});
test('duplicating or reordering selected observations never strengthens or changes matched directions',()=>{
 for(const {id,report} of fixture.cases){
  const baseline=assessSymptoms(k,{reports:[report]});
  for(const variant of [Object.fromEntries(fields.map(field=>[field,[...report[field],...report[field]]])),Object.fromEntries(fields.map(field=>[field,[...report[field]].reverse()]))]){
   const result=assessSymptoms(k,{reports:[{...report,...variant}]});
   assert.deepEqual(result.items.map(c=>[c.id,c.score]),baseline.items.map(c=>[c.id,c.score]),id);
   assert.deepEqual(result.urgent,baseline.urgent,id);
  }
 }
});
test('unknown input tokens cannot add clinical evidence or bypass any existing pathway',()=>{
 for(const {id,report} of fixture.cases){
  const baseline=assessSymptoms(k,{reports:[report]});
  const result=assessSymptoms(k,{reports:[{...report,feelings:[...report.feelings,'unrecognized-token','confirmed-diagnosis']} ]});
  assert.deepEqual(result,baseline,id);
 }
});
