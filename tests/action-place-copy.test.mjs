import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
import {reportLocationOptions} from '../src/reportLocation.js';
import {assertSelectableStructure} from './helpers/selectable-anatomy.mjs';
import {mountEditorApp,textOf} from './helpers/editor-renderer.mjs';
const knowledge=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const fields=['feelings','signs','timing','triggers'];
function assess(part,layer,tags,location='unknown'){
 assertSelectableStructure(part,layer);
 for(const tag of tags)assert.ok(fields.some(field=>knowledge[field].some(t=>t.id===tag)),tag);
 const report={part,layer,location,...Object.fromEntries(fields.map(field=>[field,tags.filter(tag=>knowledge[field].some(t=>t.id===tag))]))};
 for(const field of fields){const visible=new Set(visibleSymptoms(knowledge,{parts:[part],layer,kind:field}).map(t=>t.id));for(const tag of report[field])assert.ok(visible.has(tag),`${part}: ${field}: ${tag}`);}
 if(location!=='unknown')assert.ok(reportLocationOptions(report).some(([id])=>id===location));
 return assessSymptoms(knowledge,{reports:[report]});
}
const rlqWarning=result=>result.urgent.find(w=>w.zh.startsWith('右下腹迁移痛'));
const swellingWarning=result=>result.urgent.find(w=>w.zh.startsWith('已报告肿胀'));
test('right-lower warning keeps urgent same-day assessment without requiring an additional fever selection',()=>{
 const results=[assess('Rectus abdominis muscle.r','muscle',['腹痛迁移至右下腹'])];
 for(const part of ['Rectus abdominis muscle.r','Levator ani.or'])for(const tags of [['疼痛','持续加重'],['局部压痛','持续加重'],['夜间痛','持续加重'],['疼痛','持续加重','发热']])results.push(assess(part,'muscle',tags,'rlq'));
 for(const result of results){
  assert.equal(result.triageLevel,'same-day');const warning=rlqWarning(result);assert.ok(warning);
  assert.match(warning.zh,/当天尽快就医评估/);assert.match(warning.en,/urgent same-day medical assessment/);
  assert.doesNotMatch(warning.zh,/急诊/);assert.equal(warning.level,'same-day');
 }
});
test('the right-lower action still requires its existing pain, progression and actual-location facts',()=>{
 for(const part of ['Rectus abdominis muscle.r','Levator ani.or'])for(const [tags,location] of [[['疼痛'],'rlq'],[['持续加重'],'rlq'],[['疼痛','持续加重'],'unknown'],[['疼痛','持续加重'],'diffuse']])assert.equal(rlqWarning(assess(part,'muscle',tags,location)),undefined);
});
test('swelling with systemic symptoms does not turn a selected whole bone into confirmed joint involvement',()=>{
 for(const part of ['Patella.r','Humerus.r']){
  for(const tags of [['局部肿胀','发热'],['红肿','发冷']]){
   const result=assess(part,'skeleton',tags),warning=swellingWarning(result);
   assert.equal(result.triageLevel,'same-day');assert.ok(warning);
   assert.match(warning.zh,/已报告肿胀伴发热或发冷\/寒战/);assert.match(warning.zh,/今天尽快就医评估/);
   assert.match(warning.zh,/检查确认是否涉及关节或周围组织/);assert.doesNotMatch(warning.zh,/关节区域肿胀|关节感染。/);
   assert.match(warning.en,/urgent medical assessment today/);assert.match(warning.en,/determine whether a joint or surrounding tissues are involved/);
  }
  for(const tags of [['局部肿胀'],['发热']])assert.equal(swellingWarning(assess(part,'skeleton',tags)),undefined);
 }
});
test('independent emergency actions remain ahead of same-day wording and replace card advice',()=>{
 for(const result of [assess('Rectus abdominis muscle.r','muscle',['疼痛','持续加重','晕厥'],'rlq'),assess('Humerus.r','skeleton',['局部肿胀','发热','突然单侧无力'])]){
  assert.equal(result.triageLevel,'emergency');assert.equal(result.urgent[0].level,'emergency');
  assert.ok(result.urgent.some(w=>w.level==='same-day'));
  for(const item of result.items)for(const lang of ['zh','en'])assert.equal(item.advice[lang],result.urgent[0][lang]);
 }
});
for(const fixture of [
 {part:'Rectus abdominis muscle.r',layer:'muscle',tags:['腹痛迁移至右下腹'],warning:rlqWarning},
 {part:'Humerus.r',layer:'skeleton',tags:['局部肿胀','发热'],warning:swellingWarning}
])test(`saved same-day action translates without a fresh assessment: ${fixture.part}`,async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());
 if(fixture.layer==='muscle')app.layer('muscle');app.select(fixture.part);app.open('signs');for(const id of fixture.tags)app.click(app.tag(id));app.open('diagnosis');
 const result=app.state.result,selection=app.state.selection,before=JSON.stringify(result),warning=fixture.warning(result);assert.ok(warning);
 assert.ok(textOf(app.cls('urgent-strip')).includes(warning.zh));
 app.click(app.find(node=>node.type==='button'&&node.props?.['aria-label']==='切换语言'));
 assert.ok(textOf(app.cls('urgent-strip')).includes(warning.en));assert.equal(app.state.result,result);assert.equal(app.state.selection,selection);assert.equal(JSON.stringify(result),before);
});
