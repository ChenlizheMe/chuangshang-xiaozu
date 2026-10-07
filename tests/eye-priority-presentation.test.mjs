import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
import {presentPriorityGuidance} from '../src/priorityGuidance.js';
import {assertSelectableStructure} from './helpers/selectable-anatomy.mjs';
import {mountEditorApp,textOf} from './helpers/editor-renderer.mjs';

const knowledge=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const part='Palpebral part of orbicularis oculi.l',layer='muscle';
const fields=['feelings','signs','timing','triggers'];
function run(tags,structure=part){
 assertSelectableStructure(structure,layer);
 const report={part:structure,layer,...Object.fromEntries(fields.map(field=>[field,tags.filter(id=>knowledge[field].some(tag=>tag.id===id))]))};
 for(const field of fields){
  const available=new Set(visibleSymptoms(knowledge,{parts:[structure],layer,kind:field}).map(tag=>tag.id));
  for(const id of report[field])assert.ok(available.has(id),`${field}: ${id}`);
 }
 return assessSymptoms(knowledge,{reports:[report]});
}
const present=result=>presentPriorityGuidance(result.urgent,result.reportedSymptoms,result.profiles);
const ids=warnings=>warnings.map(warning=>warning.id);
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}

test('same eye-injury escalation removes only its repeated review and preserves saved observations',()=>{
 for(const discomfort of ['灼烧','刺痛','酸涩','夜间痛','异物感','流脓'])for(const danger of ['眼红','畏光','视物模糊','复视']){
  const result=run([discomfort,'外伤后',danger]),before=structuredClone(result);freeze(result);
  const view=present(result);
  assert.equal(result.triageLevel,'emergency');
  assert.ok(result.urgent.some(w=>w.id==='eye-injury-review'));
  assert.deepEqual(view.messages,result.urgent.filter(w=>w.id!=='eye-injury-review'));
  assert.deepEqual(new Set(view.additionalDetails),new Set([discomfort,'外伤后',danger]));
  for(const warning of view.messages)assert.ok(result.urgent.includes(warning),'retain original warning identity and order');
  assert.deepEqual(result,before,'presentation must not rewrite clinical output');
 }
});

test('eye presentation retains distinct visual, drainage, neurological and unknown warnings',()=>{
 for(const extra of [['复视','突然起病'],['复视'],['流脓'],['面部歪斜']]){
  const result=run(['夜间痛','外伤后','眼红',...extra]),view=present(result);
  assert.deepEqual(ids(view.messages),ids(result.urgent).filter(id=>id!=='eye-injury-review'));
 }
 const result=run(['夜间痛','外伤后','眼红']);
 const others=[{id:'unrelated',level:'same-day',zh:'独立行动',en:'Independent action'},
  {level:'emergency',zh:'独立紧急',en:'Independent emergency'},
  {level:'prompt',zh:'匿名行动',en:'Anonymous action'},
  {id:'unknown',level:'unknown',zh:'未知',en:'Unknown'}];
 const view=presentPriorityGuidance([...result.urgent,...others],result.reportedSymptoms,result.profiles);
 for(const other of others)assert.ok(view.messages.includes(other));
 const review=result.urgent.find(w=>w.id==='eye-injury-review');
 assert.ok(presentPriorityGuidance([others[1],review],result.reportedSymptoms,result.profiles).messages.includes(review),
  'an unrelated emergency cannot cover an eye-injury review');
});

