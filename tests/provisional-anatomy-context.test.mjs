import test from 'node:test';
import assert from 'node:assert/strict';
import {mountEditorApp,textOf} from './helpers/editor-renderer.mjs';
import {assertSelectableStructure} from './helpers/selectable-anatomy.mjs';
test('the short provisional name and qualifier follow the actual selected structure across panels and language',async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());app.layer('muscle');
 for(const part of ['Pubo-analis muscle.l','Pubo-analis muscle.r']){
  assertSelectableStructure(part,'muscle');app.select(part);
  const name=app.cls('part-selection');assert.match(textOf(name),/肛提肌相关结构/);assert.match(textOf(name),/Pubo-analis · 中文暂用概括名/);
  assert.match(textOf(name),part.endsWith('.l')?/左侧/:/右侧/);
  app.open('feelings');assert.match(textOf(app.cls('sheet-context')),/Pubo-analis · 中文暂用概括名/);
 }
 app.click(app.all(n=>n.type==='button'&&n.props['aria-label']==='切换语言')[0]);
 assert.match(textOf(app.cls('part-selection')),/Right Pubo analis muscle/);assert.equal(app.all(n=>n.props?.className==='anatomy-name-note').length,0);
 app.click(app.all(n=>n.type==='button'&&n.props['aria-label']==='Switch language')[0]);app.select('Pectineus muscle.r');assert.equal(app.all(n=>n.props?.className==='anatomy-name-note').length,0);assert.match(textOf(app.cls('part-selection')),/耻骨肌/);
});
