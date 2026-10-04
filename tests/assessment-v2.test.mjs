import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {assessSymptoms,normalizeReport} from '../src/clinicalEngine.js';
import {CLINICAL_RULES} from '../src/clinicalRules.js';
import {evidenceFamily} from '../src/symptomLanguage.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
import {selectionReducer,emptySelection,assessmentReports} from '../src/selectionState.js';
import {clinicalProfile} from '../src/clinicalRegions.js';
const knowledge=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url),'utf8'));
const tooth='Upper first molar tooth.r',abs='Rectus abdominis muscle.r',back='Lumbar vertebra L3';
const run=(part,tags,options={})=>assessSymptoms(knowledge,{parts:[part],layer:'skeleton',feelings:tags,...options});
const ids=result=>result.items.map(c=>c.id);

// Independent case descriptions: check gates and meaningful negatives rather
// than generating a positive test from the rule's own required-tag arrays.
const cases=[
 ['generic dental stinging',tooth,['刺痛'],{},null],
 ['two pain synonyms',tooth,['针刺','牵拉痛','刺痛'],{},null],
 ['lingering thermal plus spontaneous tooth pain',tooth,['持续冷热痛','自发痛'],{},'dental-pulpitis'],
 ['lingering plus referred pain',tooth,['持续冷热痛','牵拉痛'],{},'dental-pulpitis'],
 ['one lingering finding',tooth,['持续冷热痛'],{},null],
 ['spontaneous/night descriptions are one family',tooth,['自发痛','夜间痛'],{},null],
 ['brief thermal sensitivity',tooth,['冷热敏感','刺激去除即缓解'],{},'dentin-sensitivity'],
 ['visible decay and sensitivity',tooth,['牙龋洞','冷热敏感'],{},'dental-caries'],
 ['dental swelling with bite pain',tooth,['牙龈肿胀','咬合痛'],{},'dental-abscess'],
 ['gingival inflammation',tooth,['牙龈出血','牙龈肿胀'],{},'gingivitis-periodontitis'],
 ['support changes',tooth,['牙齿松动','牙龈出血'],{},'periodontitis-pattern'],
 ['urinary frequency only',abs,['尿频'],{layer:'muscle',location:'suprapubic'},null],
 ['frequency and burning urination',abs,['尿频','尿痛'],{layer:'muscle',location:'suprapubic'},'urinary-tract-infection-pattern'],
 ['flank pain and fever','Kidney.l',['侧腰痛','发热'],{layer:'organ'},'pyelonephritis-pattern'],
 ['colic and hematuria','Kidney.l',['绞痛','血尿'],{layer:'organ'},'renal-colic-pattern'],
 ['right lower progressive abdominal pain',abs,['疼痛','持续加重'],{layer:'muscle',location:'rlq'},'appendicitis-pattern'],
 ['wrong quadrant for appendix',abs,['疼痛','持续加重'],{layer:'muscle',location:'llq'},null],
 ['location missing',abs,['疼痛','持续加重'],{layer:'muscle'},null],
 ['diarrhoea with cramps',abs,['腹泻','绞痛'],{layer:'muscle',location:'diffuse'},'gastroenteritis-pattern'],
 ['reflux and meal association','Stomach',['反酸','进食后加重'],{layer:'organ'},'reflux-dyspepsia-pattern'],
 ['meal fullness and nausea','Stomach',['餐后饱胀','恶心'],{layer:'organ'},'dyspepsia-pattern'],
 ['constipation and hard stool','Descending colon',['便秘','干硬便'],{layer:'organ',location:'llq'},'constipation-pattern'],
 ['chronic bowel pattern','Sigmoid colon',['绞痛','排便后缓解','便秘','反复数月'],{layer:'organ'},'ibs-pattern'],
 ['insufficient sleep and daytime fatigue','Frontal bone',['睡眠不足','白天困倦'],{},'sleep-deprivation'],
 ['sitting back ache improves on moving',back,['酸痛','久坐后','活动后缓解'],{},'sitting-posture'],
 ['new exercise delayed soreness','Biceps brachii muscle.l',['酸痛','新运动后1至3天'],{layer:'muscle'},'delayed-muscle-soreness'],
 ['screen-associated dry eye','Palpebral part of orbicularis oculil',['眼干','长时间看屏幕'],{layer:'muscle'},'screen-dry-eye'],
 ['dehydration combination','Frontal bone',['口渴口干','尿色深'],{},'dehydration-pattern'],
 ['sternal tenderness alone','Sternum',['局部压痛'],{},null],
 ['chest wall pressure and motion','Sternum',['局部压痛','呼吸痛'],{},'costochondritis-pattern'],
 ['blood investigation combination','Sternum',['无故淤青','疲劳乏力'],{},'blood-test-direction'],
 ['cardiac warning','Heart',['压迫感','气短'],{layer:'organ'},'cardiac-ischaemia-warning'],
 ['ankle twist plus swelling','Talus.l',['扭伤后','局部肿胀'],{},'ankle-sprain'],
 ['bone tenderness after injury','Clavicle.l',['外伤后','局部压痛'],{},'bone-injury'],
 ['patellofemoral loading','Patella.l',['疼痛','上下楼加重'],{},'patellofemoral-pain'],
 ['median distribution plus night numbness','Scaphoid bone.l',['拇食中指麻木','夜间麻木'],{},'carpal-tunnel'],
 ['allergic nasal pattern','Inferior nasal concha bone.l',['清水鼻涕','鼻痒'],{},'allergic-rhinitis']
];
for(const [name,part,tags,options,expected] of cases)test(name,()=>{
 const result=run(part,tags,options);
 if(expected)assert.ok(ids(result).includes(expected),`${expected} absent: ${ids(result)}`);else {assert.ok(result.items.length);assert.ok(result.items.every(c=>c.basic),ids(result).join(','));}
 for(const c of result.items){assert.ok(c.evidenceFamilies.length>=(c.basic?1:2));assert.ok(new Set(c.why.map(evidenceFamily)).size>=(c.basic?1:2));assert.ok(c.why.every(t=>!t.includes('bone')&&!t.includes('muscle')));}
});

