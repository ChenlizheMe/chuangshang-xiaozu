import test from 'node:test';
import assert from 'node:assert/strict';
import {mountEditorApp,textOf} from './helpers/editor-renderer.mjs';
import {assertSelectableStructure} from './helpers/selectable-anatomy.mjs';
const buttons=app=>app.all(node=>node.type==='button'&&node.props?.className?.split(' ').includes('sticker-card'));
const feel=app=>buttons(app)[0];
async function start(t){
 const app=await mountEditorApp();t.after(()=>app.destroy());app.layer('muscle');assertSelectableStructure('Rectus abdominis muscle.r','muscle');app.select('Rectus abdominis muscle.r');app.open('feelings');return app;
}
for(const tag of ['持续数小时','运动后','酸痛'])test(`a sole ${tag} remains represented after closing and cancels back to +`,async t=>{
 const app=await start(t);assert.equal(textOf(feel(app)),'感觉 +');app.click(app.tag(tag));app.key('Escape');
 assert.equal(textOf(feel(app)),'感觉 1');assert.equal(feel(app).props['aria-label'],'感觉，已选1项信息');assert.equal(feel(app).props.title,feel(app).props['aria-label']);
 app.open('feelings');app.click(app.tag(tag));app.key('Escape');assert.equal(textOf(feel(app)),'感觉 +');assert.equal(feel(app).props['aria-label'],'感觉，未选择信息');
});
test('only explicitly selected non-default location counts, including a diffuse selection',async t=>{
 const app=await start(t);assert.equal(textOf(feel(app)),'感觉 +');app.click(app.button('右下腹'));app.key('Escape');assert.equal(textOf(feel(app)),'感觉 1');
 app.open('feelings');const locations=()=>app.all(node=>node.type==='button'&&node.props?.className?.includes('location-chip'));
 app.click(locations()[0]);assert.equal(app.state.selection.reports[0].location,'unknown');assert.equal(textOf(feel(app)),'感觉 +');
 app.click(locations().at(-1));assert.equal(app.state.selection.reports[0].location,'diffuse');assert.equal(textOf(feel(app)),'感觉 1');
});
test('the count covers selected panel details, stays stable on duration replacement, and excludes Signs',async t=>{
 const app=await start(t);for(const tag of ['酸痛','持续数小时','运动后'])app.click(app.tag(tag));app.click(app.button('右下腹'));assert.equal(textOf(feel(app)),'感觉 4');
 app.click(app.tag('持续1至3天'));assert.equal(textOf(feel(app)),'感觉 4');app.click(app.tag('持续1至3天'));assert.equal(textOf(feel(app)),'感觉 3');
 app.open('signs');app.click(app.tag('发热'));assert.equal(textOf(feel(app)),'感觉 3');assert.equal(textOf(buttons(app)[1]),'表现 1');assert.equal(buttons(app)[1].props['aria-label'],'表现，已选1项信息');
 const report=app.state.selection.reports[0];app.navigate('#/about');app.click(app.all(node=>node.type==='button'&&node.props['aria-label']==='切换语言').at(-1));app.navigate('#/');
 assert.equal(app.state.selection.reports[0],report);assert.equal(textOf(feel(app)),'FEEL 3');assert.equal(feel(app).props['aria-label'],'FEEL, 3 selected details');assert.equal(buttons(app)[1].props['aria-label'],'SIGNS, 1 selected detail');
 app.select('Rectus abdominis muscle.l');assert.equal(textOf(feel(app)),'FEEL +');assert.equal(feel(app).props['aria-label'],'FEEL, no details selected');
});
test('a positive information badge does not create clinical symptom evidence',async t=>{
 const app=await start(t);app.click(app.tag('持续数小时'));app.click(app.button('右下腹'));assert.equal(textOf(feel(app)),'感觉 2');app.open('diagnosis');
 assert.deepEqual(app.state.result.items,[]);assert.deepEqual(app.state.result.urgent,[]);assert.equal(app.state.result.needsEvidence,true);
 app.layer('skeleton');assert.equal(textOf(feel(app)),'感觉 +');assert.equal(textOf(buttons(app)[1]),'表现 +');
});
