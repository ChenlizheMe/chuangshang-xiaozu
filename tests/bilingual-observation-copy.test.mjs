import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
import {assertSelectableStructure} from './helpers/selectable-anatomy.mjs';
import {mountEditorApp,textOf} from './helpers/editor-renderer.mjs';

const knowledge=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const fields=['feelings','signs','timing','triggers'];
function assess(part,tags){
 assertSelectableStructure(part,'skeleton');
 const report={part,layer:'skeleton',...Object.fromEntries(fields.map(field=>[field,tags.filter(id=>knowledge[field].some(tag=>tag.id===id))]))};
 for(const field of fields){const visible=new Set(visibleSymptoms(knowledge,{parts:[part],layer:'skeleton',kind:field}).map(tag=>tag.id));for(const tag of report[field])assert.ok(visible.has(tag));}
 return assessSymptoms(knowledge,{reports:[report]});
}
test('newly noticed slurred speech keeps its existing action without asserting a known sudden onset',()=>{
 const label=knowledge.signs.find(tag=>tag.id==='说话含糊');
 assert.equal(label.zh,'新出现说话含糊');assert.equal(label.en,'New slurred speech');
 const result=assess('Frontal bone',['说话含糊']),sudden=assess('Frontal bone',['说话含糊','突然起病']);
 assert.equal(result.triageLevel,'emergency');assert.deepEqual(result.urgent,sudden.urgent);
 assert.deepEqual(result.reportedSymptoms,['说话含糊'],'display copy does not insert a sudden-onset fact');
 const timingOnly=assess('Frontal bone',['突然起病']);assert.equal(timingOnly.triageLevel,null);assert.deepEqual(timingOnly.items,[]);
 for(const lang of ['zh','en'])assert.ok(result.items.every(item=>item.advice[lang]===result.urgent[0][lang]));
});
test('thermal relief names the stimulus relationship while preserving the two-observation gate and exclusion',()=>{
 const label=knowledge.feelings.find(tag=>tag.id==='刺激去除即缓解');
 assert.equal(label.zh,'冷热刺激一停就好');assert.equal(label.en,'Pain stops when hot/cold stimulus ends');
 const result=assess('Lower canine.l',['冷热敏感','刺激去除即缓解']);
 assert.equal(result.triageLevel,null);assert.ok(result.items.some(item=>item.id==='dentin-sensitivity'));
 for(const tags of [['冷热敏感'],['刺激去除即缓解']]){
  const one=assess('Lower canine.l',tags);assert.equal(one.triageLevel,null);assert.ok(one.items.every(item=>item.basic));
 }
 const lingering=assess('Lower canine.l',['冷热敏感','刺激去除即缓解','持续冷热痛']);
 assert.equal(lingering.triageLevel,'prompt');assert.ok(!lingering.items.some(item=>item.id==='dentin-sensitivity'));
});
test('the headache reference safety net retains fever AND neck stiffness without inventing reported findings',()=>{
 const result=assess('Frontal bone',['紧箍感','双侧头痛']);
 const card=result.items.find(item=>item.id==='head-pressure-pattern');assert.ok(card);assert.equal(result.triageLevel,null);
 assert.match(card.threshold.zh,/伴发热和颈部僵硬/);assert.doesNotMatch(card.threshold.zh,/高热/);
 assert.match(card.threshold.zh,/立即急诊/);assert.match(card.threshold.en,/fever with stiff neck/);
 assert.ok(!result.reportedSymptoms.includes('发热'));assert.deepEqual(result.urgent,[]);
 for(const tag of ['紧箍感','双侧头痛'])assert.ok(!assess('Frontal bone',[tag]).items.some(item=>item.id==='head-pressure-pattern'));
});
for(const fixture of [
 {part:'Frontal bone',tags:['说话含糊'],kind:'signs',id:'说话含糊',label:'New slurred speech'},
 {part:'Lower canine.l',tags:['冷热敏感','刺激去除即缓解'],kind:'feelings',id:'刺激去除即缓解',label:'Pain stops when hot/cold stimulus ends'}
])test(`actual editor language switching keeps the same selected observations: ${fixture.id}`,async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());
 app.select(fixture.part);app.open(fixture.kind);for(const id of fixture.tags)app.click(app.tag(id));
 const selection=app.state.selection;
 app.click(app.find(node=>node.type==='button'&&node.props['aria-label']==='切换语言'));
 assert.equal(textOf(app.tag(fixture.id)),fixture.label);assert.equal(app.tag(fixture.id).props['aria-pressed'],true);assert.equal(app.state.selection,selection);
 app.open('diagnosis');const result=app.state.result,before=JSON.stringify(result);
 app.click(app.find(node=>node.type==='button'&&node.props['aria-label']==='Switch language'));
 assert.equal(app.state.result,result);assert.equal(JSON.stringify(result),before);assert.equal(app.state.selection,selection);
 assert.deepEqual(result.reportedSymptoms,assess(fixture.part,fixture.tags).reportedSymptoms);
});
