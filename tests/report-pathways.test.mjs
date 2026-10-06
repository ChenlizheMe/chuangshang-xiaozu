import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {clinicalProfile,ABDOMEN_LOCATIONS} from '../src/clinicalRegions.js';
import {reportLocationOptions} from '../src/reportLocation.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const run=report=>assessSymptoms(k,{reports:[report]});
const options=report=>reportLocationOptions(report).map(([id])=>id);
const cases=[
 ['back flank infection','Lumbar vertebra L3','skeleton',['侧腰痛','发热'],'flank','pyelonephritis-pattern'],
 ['back flank colic','Lumbar vertebra L3','skeleton',['绞痛','血尿'],'flank','renal-colic-pattern'],
 ['hip flank infection','Pectineus muscle.r','muscle',['侧腰痛','发热'],'flank','pyelonephritis-pattern'],
 ['hip flank colic','Pectineus muscle.r','muscle',['绞痛','血尿'],'flank','renal-colic-pattern'],
 ['pelvic lower abdominal pain','Levator ani.or','muscle',['疼痛','经期相关'],'suprapubic','pelvic-pain'],
];
for(const [name,part,layer,tags,location,id] of cases)test(`existing location pathway: ${name}`,()=>{
 const report={part,layer,feelings:tags};
 const offered=options(report);assert.ok(offered.includes(location));
 assert.ok(offered.every(option=>ABDOMEN_LOCATIONS.some(([id])=>id===option)));
 const visible=['feelings','signs','timing','triggers'].flatMap(kind=>visibleSymptoms(k,{parts:[part],layer,kind}).map(t=>t.id));
 for(const tag of tags)assert.ok(visible.includes(tag),tag);
 assert.ok(!run(report).items.some(c=>c.id===id),'location not assumed from anatomy');
 assert.ok(run({...report,location}).items.some(c=>c.id===id));
 assert.ok(!run({...report,location:'diffuse'}).items.some(c=>c.id===id),'uncertain position is not a specific quadrant');
});
test('ordinary back tension does not expose irrelevant abdominal controls',()=>{
 assert.deepEqual(options({part:'Lumbar vertebra L3',layer:'skeleton',feelings:['紧绷']}),[]);
});
for(const [part,layer] of [['Sternum','skeleton'],['Oesophagus','organ']])test(`existing chest reflux route does not require an abdominal quadrant: ${part}`,()=>{
 const report={part,layer,feelings:['反酸','灼烧'],triggers:['进食后加重']};
 assert.ok(run(report).items.some(c=>c.id==='reflux-dyspepsia-pattern'));
 assert.ok(!run({...report,signs:['吞咽困难']}).items.some(c=>c.id==='reflux-dyspepsia-pattern'));
 assert.ok(run({...report,signs:['冷汗']}).urgent.length,'reflux never removes a chest warning');
});
for(const special of ['持续冷热痛','自发痛','夜间痛'])test(`generic dental pain is not another independent observation: ${special}`,()=>{
 for(const pain of ['疼痛','针刺','牵拉痛','紧绷']){
  const result=run({part:'Upper first molar tooth.r',layer:'skeleton',feelings:[special,pain]});
  assert.ok(!result.items.some(c=>c.id==='dental-pulpitis'),`${special}+${pain}`);
 }
});
test('specific dental observations retain a reference direction',()=>{
 assert.ok(run({part:'Upper first molar tooth.r',layer:'skeleton',feelings:['持续冷热痛','自发痛']}).items.some(c=>c.id==='dental-pulpitis'));
});
test('pectineus maps to the hip and disc nuclei remain skeletal tissue',()=>{
 for(const side of ['l','r'])assert.equal(clinicalProfile(`Pectineus muscle.${side}`,'muscle').region,'hip');
 assert.equal(clinicalProfile('Nucleus pulposus C2-C3','skeleton').region,'spine');
 assert.equal(clinicalProfile('Nucleus pulposus C2-C3','skeleton').tissue,'skeleton');
});
test('neck neurological and eye facial-warning pathways remain selectable',()=>{
 for(const [part,layer,tags] of [['Cervical vertebra C3','skeleton',['会阴麻木','排尿困难']],['Palpebral part of orbicularis oculil','muscle',['面部歪斜']]]){
  const available=['feelings','signs'].flatMap(kind=>visibleSymptoms(k,{parts:[part],layer,kind}).map(t=>t.id));
  for(const tag of tags){assert.ok(available.includes(tag));assert.ok(run({part,layer,feelings:[tag]}).urgent.length);}
 }
});

for(const [extra,unrelated] of [['发热','diverticular-left-abdominal'],['油腻餐后痛','biliary-colic-pattern'],['外伤后','splenic-injury-warning']])test(`right-lower migration cannot satisfy another quadrant: ${unrelated}`,()=>{
 const result=run({part:'Rectus abdominis muscle.r',layer:'muscle',location:'unknown',feelings:['疼痛','腹痛迁移至右下腹',extra]});
 assert.ok(result.items.some(c=>c.id==='appendicitis-pattern'));
 assert.ok(!result.items.some(c=>c.id===unrelated));
 assert.ok(result.urgent.length);
});

for(const tags of [['尿痛','尿频'],['发热']])test(`incomplete location-specific evidence does not send users to a nonexistent control: ${tags.join('+')}`,()=>{
 const report={part:'Lumbar vertebra L3',layer:'skeleton',feelings:tags};
 assert.deepEqual(options(report),[]);
 assert.equal(run(report).needsLocation,false);
});
