import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';
import {mountEditorApp,textOf} from './helpers/editor-renderer.mjs';
import {assertSelectableStructure} from './helpers/selectable-anatomy.mjs';
const status=app=>app.cls('part-selection');
test('one status container exists before selection and survives replacement and cancellation',async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());const region=status(app),focus=app.focused;
 assert.equal(region.props.role,'status');assert.equal(region.props['aria-live'],'polite');assert.equal(region.props['aria-atomic'],'true');assert.equal(textOf(region),'未选结构');
 for(const part of ['Humerus.r','Tibia.l']){assertSelectableStructure(part,'skeleton');app.select(part);assert.equal(status(app),region);assert.notEqual(textOf(region),'未选结构');assert.equal(app.focused,focus,'status updates never move focus');}
 app.select('Tibia.l');assert.equal(status(app),region);assert.equal(textOf(region),'未选结构');
 assert.equal(app.all(node=>node.props?.['aria-label']==='解剖结构选择').length,1);
});
test('reset and layer changes clear the message without removing its container',async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());const region=status(app);app.select('Humerus.r');app.click(app.button('RESET'));
 assert.equal(status(app),region);assert.equal(textOf(region),'未选结构');app.select('Humerus.r');app.layer('muscle');assert.equal(status(app),region);assert.equal(textOf(region),'未选结构');
});
test('camera and report details do not alter the anatomy status content',async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());app.select('Humerus.r');const region=status(app),message=textOf(region);
 for(let i=0;i<60;i++){app.wheel(i%2?8:-8);app.sliderKey(i%2?'ArrowDown':'ArrowUp');assert.equal(status(app),region);assert.equal(textOf(region),message);}
 app.open('feelings');const focus=app.focused;for(const tag of ['酸痛','持续数小时','运动后']){app.click(app.tag(tag));assert.equal(textOf(region),message);}
 assert.equal(app.focused,focus);
});
test('About hides the existing status with the app and returns its translated current selection',async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());app.select('Humerus.r');const region=status(app);app.navigate('#/about');assert.equal(app.cls('app').props.hidden,true);
 app.click(app.all(node=>node.type==='button'&&node.props['aria-label']==='切换语言').at(-1));assert.equal(status(app),region);assert.equal(region.props['aria-label'],'Anatomy selection');assert.match(textOf(region),/Right Humerus/);
 app.navigate('#/');assert.equal(app.cls('app').props.hidden,false);assert.equal(status(app),region);app.select('Humerus.r');assert.equal(textOf(region),'No area selected');
});
test('the provisional name qualification stays in the same anatomy status',async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());assertSelectableStructure('Pubo-analis muscle.l','muscle');app.layer('muscle');app.select('Pubo-analis muscle.l');
 assert.match(textOf(status(app)),/左侧肛提肌相关结构/);assert.match(textOf(status(app)),/Pubo-analis · 中文暂用概括名/);
});
test('the empty message uses clipped CSS rather than display or visibility hiding',()=>{
 let declarations;
 postcss.parse(fs.readFileSync(new URL('../src/cassette.css',import.meta.url),'utf8')).walkRules('.selection-empty-status',rule=>{declarations=Object.fromEntries(rule.nodes.map(node=>[node.prop,node.value]));});
 assert.equal(declarations.position,'absolute');assert.equal(declarations.width,'1px');assert.equal(declarations.height,'1px');assert.equal(declarations.clip,'rect(0,0,0,0)');assert.ok(!declarations.display&&!declarations.visibility&&!declarations['content-visibility']);
});