test('every active branch and tag has a reviewed definition and concise bilingual copy',()=>{
 assert.equal(knowledge.conditions.length,75);
 assert.deepEqual(new Set(knowledge.conditions.map(c=>c.id)),new Set(Object.keys(CLINICAL_RULES)));
 const tags=[...knowledge.feelings,...knowledge.signs,...knowledge.timing,...knowledge.triggers],tagIds=new Set(tags.map(t=>t.id));
 assert.equal(tagIds.size,tags.length,'selector groups overlap');
 for(const tag of tags){assert.ok(tag.zh&&tag.en);assert.ok(!/^[\u4e00-\u9fff]+$/.test(tag.en),`${tag.id} untranslated`);}
 for(const c of knowledge.conditions){
  for(const field of ['name','shortDescription','triggers','advice','threshold'])for(const lang of ['zh','en'])assert.ok(c[field]?.[lang]?.trim(),`${c.id}: ${field}.${lang}`);
  assert.ok(c.shortDescription.zh.length<=70,c.id);assert.ok(c.advice.zh.length<=85,c.id);assert.ok(!c.medication,c.id);
  const rule=CLINICAL_RULES[c.id];assert.ok(rule.required.length>=2);
  for(const tag of [...rule.required.flat(),...rule.optional,...(rule.exclude||[])])assert.ok(tagIds.has(tag),`${c.id}: ${tag}`);
 }
});

test('body duplicates and unrelated observations never add clinical evidence',()=>{
 const r=assessSymptoms(knowledge,{parts:[tooth,tooth],feelings:['冷热敏感'],signs:['鼻塞']});assert.ok(r.items.every(c=>c.basic));
 assert.ok(run('Frontal bone',['牙龋洞','冷热敏感']).items.every(c=>c.basic));
});
test('regional reports never combine unrelated local symptoms',()=>{
 const r=assessSymptoms(knowledge,{reports:[{part:tooth,layer:'skeleton',feelings:['刺痛']},{part:abs,layer:'muscle',feelings:['持续冷热痛','自发痛'],signs:['呕吐']}]});
 assert.ok(!ids(r).includes('dental-pulpitis'));assert.ok(!ids(r).includes('gastroenteritis-pattern'));
});
test('inference accepts only the first area and ignores retired free-text input',()=>{
 const r=assessSymptoms(knowledge,{reports:[{part:tooth,layer:'skeleton',feelings:['紧绷']},{part:abs,layer:'muscle',feelings:['绞痛'],signs:['腹泻']}]});
 assert.equal(r.profiles.length,1);assert.ok(!ids(r).includes('gastroenteritis-pattern'));assert.ok(r.items[0].basic);
 assert.equal(run(tooth,[],{text:'喝冷水后还疼很久，没碰也痛'}).items.length,0);
});

