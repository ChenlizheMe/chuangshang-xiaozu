import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mountEditorApp,textOf} from './helpers/editor-renderer.mjs';
import {routeFromHash,bindRouteChanges} from '../src/appNavigation.js';
test('hash route accepts a directly shared about URL and follows back/forward hash changes',()=>{
 assert.equal(routeFromHash('#/about'),'about');assert.equal(routeFromHash('#/'),'assessment');assert.equal(routeFromHash(''),'assessment');
 const events=new Map(),host={location:{hash:'#/'},addEventListener:(key,fn)=>events.set(key,fn),removeEventListener:key=>events.delete(key)},seen=[];
 const stop=bindRouteChanges(host,route=>seen.push(route));for(const hash of ['#/about','#/','#/about']){host.location.hash=hash;events.get('hashchange')();}
 assert.deepEqual(seen,['about','assessment','about']);stop();assert.equal(events.size,0);
});
test('opening about preserves the mounted assessment, symptoms, panel and camera through language and route changes',async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());
 app.layer('muscle');app.select('Rectus abdominis muscle.r');app.open('feelings');app.click(app.tag('疼痛'));app.click(app.button('右下腹'));app.click(app.tag('持续数小时'));app.wheel(70);app.sliderKey('ArrowUp');
 const viewer=app.cls('viewer'),selection=app.state.selection,zoom=app.state.zoom,lift=app.state.lift;
 app.navigate('#/about');assert.equal(app.cls('app').props.hidden,true);assert.equal(app.cls('viewer'),viewer);assert.equal(app.state.selection,selection);assert.equal(app.state.sheet,'feelings');
 assert.equal(app.find(node=>node.type==='anatomy-viewer').props.active,false);
 assert.equal(app.focused.type,'h1');app.key('Escape');assert.equal(app.state.sheet,'feelings','hidden drawer cannot consume About keys');
 const language=app.all(node=>node.type==='button'&&node.props['aria-label']==='切换语言').at(-1);app.click(language);
 assert.equal(app.state.lang,'en');assert.match(textOf(app.cls('about-page')),/This started as a way to test dot/);
 const home=app.find(node=>node.type==='a'&&node.props.href==='https://www.chenlizhe.cn');assert.equal(home.props.target,'_blank');assert.match(home.props.rel,/noopener/);
 app.navigate('#/');assert.equal(app.cls('app').props.hidden,false);assert.equal(app.cls('viewer'),viewer);assert.equal(app.state.selection,selection);assert.equal(app.state.zoom,zoom);assert.equal(app.state.lift,lift);assert.equal(app.tag('疼痛').props['aria-pressed'],true);assert.equal(app.focused.props.href,'#/about');
 app.navigate('#/about');app.navigate('#/');assert.equal(app.state.selection,selection);assert.equal(app.cls('viewer'),viewer);
});
test('a direct about entry and refresh defer the viewer until first visiting assessment',async t=>{
 let imports=0;const app=await mountEditorApp({initialHash:'#/about',loadViewerModule:async()=>{imports++;return {default:()=>null,clearAnatomyCache(){}};}});t.after(()=>app.destroy());
 assert.equal(app.all(node=>node.props?.className==='app').length,0);assert.equal(imports,0);assert.equal(app.state,null);assert.ok(app.cls('about-page'));
 app.navigate('#/');await new Promise(resolve=>setImmediate(resolve));app.act(()=>{});assert.equal(imports,1);assert.equal(app.state.layer,'skeleton');
 app.navigate('#/about');app.navigate('#/');assert.equal(imports,1);
});
test('the inactive application explicitly leaves the layout and focus tree',()=>{
 const css=fs.readFileSync(new URL('../src/cassette.css',import.meta.url),'utf8');assert.match(css,/\.app\[hidden\]\{display:none!important\}/);
});
