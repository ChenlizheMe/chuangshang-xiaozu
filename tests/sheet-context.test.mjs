import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';import {buildSync} from 'esbuild';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import postcss from 'postcss';
const require=createRequire(import.meta.url);const compiled=buildSync({entryPoints:[new URL('../src/SheetHeader.jsx',import.meta.url).pathname],bundle:true,platform:'node',format:'cjs',external:['react'],write:false}).outputFiles[0].text;const module={exports:{}};new Function('module','exports','require',compiled)(module,module.exports,require);const Header=module.exports.default;
const render=(focused,lang='en')=>renderToStaticMarkup(React.createElement(Header,{title:'Feelings',focused,lang,onClose:()=>{}}));
test('the panel retains the complete selected structure without claiming the symptom source',()=>{
 for(const part of ['Ventral parts of lateral intertransversarii lumborum muscles.r','Tendon sheath of extensor digitorum and extensor indicis.r']){const html=render({part,layer:part.startsWith('Ventral')?'muscle':'skeleton'});assert.match(html,/Selected structure/);assert.ok(html.toLowerCase().includes(part.replace(/\.r$/,'').toLowerCase()));assert.match(html,/aria-label="Close"/);assert.doesNotMatch(html,/confirmed|diagnosed|…/i);}
});
test('an unselected/tutorial header adds no fictional anatomy context',()=>{const html=render(null,'zh');assert.doesNotMatch(html,/sheet-selected-structure|已选结构|undefined/);assert.match(html,/aria-label="关闭"/);});
test('current keys override lifting hover and retain a visible keyboard focus treatment',()=>{
 const css=fs.readFileSync(new URL('../src/cassette.css',import.meta.url),'utf8');const rules=[];postcss.parse(css).walkRules(rule=>rules.push(rule));
 const active=rules.find(r=>r.selector==='.sticker-card.active,.sticker-card.active:hover,.sticker-card.active:focus-visible'&&r.parent.type==='root');assert.ok(active);const values=Object.fromEntries(active.nodes.filter(x=>x.type==='decl').map(x=>[x.prop,x.value]));assert.equal(values.transform,'translateY(2px)');assert.match(values['box-shadow'],/inset/);assert.equal(values['border-top'],'2px solid var(--red)');assert.match(css,/button:focus-visible[^}]+outline:2px/);
 const context=rules.find(r=>r.selector==='.sheet-context');assert.ok(context.nodes.some(d=>d.prop==='overflow-wrap'&&d.value==='anywhere'));assert.ok(!context.nodes.some(d=>/line-clamp|max-height|text-overflow/.test(d.prop)));
});
test('short-landscape nonempty panels can fit the header and several full 44px option rows',()=>{
 const css=postcss.parse(fs.readFileSync(new URL('../src/cassette.css',import.meta.url),'utf8'));let values;
 css.walkAtRules('media',m=>{if(m.params==='(max-height:450px)')m.walkRules('.sticker-sheet:not(.empty-sheet)',r=>{values=Object.fromEntries(r.nodes.map(d=>[d.prop,d.value]));});});
 assert.equal(values.top,'12px');assert.equal(values.bottom,'86px');assert.equal(values['max-height'],'none');assert.ok(376-parseInt(values.top)-parseInt(values.bottom)>3*44+90);
});
test('provisional Pubo-analis Chinese context stays short while retaining the specific English identity',()=>{
 for(const side of ['l','r']){
  const zh=render({part:`Pubo-analis muscle.${side}`,layer:'muscle'},'zh');
  assert.match(zh,/肛提肌相关结构/);assert.match(zh,/Pubo-analis · 中文暂用概括名/);assert.doesNotMatch(zh,/耻骨肌肛提部|细分中文名待核验/);
  const en=render({part:`Pubo-analis muscle.${side}`,layer:'muscle'},'en');assert.match(en,/Pubo analis muscle/);assert.doesNotMatch(en,/中文暂用|anatomy-name-note/);
 }
 assert.doesNotMatch(render({part:'Pectineus muscle.r',layer:'muscle'},'zh'),/anatomy-name-note/);
});
