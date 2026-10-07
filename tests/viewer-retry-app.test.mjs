// Persistent real App/React tree. Only the viewer's module result and DOM hosts
// are controlled; the actual lazy wrapper, error boundary and retry handler run.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mountEditorApp,textOf} from './helpers/editor-renderer.mjs';
const hasError=app=>app.all(node=>node.props?.className==='model-error').length>0;
async function settled(app,predicate){
 for(let i=0;i<50;i++){await new Promise(resolve=>setImmediate(resolve));app.act(()=>{});if(predicate())return;}
 assert.fail('Expected React transition did not settle');
}
test('a failed lazy module exposes one explicit reload action without silently importing again',async t=>{
 const logged=[],errorLog=console.error;console.error=(...args)=>logged.push(args);t.after(()=>{console.error=errorLog;});
 let imports=0;const app=await mountEditorApp({loadViewerModule:async()=>{imports++;throw new Error('chunk unavailable');}});t.after(()=>app.destroy());
 await settled(app,()=>hasError(app));assert.equal(imports,1);assert.equal(app.reloads,0);
 assert.match(textOf(app.cls('model-error')),/chunk unavailable/);assert.ok(app.button('重新加载页面'));
 app.click(app.find(node=>node.props?.['aria-label']==='切换语言'));assert.ok(app.button('RELOAD PAGE'));
 app.click(app.button('RELOAD PAGE'));assert.equal(app.reloads,1);assert.equal(imports,1);assert.equal(app.state.modelNonce,0);
 assert.equal(logged.length>0,true,'the error boundary really handled a rejected lazy module');
});
test('a loaded viewer with a GLB error clears that layer and recovers without a page reload',async t=>{
 const errorLog=console.error;console.error=()=>{};t.after(()=>{console.error=errorLog;});
 let imports=0,broken=true;const cleared=[];
 const app=await mountEditorApp({loadViewerModule:async()=>{imports++;return {default(){if(broken)throw new Error('GLB failed');return null;},clearAnatomyCache(layer){cleared.push(layer);broken=false;}};}});t.after(()=>app.destroy());
 await settled(app,()=>hasError(app));assert.ok(app.button('重试模型'));app.click(app.button('重试模型'));
 await settled(app,()=>!hasError(app));assert.deepEqual(cleared,['skeleton']);assert.equal(imports,1);assert.equal(app.state.modelNonce,1);assert.equal(app.reloads,0);
 for(let i=0;i<60;i++)app.wheel(i%2?8:-8);assert.equal(imports,1,'camera updates keep the same loaded lazy component');
});
