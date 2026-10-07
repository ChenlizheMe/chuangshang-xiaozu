import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';import {buildSync} from 'esbuild';
import {assessSymptoms} from '../src/clinicalEngine.js';import {reportLocationOptions} from '../src/reportLocation.js';import {selectionReducer,emptySelection,assessmentReports} from '../src/selectionState.js';import {visibleSymptoms} from '../src/symptomFilters.js';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));const f=JSON.parse(fs.readFileSync(new URL('./fixtures/confirmed-flank-cases.json',import.meta.url)));const fields=['feelings','signs','timing','triggers'];
for(const c of f.cases)test(`confirmed flank boundary: ${c.name}`,()=>{const r=c.input,v=new Set(fields.flatMap(kind=>visibleSymptoms(k,{parts:[r.part],layer:r.layer,kind}).map(t=>t.id)));for(const tag of fields.flatMap(field=>r[field]||[]))assert.ok(v.has(tag),tag);const a=assessSymptoms(k,{reports:[r]});assert.equal(a.triageLevel,c.wantLevel);if(!r.feelings?.includes('侧腰痛'))assert.ok(!a.items.some(x=>x.id==='pyelonephritis-pattern'));});
const require=createRequire(import.meta.url);const code=buildSync({entryPoints:[new URL('../src/ReportEditor.jsx',import.meta.url).pathname],bundle:true,platform:'node',format:'cjs',external:['react'],write:false}).outputFiles[0].text;const module={exports:{}};new Function('module','exports','require',code)(module,module.exports,require);const Editor=module.exports.default;
const buttons=node=>Array.isArray(node)?node.flatMap(buttons):node?.type==='button'?[node]:node?.props?buttons(node.props.children):[];
test('actual editor/reducer sequence retains an editable confirmed location after symptom removal',()=>{
 let state=selectionReducer(emptySelection,{type:'toggle',part:'Pectineus muscle.r',layer:'muscle'});
 const click=(text,kind='feelings',lang='zh')=>{const focused=state.reports[0];const tree=Editor({knowledge:k,focused,kind,lang,onUpdate:patch=>{state=selectionReducer(state,{type:'update',id:focused.id,patch});}});const button=buttons(tree).find(b=>b.props.children===text);assert.ok(button,text);button.props.onClick();};
 const run=()=>assessSymptoms(k,{reports:assessmentReports(state)});
 click('绞痛');click('发烧 / 体温升高','signs');click('侧腰腹');assert.equal(run().triageLevel,'emergency');
 click('绞痛');assert.deepEqual(state.reports[0].feelings,[]);assert.equal(state.reports[0].location,'flank');assert.ok(reportLocationOptions(state.reports[0]).some(([id])=>id==='flank'));
 click('Pain / hard to describe','feelings','en');assert.equal(run().triageLevel,'same-day');assert.ok(!run().items.some(c=>c.id==='pyelonephritis-pattern'));
 click('Diffuse','feelings','en');assert.equal(run().triageLevel,null);assert.ok(reportLocationOptions(state.reports[0]).some(([id])=>id==='unknown'));
});
test('a clicked kidney reference does not supply the explicit flank observation',()=>{
 const r={part:'Kidney.l',layer:'organ',location:'unknown',feelings:['疼痛'],signs:['发热']};const a=assessSymptoms(k,{reports:[r]});assert.equal(a.triageLevel,null);
 assert.equal(assessSymptoms(k,{reports:[{...r,location:'flank'}]}).triageLevel,'same-day');
});
