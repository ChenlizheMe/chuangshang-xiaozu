// Real App/React commits with controlled viewer hosts. These callbacks represent
// a visible previous R3F branch retained before its Suspense fallback commits.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mountEditorApp} from './helpers/editor-renderer.mjs';
import {assertSelectableStructure} from './helpers/selectable-anatomy.mjs';

const parts={skeleton:'Humerus.l',muscle:'Rectus abdominis muscle.r',organ:'Stomach'};
for(const [layer,part] of Object.entries(parts))assertSelectableStructure(part,layer);
const pick=app=>app.find(node=>node.type==='anatomy-viewer').props.onPart;
const invoke=(app,callback,part)=>app.act(()=>callback({part}));

test('a previous layer callback cannot restore selection after a layer change',async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());
 for(const from of Object.keys(parts))for(const to of Object.keys(parts)){
  if(from===to)continue;
  app.layer(from);
  const oldPick=pick(app);
  app.layer(to);
  invoke(app,oldPick,parts[from]);
  assert.equal(app.state.layer,to);
  assert.deepEqual(app.state.selection.reports,[],`${from} callback must not enter ${to}`);
  const currentPick=pick(app);
  invoke(app,currentPick,parts[to]);
  assert.equal(app.state.selection.focusId,`${to}:${parts[to]}`,'current first pick works');
  invoke(app,currentPick,parts[to]);
  assert.deepEqual(app.state.selection.reports,[],'current second pick cancels');
 }
});

test('returning to the original layer does not restore its previous callback authority',async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());
 const oldSkeletonPick=pick(app);
 app.layer('muscle');app.layer('skeleton');
 const currentPick=pick(app);
 assert.notEqual(currentPick,oldSkeletonPick);
 invoke(app,oldSkeletonPick,parts.skeleton);
 assert.deepEqual(app.state.selection.reports,[]);
 invoke(app,currentPick,parts.skeleton);
 assert.equal(app.state.selection.focusId,`skeleton:${parts.skeleton}`);
 invoke(app,oldSkeletonPick,parts.skeleton);
 assert.equal(app.state.selection.focusId,`skeleton:${parts.skeleton}`,'old callback cannot cancel a current choice');
 invoke(app,currentPick,parts.skeleton);
 assert.deepEqual(app.state.selection.reports,[]);
});

test('stale picks preserve a current assessment and camera while language and camera updates retain current picking',async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());
 const oldPick=pick(app);
 app.layer('muscle');
 const currentPick=pick(app);
 invoke(app,currentPick,parts.muscle);
 app.open('feelings');app.click(app.tag('酸痛'));app.open('diagnosis');
 app.wheel(-30);app.sliderKey('ArrowUp');
 const {selection,result,zoom,lift}=app.state;
 assert.ok(result&&!result.error);
 invoke(app,oldPick,parts.skeleton);
 assert.equal(app.state.selection,selection);
 assert.equal(app.state.result,result);
 assert.equal(app.state.zoom,zoom);assert.equal(app.state.lift,lift);
 assert.equal(app.state.sheet,'diagnosis');
 app.click(app.find(node=>node.props?.['aria-label']==='切换语言'));
 assert.equal(pick(app),currentPick,'language and camera changes keep the current callback');
 invoke(app,currentPick,parts.muscle);
 assert.deepEqual(app.state.selection.reports,[]);
 assert.equal(app.state.result,null);
});