test('eye coverage fails closed without one saved eye profile and a nonempty observation snapshot',()=>{
 const result=run(['夜间痛','外伤后','眼红']);
 for(const profiles of [undefined,null,[],[null],[{region:'head'}],result.profiles.concat(result.profiles),{0:result.profiles[0],length:1}]){
  assert.deepEqual(presentPriorityGuidance(result.urgent,result.reportedSymptoms,profiles),{messages:result.urgent,additionalDetails:[]});
 }
 for(const observations of [undefined,null,[],{},'夜间痛'])assert.deepEqual(presentPriorityGuidance(result.urgent,observations,result.profiles),{messages:result.urgent,additionalDetails:[]});
 // API-only composition: the current engine consumes one report. Combining
 // warnings from opposite eyes cannot establish that they describe one event.
 const left=run(['夜间痛','外伤后']);
 const right=run(['眼红','外伤后'],'Palpebral part of orbicularis oculi.r');
 const warnings=[...right.urgent,...left.urgent],observations=[...right.reportedSymptoms,...left.reportedSymptoms];
 assert.deepEqual(presentPriorityGuidance(warnings,observations).messages,warnings);
 assert.deepEqual(presentPriorityGuidance(warnings,observations,[...right.profiles,...left.profiles]).messages,warnings);
});

test('eye coverage requires exact IDs and explicitly known strictly higher tiers',()=>{
 const result=run(['夜间痛','外伤后','眼红']);
 const high=result.urgent.find(w=>w.id==='eye-injury-warning'),low=result.urgent.find(w=>w.id==='eye-injury-review');
 for(const level of ['same-day','prompt','unknown',undefined]){
  assert.ok(presentPriorityGuidance([{...high,level},low],result.reportedSymptoms,result.profiles).messages.includes(low));
 }
 for(const level of ['emergency','unknown',undefined]){
  const lower={...low,level};
  assert.ok(presentPriorityGuidance([high,lower],result.reportedSymptoms,result.profiles).messages.includes(lower));
 }
 const anonymous={...low,id:undefined};
 assert.ok(presentPriorityGuidance([high,anonymous],result.reportedSymptoms,result.profiles).messages.includes(anonymous));
 const view=presentPriorityGuidance(result.urgent,['夜间痛','夜间痛','外伤后','侧腰痛','运动诱发胸闷','unknown-input'],result.profiles);
 assert.deepEqual(view.additionalDetails,['夜间痛','外伤后'],'remote or unknown observations are not summarized as eye-injury details');
});

test('without eye escalation the complete existing review remains visible',()=>{
 for(const tags of [['夜间痛'],['外伤后'],['夜间痛','外伤后'],['刺痛','外伤后'],['夜间痛','眼红','复视']]){
  const result=run(tags);assert.deepEqual(present(result),{messages:result.urgent,additionalDetails:[]});
 }
});

for(const danger of ['眼红','复视'])test(`actual App keeps saved bilingual eye facts and restores the review after removing ${danger}`,async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());
 app.layer(layer);app.select(part);app.open('feelings');app.click(app.tag('夜间痛'));app.click(app.tag('外伤后'));
 app.open('signs');app.click(app.tag(danger));app.open('diagnosis');
 const original=app.state.result,before=structuredClone(original);freeze(original);
 for(const lang of ['zh','en']){
  if(app.state.lang!==lang){app.navigate('#/about');app.click(app.all(n=>n.type==='button'&&n.props['aria-label']==='切换语言').at(-1));app.navigate('#/');}
  assert.equal(app.state.result,original);
  const paragraphs=app.cls('urgent-strip').children.filter(n=>n.type==='p'&&n.props.className!=='priority-details').map(textOf);
  assert.deepEqual(paragraphs,original.urgent.filter(w=>w.id!=='eye-injury-review').map(w=>w[lang]));
  const details=textOf(app.cls('priority-details'));
  for(const id of ['夜间痛','外伤后',danger])assert.ok(details.includes(fields.flatMap(field=>knowledge[field]).find(tag=>tag.id===id)[lang]));
 }
 app.open('signs');app.click(app.tag(danger));assert.equal(app.state.result,null);app.open('diagnosis');
 assert.equal(app.state.result.triageLevel,'same-day');
 assert.deepEqual(ids(app.state.result.urgent),['eye-injury-review']);
 assert.match(textOf(app.cls('urgent-strip')),/needs same-day eye assessment/);
 assert.equal(app.all(n=>n.props?.className==='priority-details').length,0);
 assert.deepEqual(original,before,'editing and reassessment cannot change the saved emergency result');
});
