import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import postcss from 'postcss';
const require=createRequire(import.meta.url);
const compiled=buildSync({entryPoints:[new URL('../src/ReportEditor.jsx',import.meta.url).pathname],bundle:true,platform:'node',format:'cjs',external:['react'],write:false}).outputFiles[0].text;
const module={exports:{}};new Function('module','exports','require',compiled)(module,module.exports,require);
const Editor=module.exports.default;
const knowledge=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const report={part:'Anterior longitudinal ligament',layer:'skeleton',feelings:['绞痛'],signs:['血尿'],timing:[],triggers:[],location:'flank'};
const render=(focused,kind='feelings',lang='zh')=>renderToStaticMarkup(React.createElement(Editor,{knowledge,focused,kind,lang,onUpdate:()=>{}}));
test('the actual report editor renders reused flank controls and selected state',()=>{
 const html=render(report);assert.match(html,/侧腰腹/);assert.match(html,/aria-pressed="true" class="location-chip selected"/);
 assert.doesNotMatch(html,/右上腹|左下腹/);
 assert.match(html,/时间/);assert.match(html,/诱因与缓解因素/);
});
test('ordinary urinary-only inputs do not render dead-end location controls',()=>{
 const html=render({...report,feelings:['尿痛'],signs:[],location:'unknown'});
 assert.doesNotMatch(html,/location-grid/);
});
test('the real English signs panel has no timing section or Chinese placeholders',()=>{
 const html=render(report,'signs','en');assert.match(html,/blood in urine/);
 assert.doesNotMatch(html,/TIMING|\p{Script=Han}/u);
});
test('empty report input has guidance without fake symptoms or input fields',()=>{
 const html=render(null);assert.match(html,/先点击模型/);assert.doesNotMatch(html,/<button|<input|<textarea|<select/);
});
test('native motion and compact mobile layouts have explicit accessible fallbacks',()=>{
 const css=fs.readFileSync(new URL('../src/cassette.css',import.meta.url),'utf8');const tree=postcss.parse(css);assert.ok(tree.nodes.length);
 assert.match(css,/button\{min-width:44px;min-height:44px/);
 assert.match(css,/\.sticker-sheet\.empty-sheet\{top:auto;height:auto;max-height:45%/);
 assert.match(css,/\[data-lang=en\] \.part-selection\{font-size:clamp\(17px,4.8vw,21px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url)));assert.ok(!pkg.dependencies.gsap);
});

test('English report labels have a non-overlapping narrow-screen layout',()=>{
 const css=fs.readFileSync(new URL('../src/cassette.css',import.meta.url),'utf8');
 const tree=postcss.parse(css);let stacked=false;
 tree.walkAtRules('media',media=>{if(media.params==='(max-width:700px)')media.walkRules('[data-lang=en] .card-field',rule=>{rule.walkDecls('grid-template-columns',decl=>{if(decl.value==='minmax(0,1fr)')stacked=true;});});});
 assert.ok(stacked,'English labels and values must stack inside narrow report panels');
});
test('priority reference cards do not show a numbered diagnostic ranking',()=>{
 const source=buildSync({entryPoints:[new URL('../src/DiagnosisCard.jsx',import.meta.url).pathname],bundle:true,platform:'node',format:'cjs',external:['react'],write:false}).outputFiles[0].text;
 const cardModule={exports:{}};new Function('module','exports','require',source)(cardModule,cardModule.exports,require);
 const condition={id:'reference',priority:true,name:{en:'Reference direction'},shortDescription:{en:'Observed pattern'},triggers:{en:'Context'},advice:{en:'Seek assessment today'},threshold:{en:'Follow the priority guidance'},why:['observed'],partRefs:[]};
 const html=renderToStaticMarkup(React.createElement(cardModule.exports.default,{condition,index:0,lang:'en',copy:{basis:'Evidence',symptoms:'Symptoms',triggers:'Context',advice:'Action',threshold:'Safety'},displayWhy:x=>x,partLabel:()=>''}));
 assert.match(html,/PRIORITY REFERENCE/);assert.doesNotMatch(html,/class="rank">01/);assert.match(html,/Seek assessment today/);
});
