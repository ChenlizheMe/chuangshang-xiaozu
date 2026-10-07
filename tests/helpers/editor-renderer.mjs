// Real React/React reconciler harness, with only AnatomyViewer and DOM hosts stubbed.
// TRAUMA_REPO optionally selects a separate source tree for negative controls.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const repo=process.env.TRAUMA_REPO||fileURLToPath(new URL('../../',import.meta.url));
const requireRepo=createRequire(path.join(repo,'package.json'));
process.env.NODE_ENV='production';
const React=requireRepo('react');
const Reconciler=requireRepo('react-reconciler');
const {DefaultEventPriority}=requireRepo('react-reconciler/constants');
const {build}=requireRepo('esbuild');
const noop=()=>{};
const probeKey='__TRAUMA_EDITOR_RENDER_TEST__';
const replace=(source,before,after)=>{
  assert.ok(source.includes(before),`Render test instrumentation target missing: ${before}`);
  return source.replace(before,after);
};

async function loadApp(testViewer=false){
  const source=fs.readFileSync(path.join(repo,'src/main.jsx'),'utf8');
  let main=replace(source,"import {createRoot} from 'react-dom/client';",'');
  if(testViewer){
    main=replace(main,"const viewerModule=createViewerModule(()=>import('./AnatomyViewer.jsx'));",`const viewerModule=createViewerModule(()=>globalThis.${probeKey}.loadViewerModule());`);
  }else{
    main=replace(main,"const viewerModule=createViewerModule(()=>import('./AnatomyViewer.jsx'));","const viewerModule={retry(){}};");
    main=replace(main,"const AnatomyViewer=lazy(viewerModule.load);",
      "const AnatomyViewer=props=>React.createElement('anatomy-viewer',props);");
  }
  main=replace(main,"createRoot(document.getElementById('root')).render(<Root/>);",'export {Root,knowledge};');
  main=replace(main,'function App({lang,setLang,active=true,aboutLinkRef}){',
    `function App({lang,setLang,active=true,aboutLinkRef}){globalThis.${probeKey}.appRenders++;`);
  main=replace(main,' return <div className="app"',
    ` globalThis.${probeKey}.state={selection,sheet,lang,layer,zoom,lift,updateReport,modelNonce}; return <div className="app"`);
  const built=await build({stdin:{contents:main,sourcefile:path.join(repo,'src/main.jsx'),resolveDir:path.join(repo,'src'),loader:'jsx'},
    bundle:true,platform:'node',format:'cjs',packages:'external',write:false,logLevel:'silent',
    define:{'import.meta.env.PROD':'false'},plugins:[{name:'render-test-host',setup(build){
      build.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
      build.onLoad({filter:/ReportEditor\.jsx$/},args=>({loader:'jsx',contents:replace(fs.readFileSync(args.path,'utf8'),
        '{knowledge,focused,kind,lang,onUpdate}){',`{knowledge,focused,kind,lang,onUpdate}){globalThis.${probeKey}.editorRenders++;`)}));
      build.onLoad({filter:/symptomFilters\.js$/},args=>({loader:'js',contents:replace(fs.readFileSync(args.path,'utf8'),
        "kind='feelings'}={}){",`kind='feelings'}={}){globalThis.${probeKey}.filterCalls++;`)}));
    }}]});
  const result={exports:{}};
  new Function('module','exports','require',built.outputFiles[0].text)(result,result.exports,requireRepo);
  return result.exports;
}

export const textOf=node=>node.text??(node.children||[]).map(textOf).join('');
const findAll=(node,predicate)=>{
  const found=[];
  const visit=node=>{if(predicate(node))found.push(node);for(const child of node.children||[])visit(child)};
  visit(node);return found;
};
function append(parent,child){const i=parent.children.indexOf(child);if(i!==-1)parent.children.splice(i,1);parent.children.push(child)}
function remove(parent,child){const i=parent.children.indexOf(child);if(i!==-1)parent.children.splice(i,1);child.isConnected=false}
function insert(parent,child,before){remove(parent,child);parent.children.splice(parent.children.indexOf(before),0,child);child.isConnected=true}
const hostContext={};
function createRenderer(){
  return Reconciler({now:Date.now,isPrimaryRenderer:true,supportsMutation:true,supportsPersistence:false,supportsHydration:false,
    getRootHostContext:()=>hostContext,getChildHostContext:()=>hostContext,getPublicInstance:instance=>instance,
    prepareForCommit:()=>null,resetAfterCommit:noop,
    createInstance:(type,props)=>({type,props,children:[],tagName:type.toUpperCase(),isConnected:true,
      ownerDocument:{defaultView:window},focus(){document.activeElement=this;},closest:()=>null,querySelector:()=>null,
      hasPointerCapture:()=>true,setPointerCapture:noop,releasePointerCapture:noop,
      getBoundingClientRect:()=>({height:200}),getClientRects:()=>[{}]}),
    appendInitialChild:append,finalizeInitialChildren:()=>false,prepareUpdate:(instance,type,oldProps,newProps)=>newProps,
    shouldSetTextContent:()=>false,createTextInstance:text=>({text}),
    scheduleTimeout:setTimeout,cancelTimeout:clearTimeout,noTimeout:-1,
    appendChild:append,appendChildToContainer:append,removeChild:remove,removeChildFromContainer:remove,
    insertBefore:insert,insertInContainerBefore:insert,
    commitUpdate:(instance,props)=>{instance.props=props},commitTextUpdate:(instance,oldText,text)=>{instance.text=text},
    resetTextContent:instance=>{instance.children=[]},clearContainer:instance=>{instance.children=[]},
    commitMount:noop,hideInstance:noop,unhideInstance:noop,hideTextInstance:noop,unhideTextInstance:noop,
    detachDeletedInstance:noop,getCurrentEventPriority:()=>DefaultEventPriority});
}

