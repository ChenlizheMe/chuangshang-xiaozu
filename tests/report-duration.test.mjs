import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';import {buildSync} from 'esbuild';import {visibleSymptoms} from '../src/symptomFilters.js';
const require=createRequire(import.meta.url);const code=buildSync({entryPoints:[new URL('../src/ReportEditor.jsx',import.meta.url).pathname],bundle:true,platform:'node',format:'cjs',external:['react'],write:false}).outputFiles[0].text;const module={exports:{}};new Function('module','exports','require',code)(module,module.exports,require);const Editor=module.exports.default;
const knowledge=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const buttons=node=>Array.isArray(node)?node.flatMap(buttons):node?.type==='button'?[node]:node?.props?buttons(node.props.children):[];
const editor=()=>{let focused={part:'Nasal bone.r',layer:'skeleton',feelings:[],signs:[],timing:[],triggers:[],location:'unknown'};return {get report(){return focused;},click(id,lang){const label=knowledge.timing.find(t=>t.id===id)?.[lang];const tree=Editor({knowledge,focused,kind:'feelings',lang,onUpdate:patch=>{focused={...focused,...patch};}});const button=buttons(tree).find(b=>b.props.children===label);assert.ok(button,`${lang}: ${id} must be a real selectable button`);button.props.onClick();}};};
const durations=['刚刚开始','持续数小时','持续1至3天','持续超过3天','持续超过10天'];
test('every pair of real duration buttons replaces the earlier choice across both languages',()=>{
 for(const from of durations)for(const to of durations){const e=editor();e.click(from,'zh');e.click(to,'en');assert.deepEqual(e.report.timing,from===to?[]:[to],`${from} -> ${to}`);}
});
test('duration replacement keeps independent onset and progression observations',()=>{
 const e=editor();e.click('突然起病','zh');e.click('持续加重','en');e.click('持续超过10天','zh');e.click('持续数小时','en');
 assert.deepEqual(new Set(e.report.timing),new Set(['突然起病','持续加重','持续数小时']));
 e.click('持续数小时','zh');assert.deepEqual(new Set(e.report.timing),new Set(['突然起病','持续加重']));
});
test('the regional long-duration choice does not become a new universal button',()=>{
 for(const [part,layer,count]of [['Nasal bone.r','skeleton',5],['Upper first molar tooth.r','skeleton',4],['Heart','organ',4],['Rectus abdominis muscle.r','muscle',4]]){
  const timing=visibleSymptoms(knowledge,{parts:[part],layer,kind:'timing'});assert.equal(timing.filter(t=>t.group==='duration').length,count,part);assert.equal(timing.some(t=>t.id==='持续超过10天'),count===5,part);
 }
});