test('timing and triggers normalize separately, without needing typed text',()=>{
 const r=normalizeReport({feelings:['紧绷'],timing:['夜间痛'],triggers:['磨牙']});
 assert.deepEqual([...r.tags],['紧绷','夜间痛','磨牙']);
 const a=run(tooth,['持续冷热痛'],{timing:['夜间痛']});assert.ok(ids(a).includes('dental-pulpitis'));
 assert.ok(ids(run(back,['酸痛'],{triggers:['久坐后','活动后缓解']})).includes('sitting-posture'));
 assert.ok(!ids(run(abs,['疼痛'],{layer:'muscle',location:'llq',timing:['持续加重']})).includes('appendicitis-pattern'));
});

test('urgent warnings survive missing evidence and suppress lifestyle reassurance',()=>{
 const a=run(abs,['呕血'],{layer:'muscle'});assert.ok(a.urgent.length);assert.ok(a.items.length&&a.items[0].basic);assert.match(a.items[0].advice.zh,/急诊/);
 const b=run('Frontal bone',['突发最严重头痛','睡眠不足','白天困倦']);assert.ok(b.urgent.length);assert.ok(!ids(b).includes('sleep-deprivation'));
 const c=run('Tibia.l',['单侧肿胀']);assert.ok(c.urgent.length);assert.ok(c.items.length&&c.items[0].basic);
 const d=run('Patella.l',['局部肿胀','发热','活动受限']);assert.ok(ids(d).includes('septic-joint-warning'));assert.ok(d.urgent.length);
});
test('blood-warning direction never means leukemia from sternal tenderness',()=>{
 const r=run('Sternum',['局部压痛','疼痛']);assert.ok(!ids(r).includes('blood-test-direction'));
 assert.ok(!knowledge.conditions.some(c=>/白血病/.test(c.name.zh)));
});
test('a generic selected synonym never hides the characteristic evidence in the card',()=>{
 const r=run(tooth,['持续冷热痛','冷热敏感','自发痛','刺痛']);
 assert.ok(r.items.find(c=>c.id==='dental-pulpitis').why.includes('持续冷热痛'));
});
test('removed text cannot add, deny or contradict selected findings',()=>{
 const a=run('Kidney.l',['侧腰痛'],{layer:'organ',signs:['发热'],text:'没有发烧'});
 assert.ok(ids(a).includes('pyelonephritis-pattern'));
 const b=run('Kidney.l',['侧腰痛'],{layer:'organ',text:'有发烧'});assert.ok(!ids(b).includes('pyelonephritis-pattern'));
});

test('isolated chest pressure keeps action guidance without inventing a cardiac diagnosis',()=>{
 const r=run('Heart',['压迫感'],{layer:'organ'});assert.ok(r.items.length&&r.items[0].basic);assert.ok(r.urgent.length);assert.match(r.items[0].advice.zh,/急救/);assert.ok(!ids(r).includes('cardiac-ischaemia-warning'));
});
test('unreviewed anatomy labels are never routed by the fallback wording',()=>{
 assert.equal(clinicalProfile('Unknown structure 987','skeleton').region,'general');
 assert.equal(clinicalProfile('Lumbar vertebra L3','skeleton').region,'spine');
});
test('chronic IBS gate cannot be bypassed and alarm features block it',()=>{
 assert.ok(!ids(run(abs,['绞痛','排便后缓解','腹泻'],{layer:'muscle'})).includes('ibs-pattern'));
 const r=run(abs,['绞痛','排便后缓解','腹泻','反复数月','血便'],{layer:'muscle'});assert.ok(!ids(r).includes('ibs-pattern'));assert.ok(r.urgent.length);
});
test('local warmth is not systemic fever and rare vague tags remain unshown',()=>{
 assert.ok(!ids(run('Kidney.l',['侧腰痛','局部发热'],{layer:'organ'})).includes('pyelonephritis-pattern'));
 const mouth=visibleSymptoms(knowledge,{parts:['Masseter muscle.r'],layer:'muscle',kind:'signs'}).map(t=>t.id);assert.ok(!mouth.includes('鼻塞')&&!mouth.includes('脓性鼻涕'));
 const eye=visibleSymptoms(knowledge,{parts:['Palpebral part of orbicularis oculil'],layer:'muscle'}).map(t=>t.id);assert.ok(eye.includes('眼干'));
 const kidney=visibleSymptoms(knowledge,{parts:['Kidney.l'],layer:'organ',kind:'signs'}).map(t=>t.id);assert.ok(kidney.includes('血尿'));assert.ok(!kidney.includes('牙龋洞'));
 const lung=visibleSymptoms(knowledge,{parts:['Left lung'],layer:'organ',kind:'signs'}).map(t=>t.id);assert.ok(!lung.includes('黑便')&&!lung.includes('腹部僵硬')&&!lung.includes('可能怀孕'));
});
test('single selection replaces the previous area and its symptoms; reclick clears',()=>{
 let s=selectionReducer(emptySelection,{type:'toggle',part:tooth,layer:'skeleton'});const first=s.focusId;
 s=selectionReducer(s,{type:'update',id:first,patch:{feelings:['紧绷'],timing:['夜间痛'],triggers:['磨牙']}});
 s=selectionReducer(s,{type:'toggle',part:abs,layer:'muscle'});
 assert.equal(s.reports.length,1);assert.equal(s.reports[0].part,abs);
 for(const field of ['feelings','signs','timing','triggers'])assert.deepEqual(s.reports[0][field],[]);
 s=selectionReducer(s,{type:'update',id:first,patch:{feelings:['刺痛']}});assert.deepEqual(s.reports[0].feelings,[]);
 assert.doesNotThrow(()=>JSON.stringify(assessmentReports(s)));
 assert.deepEqual(selectionReducer(s,{type:'toggle',part:abs,layer:'muscle'}),emptySelection);
 assert.deepEqual(selectionReducer(s,{type:'reset'}),emptySelection);
});

