import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {installStartupRecovery} from '../src/startupRecovery.js';
import {offlineReleasePlugin} from '../scripts/offline-release.mjs';

function browser(lang='zh-CN'){
 const listeners=new Map(),timers=new Map();let observer,reloads=0;
 const element=tag=>({tagName:tag.toUpperCase(),children:[],style:{},attributes:{},textContent:'',events:{},
  setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,v){this.events[k]=v;},
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}},
  remove(){this.parent.children=this.parent.children.filter(node=>node!==this);},
  get childElementCount(){return this.children.length;}
 });
 const root=element('div'),body=element('body');body.append(root);
 const doc={getElementById:id=>id==='root'?root:null,documentElement:{lang},body,createElement:element};
 const host={location:{reload(){reloads++;}},MutationObserver:class{
  constructor(fn){this.fn=fn;this.active=true;observer=this;}observe(){}disconnect(){this.active=false;}
 },setTimeout(fn,delay){assert.equal(delay,15000);timers.set(1,fn);return 1;},clearTimeout(id){timers.delete(id);},
 addEventListener(type,fn,capture=false){listeners.set(type,{fn,capture});},removeEventListener(type,fn,capture=false){assert.equal(listeners.get(type)?.capture,capture);listeners.delete(type);}};
 return {root,body,doc,host,listeners,timers,get reloads(){return reloads;},
  get card(){return body.children.find(node=>node.id==='startup-recovery-message');},
  event(type,event={}){listeners.get(type)?.fn(event);},timeout(){const fn=timers.get(1);timers.delete(1);fn?.();},
  mount(){root.append(element('main'));if(observer.active)observer.fn();},
  assertClean(){assert.equal(listeners.size,0);assert.equal(timers.size,0);assert.equal(observer.active,false);}
 };
}
test('a normal mount removes startup listeners and its timer without adding a message',()=>{
 const b=browser();installStartupRecovery(b.host,b.doc);assert.equal(b.card,undefined);b.mount();b.assertClean();b.timeout();assert.equal(b.card,undefined);assert.equal(b.reloads,0);
});
test('missing module and startup execution failures provide a manual ordinary reload',()=>{
 for(const event of [{target:{tagName:'SCRIPT'}},{error:new Error('entry failed') }]){
  const b=browser();installStartupRecovery(b.host,b.doc);b.event('error',event);
  assert.equal(b.card.attributes.role,'status');assert.match(b.card.children[1].textContent,/尚未完成/);
  // The normal stylesheet gives empty #root 100% height and clips body. A
  // recovery sibling must stay in the viewport, independent of that layout.
  assert.match(b.card.style.cssText,/position:fixed/);assert.match(b.card.style.cssText,/top:12vh/);assert.match(b.card.style.cssText,/max-height:76vh;overflow:auto/);
  assert.equal(b.reloads,0);b.card.children[2].events.click();assert.equal(b.reloads,1);
  b.event('error',event);assert.equal(b.body.children.length,2,'one message, no retry loop');b.mount();assert.equal(b.card,undefined);b.assertClean();
 }
});
test('slow startup is described as unfinished and can still finish after the prompt',()=>{
 const b=browser('en');installStartupRecovery(b.host,b.doc);b.timeout();assert.match(b.card.children[1].textContent,/not finished loading/);assert.equal(b.card.children[2].textContent,'RETRY LOADING');assert.equal(b.reloads,0);b.mount();assert.equal(b.card,undefined);b.assertClean();
});
test('unhandled startup rejection shows recovery, while unrelated resource errors do not',()=>{
 const b=browser();const finish=installStartupRecovery(b.host,b.doc);b.event('error',{target:{tagName:'IMG'}});assert.equal(b.card,undefined);b.event('unhandledrejection');assert.ok(b.card);finish();b.assertClean();assert.equal(b.card,undefined);
});
test('built inline recovery runs without React, the entry module, or external assets',()=>{
 const plugin=offlineReleasePlugin(),tags=plugin.transformIndexHtml.handler('<div id="root"></div>',{bundle:{'assets/entry.js':{}}});
 const startup=tags.find(tag=>tag.attrs.id==='startup-recovery');assert.equal(startup.injectTo,'body');
 const b=browser();vm.runInNewContext(startup.children,{window:b.host,document:b.doc});b.event('error',{target:{tagName:'SCRIPT'}});assert.ok(b.card);b.mount();b.assertClean();
});
test('HTML-only recovery changes also version the complete offline release',()=>{
 const release=html=>JSON.parse(offlineReleasePlugin().transformIndexHtml.handler(html,{bundle:{'assets/entry.js':{}}})[0].children);
 assert.notEqual(release('<title>A</title>').id,release('<title>B</title>').id);
 assert.deepEqual(release('<title>A</title>'),release('<title>A</title>'));
});
