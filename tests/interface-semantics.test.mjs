import test from 'node:test';
import assert from 'node:assert/strict';
import {mountEditorApp,textOf} from './helpers/editor-renderer.mjs';
const headings=app=>app.all(node=>/^h[1-6]$/.test(node.type)).map(node=>[node.type,textOf(node)]);
const groups=app=>app.all(node=>node.props?.role==='group');
const language=app=>app.click(app.find(node=>node.type==='button'&&['切换语言','Switch language'].includes(node.props['aria-label'])));

test('the model page and its existing tool groups have semantic names in both languages',async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());
 assert.deepEqual(headings(app),[['h1','创伤小组']]);
 assert.deepEqual(groups(app).map(node=>node.props['aria-label']),['解剖图层选择','排查操作']);
 language(app);assert.deepEqual(headings(app),[['h1','TRAUMA TEAM']]);
 assert.deepEqual(groups(app).map(node=>node.props['aria-label']),['Anatomy layer picker','Quick actions']);
 for(const group of groups(app))assert.equal(group.props.tabIndex,undefined,'group containers do not create keyboard stops');
});
test('actual location, sensations, timing and triggers remain distinct named toggle groups',async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());app.layer('muscle');app.select('Rectus abdominis muscle.r');app.open('feelings');
 const names=()=>groups(app).map(node=>node.props['aria-label']).slice(2);
 assert.deepEqual(names(),['你实际感觉的位置','不舒服的感觉','时间','诱因与缓解因素']);
 assert.deepEqual(headings(app).map(([level])=>level),['h1','h2']);
 const panel=app.cls('sticker-sheet');assert.equal(panel.props.role,'dialog');
 app.click(app.tag('酸痛'));assert.equal(app.tag('酸痛').props['aria-pressed'],true);
 app.click(app.tag('持续数小时'));app.click(app.tag('持续1至3天'));assert.deepEqual(app.state.selection.reports[0].timing,['持续1至3天']);
 language(app);assert.deepEqual(names(),['WHERE YOU FEEL IT','FEELINGS','TIMING','TRIGGERS & RELIEF']);
 assert.equal(app.tag('酸痛').props['aria-pressed'],true);assert.equal(app.tag('持续1至3天').props['aria-pressed'],true);
 app.open('signs');assert.deepEqual(names(),['ASSOCIATED SIGNS'],'the signs panel gains no timing or location group');
 app.click(app.tag('发热'));assert.equal(app.tag('发热').props['aria-pressed'],true);
});
test('priority actions precede reference headings, and reevaluation replaces the heading level text',async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());app.select('Body of sternum');app.open('feelings');app.click(app.tag('压迫感'));app.open('signs');app.click(app.tag('气短'));app.open('diagnosis');
 let outline=headings(app);assert.equal(outline[1][0],'h2');assert.deepEqual(outline[2],['h3','立即评估']);assert.ok(outline.slice(3).every(([level])=>level==='h3'));
 assert.equal(app.all(node=>node.props?.role==='alert').length,0,'whole clinical reports are not added as interrupting alerts');
 app.open('signs');app.click(app.tag('气短'));app.open('diagnosis');outline=headings(app);assert.deepEqual(outline[2],['h3','当天评估']);assert.ok(!outline.some(([,text])=>text==='立即评估'));
 language(app);assert.deepEqual(headings(app)[2],['h3','SAME-DAY ASSESSMENT']);
});
test('ordinary references and empty panels do not acquire a fictional urgency heading',async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());app.open('diagnosis');assert.deepEqual(headings(app).map(([level])=>level),['h1','h2']);
 app.select('Humerus.r');app.open('feelings');app.click(app.tag('酸痛'));app.open('diagnosis');
 assert.equal(app.state.result.triageLevel,null);assert.deepEqual(headings(app).map(([level])=>level),['h1','h2','h3']);
 assert.equal(app.all(node=>node.props?.className==='urgent-strip').length,0);
});
