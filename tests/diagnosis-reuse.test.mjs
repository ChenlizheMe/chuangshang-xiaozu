// Actual presentation components and App state with a synthetic DOM/3D host.
// These counters measure avoided rendering work, not clinical accuracy or FPS.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mountEditorApp,textOf} from './helpers/editor-renderer.mjs';
const fixtures=[
 {name:'ordinary basic',part:'Humerus.r',feelings:['酸痛'],signs:[],cards:1},
 {name:'urgent chest',part:'Sternum',feelings:['压迫感'],signs:['气短'],cards:1},
 {name:'two dental references',part:'Lower canine.l',feelings:['咬合痛','外伤后'],signs:['牙龈肿胀'],cards:2}
];
for(const fixture of fixtures)test(`${fixture.name}: camera reuse preserves output, real edits still refresh the report`,async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());app.select(fixture.part);app.open('feelings');for(const id of fixture.feelings)app.click(app.tag(id));app.open('signs');for(const id of fixture.signs)app.click(app.tag(id));app.open('diagnosis');
 const original=app.state.result,before=JSON.stringify(original),panel=app.cls('diagnosis-sheet'),cards=app.all(node=>node.type==='article');
 assert.equal(cards.length,fixture.cards);panel.scrollTop=173;
 for(const update of [()=>{for(let i=0;i<60;i++)app.wheel(i%2?8:-8);},()=>{for(let i=0;i<60;i++)app.sliderKey(i%2?'ArrowDown':'ArrowUp');},()=>app.sliderMoves(60)]){
  app.resetCounts();update();assert.equal(app.counts.app,60);assert.deepEqual(app.cardCounts,{cards:0,why:0});assert.equal(app.state.result,original);assert.equal(JSON.stringify(original),before);assert.equal(app.cls('diagnosis-sheet'),panel);assert.equal(panel.scrollTop,173);assert.deepEqual(app.all(node=>node.type==='article'),cards);
 }
 app.navigate('#/about');app.resetCounts();app.click(app.all(node=>node.type==='button'&&node.props['aria-label']==='切换语言').at(-1));
 assert.equal(app.cardCounts.cards,fixture.cards,'language changes must refresh every card even while the model page is hidden');
 app.navigate('#/');assert.equal(app.state.result,original);assert.equal(panel.scrollTop,173);assert.equal(app.focused.props.href,'#/about');assert.match(textOf(cards[0]),/Reference features/);
 if(fixture.name==='ordinary basic'){
  app.open('feelings');app.click(app.tag('持续数小时'));app.open('diagnosis');assert.equal(app.state.result.items[0].id,original.items[0].id);assert.match(textOf(app.cls('cards')),/Several hours/);
 }else{
  app.open('signs');app.click(app.tag(fixture.signs[0]));app.open('diagnosis');
  if(fixture.name==='urgent chest'){assert.equal(original.triageLevel,'emergency');assert.equal(app.state.result.triageLevel,'same-day');assert.match(textOf(app.cls('urgent-strip')),/SAME-DAY ASSESSMENT/);}
  else {assert.equal(app.state.result.items.length,1);assert.ok(!app.state.result.items.some(item=>item.id==='dental-abscess'));}
 }
 assert.notEqual(app.state.result,original);assert.equal(app.cls('diagnosis-sheet').scrollTop,0);assert.equal(JSON.stringify(original),before,'new reports do not mutate the prior presentation');
});
