import test from 'node:test';
import assert from 'node:assert/strict';
import {bindPanelFocusVisibility} from '../src/panelNavigation.js';
function fixture(){
 const frames=new Map(),panelEvents=new Map(),hostEvents=new Map(),styles=new Map();let next=0,observer;
 const state={headerHeight:80,headerBottom:100,visible:true,top:160,height:44};
 const document={activeElement:null};
 const header={getBoundingClientRect:()=>({height:state.headerHeight,bottom:state.headerBottom}),contains:node=>node===close};
 const panel={isConnected:true,clientTop:3,clientHeight:300,scrollTop:100,ownerDocument:document,
  style:{setProperty:(k,v)=>styles.set(k,v),removeProperty:k=>styles.delete(k)},
  querySelector:selector=>selector==='.sheet-head'?header:null,
  getClientRects:()=>state.visible?[{}]:[],getBoundingClientRect:()=>({top:20}),contains:node=>[item,close].includes(node),
  addEventListener:(name,fn)=>panelEvents.set(name,fn),removeEventListener:name=>panelEvents.delete(name)};
 const item={getClientRects:()=>[{}],getBoundingClientRect:()=>({top:state.top-panel.scrollTop,bottom:state.top-panel.scrollTop+state.height,height:state.height})};
 const close={getClientRects:()=>[{}],getBoundingClientRect:()=>({top:40,bottom:84,height:44})};
 const host={requestAnimationFrame:fn=>{frames.set(++next,fn);return next},cancelAnimationFrame:id=>frames.delete(id),
  addEventListener:(name,fn)=>hostEvents.set(name,fn),removeEventListener:name=>hostEvents.delete(name),
  ResizeObserver:class{constructor(callback){this.callback=callback;this.targets=[];this.disconnected=false;observer=this}observe(target){this.targets.push(target)}disconnect(){this.disconnected=true;}}};
 const flush=()=>{for(const [id,fn] of [...frames]){frames.delete(id);fn();}};
 document.activeElement=close;
 const cleanup=bindPanelFocusVisibility(panel,host);flush();
 const focus=target=>{document.activeElement=target;panelEvents.get('focusin')();};
 return {state,panel,item,close,document,frames,panelEvents,hostEvents,styles,observer,focus,flush,cleanup};
}
test('reverse focus under the sticky header reveals the whole control without changing focus',()=>{
 const f=fixture();f.focus(f.item);assert.equal(f.panel.scrollTop,100,'wait for the native focus scroll to settle');f.flush();
 assert.equal(f.item.getBoundingClientRect().top,106);assert.equal(f.document.activeElement,f.item);f.cleanup();
});
test('visible controls and the sticky close button do not move the report',()=>{
 const f=fixture();f.state.top=250;f.focus(f.item);f.flush();assert.equal(f.panel.scrollTop,100);
 f.focus(f.close);f.flush();assert.equal(f.panel.scrollTop,100);f.cleanup();
});
test('a control below the panel moves only enough to reveal its bottom',()=>{
 const f=fixture();f.state.top=405;f.focus(f.item);f.flush();assert.equal(f.item.getBoundingClientRect().bottom,317);f.cleanup();
});
test('translated or wrapped headings update the viewing inset and reveal the current control',()=>{
 const f=fixture();assert.equal(f.styles.get('--sheet-header-height'),'80px');assert.equal(f.observer.targets.length,2);
 f.state.top=250;f.focus(f.item);f.flush();f.state.headerHeight=140;f.state.headerBottom=160;f.observer.callback();f.flush();
 assert.equal(f.styles.get('--sheet-header-height'),'140px');assert.equal(f.item.getBoundingClientRect().top,166);f.cleanup();
});
test('a queued reveal follows the newest focus and ignores external controls',()=>{
 const f=fixture();f.focus(f.item);f.focus(f.close);assert.equal(f.frames.size,1);f.flush();assert.equal(f.panel.scrollTop,100);
 f.focus({});f.flush();assert.equal(f.panel.scrollTop,100);f.cleanup();
});
test('hidden or removed panels do not scroll and cleanup cancels observers and queued work',()=>{
 const f=fixture();f.focus(f.item);f.state.visible=false;f.flush();assert.equal(f.panel.scrollTop,100);
 f.state.visible=true;f.panel.isConnected=false;f.focus(f.item);f.flush();assert.equal(f.panel.scrollTop,100);
 f.panel.isConnected=true;f.focus(f.item);const stale=[...f.frames.values()][0];f.cleanup();
 assert.equal(f.frames.size,0);assert.equal(f.panelEvents.size,0);assert.equal(f.hostEvents.size,0);assert.equal(f.observer.disconnected,true);assert.equal(f.styles.size,0);
 stale();f.observer.callback();assert.equal(f.panel.scrollTop,100);assert.equal(f.frames.size,0);
});
test('an oversized focused element aligns its start without oscillating between edges',()=>{
 const f=fixture();f.state.height=280;f.focus(f.item);f.flush();assert.equal(f.item.getBoundingClientRect().top,106);
 const scroll=f.panel.scrollTop;f.observer.callback();f.flush();assert.equal(f.panel.scrollTop,scroll);f.cleanup();
});
test('shrinking the panel also reveals an oversized control entirely below the viewport',()=>{
 const f=fixture();f.panel.clientHeight=600;f.state.top=400;f.state.height=180;f.focus(f.item);f.flush();assert.equal(f.panel.scrollTop,100);
 f.panel.clientHeight=200;f.observer.callback();f.flush();assert.equal(f.item.getBoundingClientRect().top,106);
 const scroll=f.panel.scrollTop;f.observer.callback();f.flush();assert.equal(f.panel.scrollTop,scroll);f.cleanup();
});
