import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
import {presentPriorityGuidance} from '../src/priorityGuidance.js';
import {mountEditorApp,textOf} from './helpers/editor-renderer.mjs';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const fields=['feelings','signs','timing','triggers'];
function run(tags,part='Mandible'){
 const report={part,layer:'skeleton',...Object.fromEntries(fields.map(field=>[field,tags.filter(id=>k[field].some(t=>t.id===id))]))};
 for(const field of fields){const visible=new Set(visibleSymptoms(k,{parts:[part],layer:'skeleton',kind:field}).map(t=>t.id));for(const id of report[field])assert.ok(visible.has(id),`${part}: ${id}`);}
 return assessSymptoms(k,{reports:[report]});
}
const present=result=>presentPriorityGuidance(result.urgent,result.reportedSymptoms);
for(const danger of ['吞咽困难','张口受限'])test(`oral escalation covers only repeated lower dental actions: ${danger}`,()=>{
 const result=run(['咬合痛','牙龈肿胀','自发痛','发热',danger]),before=structuredClone(result),view=present(result);
 assert.equal(result.triageLevel,'emergency');assert.ok(result.urgent.some(w=>w.level==='same-day'));assert.ok(result.urgent.some(w=>w.level==='prompt'));
 assert.ok(view.messages.every(w=>!['painful-gum-swelling-review','dental-infection-review','dental-observation-review'].includes(w.id)));
 assert.deepEqual(new Set(view.additionalDetails),new Set(['咬合痛','牙龈肿胀','自发痛','发热']));assert.deepEqual(result,before);
 for(const lang of ['zh','en'])assert.ok(view.messages.every(w=>w[lang]));
});
test('all distinct emergency instructions remain alongside oral escalation',()=>{
 const result=run(['咬合痛','牙龈肿胀','吞咽困难','张口受限','面部歪斜']),view=present(result);
 assert.ok(view.messages.some(w=>w.id==='oral-swelling-dysphagia'));assert.ok(view.messages.some(w=>w.id==='oral-swelling-restricted-opening'));
 assert.ok(view.messages.some(w=>w.zh.includes('记录起病时间')));assert.equal(view.messages.filter(w=>w.level==='emergency').length,3);
});
test('unrelated emergencies do not hide lower dental or other independent actions',()=>{
 const result=run(['突发最严重头痛','咬合痛','发热'],'Frontal bone'),view=present(result);
 assert.ok(view.messages.some(w=>w.level==='emergency'));assert.ok(view.messages.some(w=>w.id==='biting-pain-fever-review'));assert.deepEqual(view.additionalDetails,[]);
 // Presentation/API-only composition: this does not claim all observations
 // can be entered together through a single current model region.
 const oral=run(['咬合痛','牙龈肿胀','吞咽困难']).urgent;
 const other=[{id:'sudden-hearing-review',level:'same-day',zh:'独立听力',en:'hearing'},{id:'unable-to-urinate',level:'emergency',zh:'独立排尿',en:'urine'},{level:'prompt',zh:'未标注警示',en:'unidentified'}];
 const combined=presentPriorityGuidance([...oral,...other],[]);for(const warning of other)assert.ok(combined.messages.includes(warning));
});
test('coverage requires a strictly higher declared tier, never wording or ID alone',()=>{
 const lower={id:'painful-gum-swelling-review',level:'same-day',zh:'shared',en:'shared'};
 for(const level of ['same-day','prompt',undefined])assert.equal(presentPriorityGuidance([{id:'oral-swelling-dysphagia',level,zh:'oral',en:'oral'},lower],[]).messages.length,2);
 for(const level of [undefined,'unknown']){const unspecified={...lower,level};assert.ok(presentPriorityGuidance([{id:'oral-swelling-dysphagia',level:'emergency'},unspecified],[]).messages.includes(unspecified));}
 const anonymous={level:'same-day',zh:'shared',en:'shared'};
 assert.ok(presentPriorityGuidance([{id:'oral-swelling-dysphagia',level:'emergency'},anonymous],[]).messages.includes(anonymous));
});
test('saved observations and visible bilingual guidance update after removing the escalation',async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());app.select('Mandible');app.open('feelings');app.click(app.tag('咬合痛'));app.open('signs');app.click(app.tag('牙龈肿胀'));app.click(app.tag('吞咽困难'));app.open('diagnosis');
 const original=app.state.result,initial=JSON.stringify(original);assert.equal(original.triageLevel,'emergency');
 assert.match(textOf(app.cls('urgent-strip')),/立即评估/);assert.doesNotMatch(textOf(app.cls('urgent-strip')),/今天联系牙科/);assert.match(textOf(app.cls('priority-details')),/咬合痛/);
 app.navigate('#/about');app.click(app.all(n=>n.type==='button'&&n.props['aria-label']==='切换语言').at(-1));app.navigate('#/');
 assert.match(textOf(app.cls('urgent-strip')),/IMMEDIATE ASSESSMENT/);assert.doesNotMatch(textOf(app.cls('urgent-strip')),/contact a dentist today/);assert.match(textOf(app.cls('priority-details')),/pain on biting/);
 app.open('signs');app.click(app.tag('吞咽困难'));assert.equal(app.state.result,null);app.open('diagnosis');
 assert.equal(app.state.result.triageLevel,'same-day');assert.match(textOf(app.cls('urgent-strip')),/contact a dentist today/);assert.equal(app.all(n=>n.props?.className==='priority-details').length,0);
 assert.equal(JSON.stringify(original),initial,'saved facts and the previous assessment remain immutable');assert.ok(original.reportedSymptoms.includes('吞咽困难'));assert.ok(!app.state.result.reportedSymptoms.includes('吞咽困难'));
});
