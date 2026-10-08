import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
import {assertSelectableStructure} from './helpers/selectable-anatomy.mjs';
import {mountEditorApp,textOf} from './helpers/editor-renderer.mjs';

const knowledge=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const part='Anterior longitudinal ligament';
const fields=['feelings','signs','timing','triggers'];
const referenceId='urinary-tract-infection-pattern';
function assess(tags){
 assertSelectableStructure(part,'skeleton');
 for(const tag of tags)assert.ok(fields.some(field=>knowledge[field].some(item=>item.id===tag)),`Known observation ID: ${tag}`);
 const report={part,layer:'skeleton',location:'unknown',...Object.fromEntries(fields.map(field=>[field,tags.filter(id=>knowledge[field].some(tag=>tag.id===id))]))};
 for(const field of fields){
  const visible=new Set(visibleSymptoms(knowledge,{parts:[part],layer:'skeleton',kind:field}).map(tag=>tag.id));
  for(const tag of report[field])assert.ok(visible.has(tag),`${field}: ${tag}`);
 }
 return assessSymptoms(knowledge,{reports:[report]});
}
test('urinary reference retains prompt assessment and leaves testing to a clinician',()=>{
 for(const second of ['尿频','尿急']){
  const result=assess(['尿痛',second]),card=result.items.find(item=>item.id===referenceId);
  assert.ok(card);assert.equal(result.triageLevel,null);assert.deepEqual(result.urgent,[]);
  assert.match(card.advice.zh,/尽快就医评估排尿症状/);
  assert.match(card.advice.zh,/是否需要尿检由医护决定/);
  assert.match(card.advice.en,/prompt assessment of urinary symptoms/);
  assert.match(card.advice.en,/a clinician can decide whether a urine test is needed/);
  assert.match(card.advice.zh,/平时适量水分/);assert.match(card.advice.en,/usual appropriate fluid intake/);
 }
 for(const tags of [['尿痛'],['尿频'],['尿急']])assert.ok(!assess(tags).items.some(item=>item.id===referenceId));
});
test('existing urinary priorities replace supportive reference advice in both languages',()=>{
 for(const [sign,level] of [['发热','same-day'],['血尿','prompt'],['排尿困难','emergency']]){
  const result=assess(['尿痛','尿频',sign]),card=result.items.find(item=>item.id===referenceId);
  assert.ok(card);assert.equal(result.triageLevel,level);assert.ok(result.urgent.length);
  for(const lang of ['zh','en']){
   assert.equal(card.advice[lang],result.urgent[0][lang]);
   assert.notEqual(card.advice[lang],knowledge.conditions.find(item=>item.id===referenceId).advice[lang]);
  }
 }
});
test('the saved urinary report translates the advice without changing its observations or result',async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());
 app.select(part);app.open('feelings');app.click(app.tag('尿痛'));
 app.open('signs');app.click(app.tag('尿频'));app.open('diagnosis');
 const result=app.state.result,selection=app.state.selection,before=JSON.stringify(result);
 assert.match(textOf(app.cls('cards')),/是否需要尿检由医护决定/);
 app.click(app.find(node=>node.type==='button'&&node.props['aria-label']==='切换语言'));
 assert.match(textOf(app.cls('cards')),/a clinician can decide whether a urine test is needed/);
 assert.equal(app.state.result,result);assert.equal(app.state.selection,selection);assert.equal(JSON.stringify(result),before);
});
