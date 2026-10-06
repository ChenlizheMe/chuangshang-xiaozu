import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';import {visibleSymptoms} from '../src/symptomFilters.js';import {reportLocationOptions} from '../src/reportLocation.js';import {evidenceFamily} from '../src/symptomLanguage.js';import {PRIORITY_LEVELS} from '../src/priorityGuidance.js';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));const f=JSON.parse(fs.readFileSync(new URL('./fixtures/cross-specialty-inputs.json',import.meta.url)));const fields=['feelings','signs','timing','triggers'];
const fieldByTag=new Map(fields.flatMap(field=>k[field].map(t=>[t.id,field])));const tags=r=>fields.flatMap(field=>r[field]||[]);const assess=r=>assessSymptoms(k,{reports:[r]});const rank=a=>PRIORITY_LEVELS[a.triageLevel]?.rank||0;
const mesh=new Map();for(const [layer,file]of[['skeleton','skeleton-mobile.glb'],['muscle','muscle-mobile.glb'],['organ','organs-mobile.glb']]){const b=fs.readFileSync(new URL(`../public/anatomy/${file}`,import.meta.url));mesh.set(layer,new Set(JSON.parse(b.subarray(20,20+b.readUInt32LE(12))).nodes.filter(n=>n.mesh!==undefined).map(n=>n.name)));}
const visible=r=>new Set(fields.flatMap(kind=>visibleSymptoms(k,{parts:[r.part],layer:r.layer,kind}).map(t=>t.id)));
const assertReachable=r=>{assert.ok(mesh.get(r.layer).has(r.part),r.part);const v=visible(r);for(const t of tags(r))assert.ok(v.has(t),`${r.part}: ${t}`);if(r.location&&r.location!=='unknown')assert.ok(reportLocationOptions(r).some(([id])=>id===r.location),`${r.part}: ${r.location}`);return v;};
const danger=['面部歪斜','说话含糊','突然单侧无力','肌力下降','会阴麻木','排尿困难','呼吸困难','静息气短','吞咽困难','突然听力下降','视物模糊','复视','畏光','突发剧痛','突发最严重头痛','晕厥','冷汗','呕血','黑便','血便','腹部僵硬','发热','发冷','流脓','单侧肿胀','局部发热','无法承重','关节卡住','持续加重','血尿','黄疸','外伤后','扭伤后','体重下降'];
test('655 independently preserved audit seeds use actual structures and selectable existing inputs',()=>{assert.equal(f.seeds.length,655);for(const {report}of f.seeds)assertReachable(report);});
test('adding a selectable danger observation never lowers existing assessment urgency',t=>{
 let count=0;for(const {name,report:r}of f.seeds){const a=assess(r),v=visible(r);for(const d of danger.filter(t=>v.has(t)&&!tags(r).includes(t))){const field=fieldByTag.get(d),rr={...r,[field]:[...(r[field]||[]),d]};assert.ok(rank(assess(rr))>=rank(a),`${name} + ${d}`);count++;}}
 assert.ok(count>=6800,`covered ${count} additions`);t.diagnostic(`monotonic additions checked: ${count}`);
});
test('complete output including displayed evidence is invariant to input order and exact repetition',()=>{
 for(const {name,report:r}of f.seeds){const a=assess(r);for(const repeat of [false,true]){const rr={...r,...Object.fromEntries(fields.map(field=>[field,repeat?[...(r[field]||[]),...(r[field]||[])]:[...(r[field]||[])].reverse()]))};assert.deepEqual(assess(rr),a,name);}}
});
test('unknown API tokens cannot change decisions or create evidence',()=>{for(const {name,report:r}of f.seeds)assert.deepEqual(assess({...r,feelings:[...(r.feelings||[]),'unknown-token','confirmed-diagnosis']}),assess(r),name);});
test('priority action is identical in both languages across every retained reference card',()=>{
 for(const {name,report:r}of f.seeds){const a=assess(r),selected=new Set(tags(r));for(const item of a.items){assert.ok(item.why.every(t=>selected.has(t)),name);assert.equal(new Set(item.why.map(evidenceFamily)).size,item.why.length,name);if(a.urgent.length){assert.equal(item.priorityLevel,a.triageLevel,name);assert.deepEqual(item.advice,{zh:a.urgent[0].zh,en:a.urgent[0].en},name);assert.ok(!item.lifestyle,name);}}}
});
for(const c of f.crossLayerCases)test(`equivalent reported body area preserves urgency: ${c.name}`,()=>{c.reports.forEach(assertReachable);assert.equal(new Set(c.reports.map(r=>assess(r).triageLevel)).size,1);});
