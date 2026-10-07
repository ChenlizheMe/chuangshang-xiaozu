import test from 'node:test';
import assert from 'node:assert/strict';
import {mountEditorApp,textOf} from './helpers/editor-renderer.mjs';

const language=app=>app.find(node=>node.type==='button'&&['切换语言','Switch language'].includes(node.props['aria-label']));
const tutorial=app=>app.find(node=>node.type==='button'&&node.props.className==='tutorial-control');
function activateControl(app,control,input='mouse',nested=false){
 const viewer=app.cls('viewer');
 // These hosts model only ancestor matching and React event delivery. Native
 // browser picking, touch synthesis and layout are verified separately.
 const child={tagName:'SPAN',props:{}},ancestors=[...(nested?[child]:[]),control,app.cls('scene-controls'),viewer];
 const closest=selector=>ancestors.find(node=>selector.split(',').some(part=>{
  const token=part.trim();return token.startsWith('.')?(node.props?.className||'').split(' ').includes(token.slice(1)):node.tagName?.toLowerCase()===token;
 }))||null;
 const target=nested?child:control;target.closest=closest;
 if(input==='mouse'){
  app.act(()=>viewer.props.onPointerDown({target,currentTarget:viewer,pointerType:'mouse',pointerId:31,button:0,clientX:0,clientY:0}));
  app.act(()=>viewer.props.onPointerUp({target,currentTarget:viewer,type:'pointerup',pointerId:31}));
 }else if(input==='touch'){
  app.act(()=>viewer.props.onTouchStart({target,touches:[{identifier:31,clientX:0,clientY:0}]}));
  app.act(()=>viewer.props.onTouchEnd({target,type:'touchend',touches:[]}));
 }
 control.focus();app.click(control);
}

const fixtures=[
 {name:'sensations',kind:'feelings'},
 {name:'associated signs',kind:'signs'},
 {name:'basic report',kind:'diagnosis'},
 {name:'urgent report',kind:'diagnosis',urgent:true},
 {name:'tutorial',kind:'tutorial'},
 {name:'empty input',kind:'feelings',empty:true}
];
for(const input of ['mouse','touch','keyboard'])test(`${input} language activation preserves the open panel and saved assessment`,async()=>{
 for(const fixture of fixtures){
  const app=await mountEditorApp();
  try{
   if(!fixture.empty){
    app.select(fixture.urgent?'Body of sternum':'Humerus.r');app.open('feelings');app.click(app.tag(fixture.urgent?'压迫感':'酸痛'));
    if(fixture.urgent){app.open('signs');app.click(app.tag('气短'));}
    app.open('diagnosis');
   }
   if(fixture.kind==='tutorial')app.click(tutorial(app));else app.open(fixture.kind);
   const panel=app.cls('sticker-sheet'),selection=app.state.selection,result=app.state.result,before=JSON.stringify(result);
   const viewer=app.find(node=>node.type==='anatomy-viewer'),camera=[viewer.props.orbit,viewer.props.elevation,viewer.props.zoom,viewer.props.lift];
   panel.scrollTop=173;
   for(const lang of ['en','zh']){
    activateControl(app,language(app),input,true);
    assert.equal(app.state.lang,lang);assert.equal(app.state.sheet,fixture.kind,fixture.name);
    assert.equal(app.cls('sticker-sheet'),panel);assert.equal(panel.scrollTop,173);
    assert.equal(app.state.selection,selection);assert.equal(app.state.result,result);assert.equal(JSON.stringify(result),before);
    assert.equal(app.find(node=>node.type==='anatomy-viewer'),viewer);
    assert.deepEqual([viewer.props.orbit,viewer.props.elevation,viewer.props.zoom,viewer.props.lift],camera);
    if(fixture.kind==='diagnosis'&&fixture.urgent)assert.match(textOf(app.cls('urgent-strip')),lang==='en'?/IMMEDIATE ASSESSMENT/:/立即评估/);
    if(fixture.kind==='feelings')assert.equal(panel.props['aria-label'],lang==='en'?'SENSATIONS':'不舒服的感觉');
   }
   app.navigate('#/about');app.navigate('#/');
   assert.equal(app.state.sheet,fixture.kind);assert.equal(app.state.selection,selection);assert.equal(app.state.result,result);assert.equal(panel.scrollTop,173);
   app.key('Escape');assert.equal(app.state.sheet,null,'the translated panel still closes normally');
  }finally{app.destroy();}
 }
});

test('the language exemption does not change other outside controls',async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());
 function setup(){app.click(app.button('RESET'));app.select('Humerus.r');app.open('feelings');app.click(app.tag('酸痛'));app.open('diagnosis');}
 setup();const selection=app.state.selection,result=app.state.result;
 const viewer=app.cls('viewer');
 app.act(()=>viewer.props.onPointerDown({target:{closest:()=>null},currentTarget:viewer,pointerType:'mouse',pointerId:1,button:0,clientX:1,clientY:1}));
 assert.equal(app.state.sheet,null);assert.equal(app.state.selection,selection);assert.equal(app.state.result,result);
 app.act(()=>viewer.props.onPointerUp({currentTarget:viewer,pointerId:1,type:'pointerup'}));
 app.open('diagnosis');activateControl(app,app.button('RESET'));
 assert.equal(app.state.sheet,null);assert.equal(app.state.result,null);assert.deepEqual(app.state.selection.reports,[]);
 setup();const muscle=app.all(node=>node.type==='button'&&node.props.className?.includes('layer-dot'))[1];activateControl(app,muscle);
 assert.equal(app.state.layer,'muscle');assert.equal(app.state.sheet,null);assert.equal(app.state.result,null);assert.deepEqual(app.state.selection.reports,[]);
 setup();activateControl(app,tutorial(app));
 assert.equal(app.state.sheet,'tutorial');assert.equal(app.cls('sticker-sheet').scrollTop,0);
});
