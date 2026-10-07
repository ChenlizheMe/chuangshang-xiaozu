import test from 'node:test';
import assert from 'node:assert/strict';
import {bindCanvasWheelBoundary,focusConsoleControl,isConsoleScrollTarget,isScrollingConsole} from '../src/consoleViewport.js';
import {mountEditorApp} from './helpers/editor-renderer.mjs';

function consoleFixture(){
 const listeners=new Map();
 const app={clientHeight:250,scrollHeight:420,clientTop:0,scrollTop:100,
  addEventListener(type,fn,options){listeners.set(type,{fn,options})},
  removeEventListener(type,fn,capture){assert.equal(listeners.get(type)?.fn,fn);assert.equal(capture,true);listeners.delete(type)},
  getBoundingClientRect:()=>({top:0}),querySelector:()=>dock};
 const dock={contains:target=>target===dock,getClientRects:()=>[{}],getBoundingClientRect:()=>({top:194})};
 const canvas={},target=onCanvas=>({closest:selector=>selector==='.app'?app:selector==='.anatomy-canvas'&&onCanvas?canvas:null});
 return {app,dock,listeners,target};
}
test('only overflowing console space outside the canvas belongs to page scrolling',()=>{
 const {app,target}=consoleFixture();
 assert.equal(isScrollingConsole(app),true);assert.equal(isConsoleScrollTarget(target(false)),true);assert.equal(isConsoleScrollTarget(target(true)),false);
 app.scrollHeight=250;assert.equal(isConsoleScrollTarget(target(false)),false);
 app.scrollHeight=420;app.clientHeight=0;assert.equal(isScrollingConsole(app),false);assert.equal(isConsoleScrollTarget(null),false);
});
test('native non-passive wheel boundary prevents double scrolling without performing zoom',()=>{
 const {app,listeners,target}=consoleFixture();const cleanup=bindCanvasWheelBoundary(app);let prevented=0;
 const listener=listeners.get('wheel');assert.deepEqual(listener.options,{capture:true,passive:false});
 const event={target:target(true),deltaY:12,preventDefault(){prevented++}};
 listener.fn(event);assert.equal(prevented,1);
 listener.fn({...event,target:target(false)});listener.fn({...event,deltaY:0});listener.fn({...event,deltaY:NaN});assert.equal(prevented,1);
 app.scrollHeight=250;listener.fn(event);assert.equal(prevented,1);cleanup();assert.equal(listeners.size,0);
});
test('restored controls are revealed above and below the visible area, allowing for fixed keys',()=>{
 const {app,dock}=consoleFixture();let rect={top:-40,bottom:4},focused=0;
 const target={closest:()=>app,focus(options){assert.deepEqual(options,{preventScroll:true});focused++},getBoundingClientRect:()=>rect};
 const host={getComputedStyle:()=>({visibility:'visible'})};
 focusConsoleControl(target,host);assert.equal(app.scrollTop,54);
 rect={top:180,bottom:224};focusConsoleControl(target,host);assert.equal(app.scrollTop,90);
 rect={top:30,bottom:74};focusConsoleControl(target,host);assert.equal(app.scrollTop,90);assert.equal(focused,3);
 dock.closest=()=>app;dock.focus=()=>focused++;focusConsoleControl(dock,host);assert.equal(app.scrollTop,90);
 app.scrollHeight=250;rect={top:-40,bottom:4};focusConsoleControl(target,host);assert.equal(app.scrollTop,90,'ordinary layouts keep existing focus behavior');
});
test('focus reveal respects the housing safe-area padding when the fixed keys are hidden',()=>{
 const {app,dock}=consoleFixture();let rect={top:0,bottom:44};
 const target={closest:()=>app,focus(){},getBoundingClientRect:()=>rect};
 const host={getComputedStyle:node=>node===app?{paddingTop:'44px',paddingBottom:'34px'}:{visibility:'hidden'}};
 focusConsoleControl(target,host);assert.equal(app.scrollTop,56);
 rect={top:196,bottom:240};focusConsoleControl(target,host);assert.equal(app.scrollTop,80);
 assert.ok(dock);
});
test('real App routes overflowing housing input to scrolling and keeps canvas input live',async()=>{
 const view=await mountEditorApp();
 try{
  const app=view.cls('app'),viewer=view.cls('viewer');app.clientHeight=250;app.scrollHeight=420;
  const canvas={},target=onCanvas=>({closest:selector=>selector==='.app'?app:selector==='.anatomy-canvas'&&onCanvas?canvas:null});
  const wheel={target:target(false),deltaMode:0,deltaY:-20,preventDefault(){}};const initial=view.state.zoom;
  view.act(()=>viewer.props.onWheel(wheel));assert.equal(view.state.zoom,initial);
  view.act(()=>viewer.props.onWheel({...wheel,target:target(true)}));assert.ok(view.state.zoom>initial);
  const touches=[{clientX:20,clientY:50}];const before=view.state;
  view.act(()=>viewer.props.onTouchStart({target:target(false),touches}));
  view.act(()=>viewer.props.onTouchEnd({type:'touchend',target:target(false),touches}));
  view.act(()=>viewer.props.onTouchMove({target:target(true),touches:[{clientX:120,clientY:150}],preventDefault(){}}));
  assert.equal(view.state.zoom,before.zoom);assert.equal(view.cls('viewer').props.className,'viewer ');
  view.act(()=>viewer.props.onPointerDown({target:target(false),pointerType:'mouse',button:0,pointerId:5,clientX:10,clientY:10}));
  assert.equal(view.cls('viewer').props.className,'viewer ');
 }finally{view.destroy()}
});
test('About return reveals its original link in a scrolled console and preserves clinical state',async()=>{
 const view=await mountEditorApp();
 try{
  view.select('Body of sternum');const selection=view.state.selection;
  const app=view.cls('app'),link=view.cls('about-control');app.clientHeight=250;app.scrollHeight=420;app.scrollTop=100;app.getBoundingClientRect=()=>({top:0});
  link.closest=selector=>selector==='.app'?app:null;link.getBoundingClientRect=()=>({top:-90,bottom:-44});
  view.navigate('#/about');view.navigate('#/');assert.equal(app.scrollTop,4);assert.equal(view.focused,link);assert.equal(view.state.selection,selection);
 }finally{view.destroy()}
});
