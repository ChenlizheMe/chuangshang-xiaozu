import test from 'node:test';
import assert from 'node:assert/strict';
import {bindPanelKeyboard,dismissPanel,openPanel} from '../src/panelNavigation.js';
function environment(){
 const events=new Map(),calls=[],frames=[];
 return {calls,events,frames,host:{requestAnimationFrame:fn=>frames.push(fn),addEventListener:(type,fn)=>events.set(type,fn),removeEventListener:(type,fn)=>{assert.equal(events.get(type),fn);events.delete(type);}},panel:{querySelector:()=>({focus:()=>calls.push('panel-focus')})},opener:{isConnected:true,focus:()=>calls.push('opener-focus')}};
}
test('opening a panel moves focus into it, Escape closes it and restores its trigger',()=>{
 const e=environment();const cleanup=bindPanelKeyboard(e.panel,e.opener,()=>e.calls.push('close'),e.host);
 assert.deepEqual(e.calls,['panel-focus']);
 const key={key:'Escape',preventDefault:()=>e.calls.push('prevent'),stopPropagation:()=>e.calls.push('stop')};
 e.events.get('keydown')(key);assert.deepEqual(e.calls,['panel-focus','prevent','stop','close']);e.frames.shift()();assert.deepEqual(e.calls,['panel-focus','prevent','stop','close','opener-focus']);
 cleanup();assert.equal(e.events.size,0);
});
test('ordinary typing and arrows do not close the non-modal panel',()=>{
 const e=environment();const cleanup=bindPanelKeyboard(e.panel,e.opener,()=>e.calls.push('close'),e.host);
 for(const key of ['Tab','ArrowDown','Enter'])e.events.get('keydown')({key});
 assert.deepEqual(e.calls,['panel-focus']);cleanup();
});
test('close never focuses a trigger that has since been removed',()=>{
 const e=environment();e.opener.isConnected=false;dismissPanel(()=>e.calls.push('close'),e.opener,e.host);e.frames.shift()();
 assert.deepEqual(e.calls,['close']);assert.doesNotThrow(()=>dismissPanel(()=>{},null,e.host));
});
test('the restored trigger is checked after layout changes and never steals focus from a newly opened panel',()=>{
 const e=environment();let visible=false,newPanel=false;e.host.getComputedStyle=()=>({visibility:visible?'visible':'hidden'});e.opener.closest=()=>({querySelector:()=>newPanel?{}:null});
 dismissPanel(()=>e.calls.push('close'),e.opener,e.host);assert.deepEqual(e.calls,['close']);visible=true;e.frames.shift()();assert.deepEqual(e.calls,['close','opener-focus']);
 dismissPanel(()=>e.calls.push('close'),e.opener,e.host);newPanel=true;e.frames.shift()();assert.deepEqual(e.calls,['close','opener-focus','close']);
});
test('opening records the trigger before a covering layout can hide and blur it',()=>{
 const ref={current:null},trigger={tagName:'BUTTON',closest:()=>null};
 openPanel(()=>assert.equal(ref.current,trigger),ref,trigger);
 const internal={tagName:'BUTTON',closest:()=>({})};openPanel(()=>{},ref,internal);assert.equal(ref.current,trigger,'switching within a panel retains the original external trigger');
});