test('tooth tightness produces a useful single-finding basic case, without pulpitis',()=>{
 const r=run(tooth,['紧绷']);assert.equal(r.items.length,1);const c=r.items[0];
 assert.ok(c.basic);assert.match(c.name.zh,/咬合负荷/);assert.deepEqual(c.why,['紧绷']);
 assert.match(c.shortDescription.zh,/咬紧牙|磨牙/);assert.match(c.advice.zh,/放松下颌/);
 assert.ok(!ids(r).includes('dental-pulpitis'));
 const detailed=run(tooth,['持续冷热痛','自发痛']);assert.ok(ids(detailed).includes('dental-pulpitis'));assert.ok(detailed.items.every(c=>!c.basic));
});

test('time and triggers use disjoint selector groups and no free-text controls',()=>{
 assert.ok(!knowledge.context);
 assert.ok(knowledge.timing.some(t=>t.id==='夜间痛'));assert.ok(!knowledge.feelings.some(t=>t.id==='夜间痛'));
 assert.ok(knowledge.triggers.some(t=>t.id==='磨牙'));
 const editor=fs.readFileSync(new URL('../src/ReportEditor.jsx',import.meta.url),'utf8');assert.ok(!/<textarea|<select/.test(editor));
 const dentalTriggers=visibleSymptoms(knowledge,{parts:[tooth],kind:'triggers'}).map(t=>t.id);assert.ok(dentalTriggers.includes('磨牙'));
});

test('all current selectable anatomy receives a region; position alone yields no disease',()=>{
 for(const [layer,file] of [['skeleton','skeleton-mobile.glb'],['muscle','muscle-mobile.glb'],['organ','organs-mobile.glb']]){
  const bytes=fs.readFileSync(new URL(`../public/anatomy/${file}`,import.meta.url)),json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  for(const node of json.nodes.filter(n=>n.mesh!==undefined)){
   assert.notEqual(clinicalProfile(node.name,layer).region,'general',`${layer}: ${node.name}`);
   const result=run(node.name,[],{layer});assert.equal(result.items.length,0);assert.ok(result.needsEvidence);
   const basic=run(node.name,['紧绷'],{layer});assert.ok(basic.items.length,`${layer}: ${node.name} has no basic assessment`);
   for(const card of basic.items){for(const field of ['name','shortDescription','triggers','advice','threshold'])for(const lang of ['zh','en'])assert.ok(card[field]?.[lang]?.trim(),`${node.name} ${field}.${lang}`);assert.ok(card.why.every(tag=>tag==='紧绷'));}
  }
 }
});
test('local single-area inference has bounded latency',()=>{
 const input={reports:[{part:tooth,layer:'skeleton',feelings:['紧绷'],timing:['夜间痛'],triggers:['磨牙']}]};
 for(let i=0;i<10;i++)assessSymptoms(knowledge,input);
 const start=performance.now();for(let i=0;i<200;i++)assessSymptoms(knowledge,input);const avg=(performance.now()-start)/200;
 console.log(`Single-area inference mean: ${avg.toFixed(2)}ms (desktop Node, not a phone benchmark)`);assert.ok(avg<25);
});

test('duration alone does not invent pain, and all layers expose useful time choices',()=>{
 assert.equal(run(tooth,[],{timing:['持续数小时']}).items.length,0);
 for(const [part,layer] of [[tooth,'skeleton'],['Heart','organ'],[abs,'muscle']]){const tags=visibleSymptoms(knowledge,{parts:[part],layer,kind:'timing'});assert.equal(tags.filter(t=>t.group==='duration').length,4);}
});