export async function mountEditorApp({loadViewerModule,initialHash=''}={}){
  const keys=['window','document','requestAnimationFrame','cancelAnimationFrame',probeKey];
  const saved=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const probe={appRenders:0,editorRenders:0,filterCalls:0,state:null,loadViewerModule,reloads:0};
  const frames=new Map();let frameId=0;
  const restore=()=>{for(const [key,descriptor] of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]};
  globalThis[probeKey]=probe;
  const events=new Map();
  globalThis.window={addEventListener(type,handler){if(!events.has(type))events.set(type,new Set());events.get(type).add(handler);},removeEventListener(type,handler){events.get(type)?.delete(handler);},innerHeight:844,location:{hash:initialHash,reload(){probe.reloads++;}},
    matchMedia:()=>({matches:false,addEventListener:noop,removeEventListener:noop})};
  globalThis.document={addEventListener:noop,removeEventListener:noop,documentElement:{},activeElement:null,hidden:false};
  globalThis.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId};
  globalThis.cancelAnimationFrame=id=>frames.delete(id);
  window.requestAnimationFrame=requestAnimationFrame;
  try{
    const {Root,knowledge}=await loadApp(!!loadViewerModule);
    const renderer=createRenderer(),container={children:[]};
    const root=renderer.createContainer(container,0,null,false,null,'',error=>{throw error},null);
    const act=fn=>{renderer.flushSync(fn);renderer.flushPassiveEffects()};
    act(()=>renderer.updateContainer(React.createElement(Root),root,null));
    const all=predicate=>findAll(container,predicate);
    const find=predicate=>{const node=all(predicate)[0];assert.ok(node,'Requested test host not found');return node};
    const cls=className=>find(node=>(node.props?.className||'').split(' ').includes(className));
    const button=label=>find(node=>node.type==='button'&&textOf(node).trim()===label);
    const click=node=>act(()=>node.props.onClick({currentTarget:node,target:node,preventDefault:noop,stopPropagation:noop}));
    return {
      get state(){return probe.state},get reloads(){return probe.reloads},get counts(){return {app:probe.appRenders,editor:probe.editorRenders,filters:probe.filterCalls}},
      resetCounts(){probe.appRenders=probe.editorRenders=probe.filterCalls=0},
      all,find,cls,button,click,act,knowledge,
      navigate(hash){act(()=>{window.location.hash=hash;for(const handler of events.get('hashchange')||[])handler();});},
      key(key){act(()=>{for(const handler of events.get('keydown')||[])handler({key,preventDefault:noop,stopPropagation:noop});});},
      get focused(){return document.activeElement;},
      select(part){act(()=>find(node=>node.type==='anatomy-viewer').props.onPart({part}))},
      layer(id){click(all(node=>node.type==='button'&&node.props?.className?.includes('layer-dot'))[['skeleton','muscle','organ'].indexOf(id)])},
      open(kind){click(all(node=>node.type==='button'&&node.props?.className?.includes('sticker-card'))[['feelings','signs','diagnosis'].indexOf(kind)])},
      tag(id){const tag=['feelings','signs','timing','triggers'].flatMap(field=>knowledge[field]).find(tag=>tag.id===id);assert.ok(tag);return button(tag[probe.state.lang]||tag.id)},
      wheel(deltaY){act(()=>cls('viewer').props.onWheel({target:{closest:()=>null},deltaMode:0,deltaY,preventDefault:noop}))},
      sliderKey(key){act(()=>cls('vertical-track').props.onKeyDown({key,shiftKey:false,preventDefault:noop,stopPropagation:noop}))},
      sliderMoves(count){const track=cls('vertical-track'),event={button:0,pointerId:11,clientY:300,currentTarget:track,preventDefault:noop,stopPropagation:noop};
        act(()=>track.props.onPointerDown(event));for(let i=0;i<count;i++)act(()=>track.props.onPointerMove({...event,clientY:300-(i%2?24:12)}));act(()=>track.props.onPointerUp(event))},
      destroy(){try{act(()=>renderer.updateContainer(null,root,null))}finally{frames.clear();restore()}},
    };
  }catch(error){restore();throw error}
}
