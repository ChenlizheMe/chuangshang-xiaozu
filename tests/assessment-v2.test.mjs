import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {assessSymptoms,normalizeReport} from '../src/clinicalEngine.js';
import {CLINICAL_RULES} from '../src/clinicalRules.js';
import {interpretText,evidenceFamily} from '../src/symptomLanguage.js';
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
 if(expected)assert.ok(ids(result).includes(expected),`${expected} absent: ${ids(result)}`);else assert.equal(result.items.length,0,ids(result).join(','));
 for(const c of result.items){assert.ok(c.evidenceFamilies.length>=2);assert.ok(new Set(c.why.map(evidenceFamily)).size>=2);assert.ok(c.why.every(t=>!t.includes('bone')&&!t.includes('muscle')));}
});

test('every active branch and tag has a reviewed definition and concise bilingual copy',()=>{
 assert.equal(knowledge.conditions.length,75);
 assert.deepEqual(new Set(knowledge.conditions.map(c=>c.id)),new Set(Object.keys(CLINICAL_RULES)));
 const tags=[...knowledge.feelings,...knowledge.signs,...knowledge.context],tagIds=new Set(tags.map(t=>t.id));
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
 const r=assessSymptoms(knowledge,{parts:[tooth,tooth],feelings:['冷热敏感'],signs:['鼻塞']});assert.equal(r.items.length,0);
 assert.equal(run('Frontal bone',['牙龋洞','冷热敏感']).items.length,0);
});
test('regional reports never combine unrelated local symptoms',()=>{
 const r=assessSymptoms(knowledge,{reports:[{part:tooth,layer:'skeleton',feelings:['刺痛']},{part:abs,layer:'muscle',feelings:['持续冷热痛','自发痛'],signs:['呕吐']}]});
 assert.ok(!ids(r).includes('dental-pulpitis'));assert.ok(!ids(r).includes('gastroenteritis-pattern'));
});
test('multiple reports keep independent matching results and deduplicate the same direction',()=>{
 const r=assessSymptoms(knowledge,{reports:[{part:tooth,layer:'skeleton',feelings:['持续冷热痛','刺痛']},{part:abs,layer:'muscle',feelings:['绞痛'],signs:['腹泻']},{part:'Upper first molar tooth.l',layer:'skeleton',feelings:['持续冷热痛','自发痛']}]});
 assert.ok(ids(r).includes('dental-pulpitis')&&ids(r).includes('gastroenteritis-pattern'));
 assert.equal(r.items.filter(c=>c.id==='dental-pulpitis').length,1);assert.equal(r.items.find(c=>c.id==='dental-pulpitis').partRefs.length,2);
});
test('systemic fever can inform another area, local dental pain cannot',()=>{
 const r=assessSymptoms(knowledge,{reports:[{part:tooth,layer:'skeleton',signs:['发热'],feelings:['咬合痛']},{part:'Kidney.l',layer:'organ',feelings:['侧腰痛']}]});assert.ok(ids(r).includes('pyelonephritis-pattern'));
});
test('vague pain words normalize without inventing pulpitis hallmarks',()=>{
 const a=run(tooth,[],{text:'牙齿牵扯痛，也有针扎和刺痛'});assert.equal(a.items.length,0);
 const b=run(tooth,[],{text:'牙齿牵扯着痛，喝冷水后还疼很久，没碰也痛'});assert.ok(ids(b).includes('dental-pulpitis'));
});
test('negation, overlapping phrases and conflicts remain explicit',()=>{
 const a=interpretText('没有发烧和呕吐，但牙痛，没碰也痛');assert.ok(a.denied.includes('发热')&&a.denied.includes('呕吐'));assert.ok(a.findings.some(f=>f.id==='自发痛'));
 const b=interpretText('局部发热');assert.deepEqual(b.findings.map(f=>f.id),['局部发热']);
 const r=normalizeReport({feelings:[],signs:['发热'],text:'没有发烧'});assert.deepEqual(r.conflicts,['发热']);assert.ok(r.tags.has('发热'));
 assert.ok(!ids(run(tooth,[],{text:'刺痛，没有自发痛，也没有持续冷热痛'})).includes('dental-pulpitis'));
});
test('location from plain language is usable, explicit selection has priority',()=>{
 assert.ok(ids(run(abs,[],{layer:'muscle',text:'右下腹疼痛越来越痛'})).includes('appendicitis-pattern'));
 assert.ok(!ids(run(abs,[],{layer:'muscle',location:'llq',text:'右下腹疼痛越来越痛'})).includes('appendicitis-pattern'));
});
test('urgent warnings survive missing evidence and suppress lifestyle reassurance',()=>{
 const a=run(abs,['呕血'],{layer:'muscle'});assert.ok(a.urgent.length);assert.equal(a.items.length,0);
 const b=run('Frontal bone',['突发最严重头痛','睡眠不足','白天困倦']);assert.ok(b.urgent.length);assert.ok(!ids(b).includes('sleep-deprivation'));
 const c=run('Tibia.l',['单侧肿胀']);assert.ok(c.urgent.length);assert.equal(c.items.length,0);
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
test('contradictory reports cannot satisfy a local or shared disease gate',()=>{
 const a=run('Kidney.l',['侧腰痛'],{layer:'organ',signs:['发热'],text:'没有发烧'});assert.ok(a.conflicts.includes('发热'));assert.ok(!ids(a).includes('pyelonephritis-pattern'));
 const b=assessSymptoms(knowledge,{reports:[{part:tooth,layer:'skeleton',signs:['发热'],text:'没有发烧'},{part:'Kidney.l',layer:'organ',feelings:['侧腰痛']}]});assert.ok(!ids(b).includes('pyelonephritis-pattern'));
 const c=interpretText('有发烧，没有发烧');assert.ok(c.findings.some(f=>f.id==='发热')&&c.denied.includes('发热'));
});
test('isolated chest pressure keeps action guidance without inventing a cardiac diagnosis',()=>{
 const r=run('Heart',['压迫感'],{layer:'organ'});assert.equal(r.items.length,0);assert.ok(r.urgent.length);
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
test('selection toggle/focus/reset preserves per-area symptoms across layers',()=>{
 let s=selectionReducer(emptySelection,{type:'toggle',part:tooth,layer:'skeleton'});const first=s.focusId;
 s=selectionReducer(s,{type:'update',id:first,patch:{feelings:['刺痛'],text:'牙疼'}});
 s=selectionReducer(s,{type:'toggle',part:abs,layer:'muscle'});const second=s.focusId;
 s=selectionReducer(s,{type:'update',id:second,patch:{signs:['腹泻']}});
 s=selectionReducer(s,{type:'focus',id:first});assert.deepEqual(s.reports[0].feelings,['刺痛']);assert.deepEqual(s.reports[1].signs,['腹泻']);
 assert.doesNotThrow(()=>JSON.stringify(assessmentReports(s)));
 s=selectionReducer(s,{type:'toggle',part:tooth,layer:'skeleton'});assert.equal(s.reports.length,1);assert.equal(s.focusId,second);
 assert.deepEqual(selectionReducer(s,{type:'reset'}),emptySelection);
});
test('all current selectable anatomy receives a region; position alone yields no disease',()=>{
 for(const [layer,file] of [['skeleton','skeleton-mobile.glb'],['muscle','muscle-mobile.glb'],['organ','organs-mobile.glb']]){
  const bytes=fs.readFileSync(new URL(`../public/anatomy/${file}`,import.meta.url)),json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  for(const node of json.nodes.filter(n=>n.mesh!==undefined)){
   assert.notEqual(clinicalProfile(node.name,layer).region,'general',`${layer}: ${node.name}`);
   const result=run(node.name,[],{layer});assert.equal(result.items.length,0);assert.ok(result.needsEvidence);
  }
 }
});
test('local inference has bounded latency for multiple regions',()=>{
 const input={reports:[{part:tooth,layer:'skeleton',text:'喝冷水后还疼很久，没碰也痛'},{part:abs,layer:'muscle',feelings:['绞痛'],signs:['腹泻']},{part:back,layer:'skeleton',feelings:['酸痛'],context:['久坐后','活动后缓解']}]};
 for(let i=0;i<10;i++)assessSymptoms(knowledge,input);
 const start=performance.now();for(let i=0;i<200;i++)assessSymptoms(knowledge,input);const avg=(performance.now()-start)/200;
 console.log(`3-area inference mean: ${avg.toFixed(2)}ms (desktop Node, not a phone benchmark)`);assert.ok(avg<25);
});
