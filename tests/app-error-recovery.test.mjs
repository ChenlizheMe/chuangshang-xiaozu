import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';
import {mountEditorApp,textOf} from './helpers/editor-renderer.mjs';

for(const lang of ['zh','en'])test(`a caught application render failure has an explicit ${lang} page reload`,async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());
 if(lang==='en')app.click(app.find(node=>node.props?.['aria-label']==='切换语言'));
 app.select('Humerus.l');
 assert.equal(app.all(node=>node.props?.className==='app-error').length,0);
 const descriptor=Object.getOwnPropertyDescriptor(app.knowledge,'feelings');
 const error=new Error('<controlled render failure>');error.stack='INTERNAL_STACK_SENTINEL';
 const originalError=console.error;console.error=()=>{};
 try{
  Object.defineProperty(app.knowledge,'feelings',{configurable:true,get(){throw error}});
  app.open('feelings');
 }finally{
  Object.defineProperty(app.knowledge,'feelings',descriptor);
  console.error=originalError;
 }
 const card=app.cls('app-error');
 assert.equal(card.props.role,'alert');
 assert.match(textOf(card),lang==='zh'?/页面遇到异常/:/unexpected error/);
 assert.match(textOf(card),/<controlled render failure>/);
 assert.doesNotMatch(textOf(card),/INTERNAL_STACK_SENTINEL/);
 assert.equal(app.reloads,0,'catching the error must not automatically reload');
 const button=app.button(lang==='zh'?'重新加载页面':'RELOAD PAGE');
 assert.equal(button.props.type,'button');
 app.click(button);
 assert.equal(app.reloads,1,'one explicit activation performs one normal reload');
});

test('fatal recovery retains the standard button target and permits long error content to scroll',()=>{
 const css=postcss.parse(fs.readFileSync(new URL('../src/cassette.css',import.meta.url),'utf8'));
 const declarations=selector=>{const result=[];css.walkRules(selector,rule=>result.push(...rule.nodes));return result;};
 assert.ok(declarations('button').some(d=>d.prop==='min-height'&&d.value==='44px'));
 assert.ok(declarations('.app-error').some(d=>d.prop==='height'&&d.value==='100%'));
 assert.ok(declarations('.app-error').some(d=>d.prop==='overflow'&&d.value==='auto'));
 assert.ok(declarations('.app-error pre').some(d=>d.prop==='overflow-wrap'&&d.value==='anywhere'));
});
