import test from 'node:test';
import assert from 'node:assert/strict';
import {mountEditorApp} from './helpers/editor-renderer.mjs';
import {assertSelectableStructure} from './helpers/selectable-anatomy.mjs';

const cases=[
 {name:'first timing observation',kind:'feelings',target:'新运动后1至3天',check:report=>assert.ok(report.timing.includes('新运动后1至3天'))},
 {name:'exclusive duration replacement',kind:'feelings',prepare:'持续数小时',target:'持续1至3天',check:report=>assert.deepEqual(report.timing,['持续1至3天'])},
 {name:'additional trigger',kind:'feelings',prepare:'运动后',target:'外伤后',check:report=>assert.deepEqual(report.triggers,['运动后','外伤后'])},
 {name:'associated sign',kind:'signs',target:'发热',check:report=>assert.ok(report.signs.includes('发热'))},
 {name:'explicit location',kind:'feelings',part:'Rectus abdominis muscle.r',layer:'muscle',location:'左下腹',check:report=>assert.equal(report.location,'llq')}
];
for(const fixture of cases)test(`first edit invalidates the old report without resetting input scroll: ${fixture.name}`,async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());
 const part=fixture.part||'Anterior longitudinal ligament',layer=fixture.layer||'skeleton';
 assertSelectableStructure(part,layer);if(layer!=='skeleton')app.layer(layer);app.select(part);app.open('feelings');app.click(app.tag('酸痛'));
 if(fixture.prepare)app.click(app.tag(fixture.prepare));app.open('diagnosis');
 const previous=app.state.result,before=JSON.stringify(previous);assert.ok(previous&&!previous.error);
 app.open(fixture.kind);const panel=app.cls('sticker-sheet');panel.scrollTop=480;
 const target=fixture.location?app.button(fixture.location):app.tag(fixture.target);
 // Keyboard activation of an already-focused button causes a click without
 // a new focus event. This test checks App scroll intent, not browser geometry.
 target.focus();app.click(target);
 assert.equal(app.state.result,null,'the previous assessment must become invalid immediately');
 assert.equal(app.cls('sticker-sheet'),panel);assert.equal(panel.scrollTop,480);assert.equal(app.focused,target);
 fixture.check(app.state.selection.reports[0]);assert.equal(target.props['aria-pressed'],true);
 app.click(target);assert.equal(panel.scrollTop,480,'subsequent edits keep the same scroll intent');
 assert.equal(JSON.stringify(previous),before,'retained results are immutable');
 app.open('diagnosis');assert.equal(app.cls('sticker-sheet').scrollTop,0,'new assessments start at priority content');
 assert.notEqual(app.state.result,previous);
});

test('editing scroll survives About and language changes while deliberate navigation still resets it',async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());
 app.select('Anterior longitudinal ligament');app.open('feelings');app.click(app.tag('酸痛'));app.open('diagnosis');app.open('feelings');
 const panel=app.cls('sticker-sheet');panel.scrollTop=240;app.click(app.tag('外伤后'));
 assert.equal(app.state.result,null);assert.equal(panel.scrollTop,240);
 const selection=app.state.selection;
 app.navigate('#/about');app.click(app.all(n=>n.type==='button'&&n.props['aria-label']==='切换语言').at(-1));app.navigate('#/');
 assert.equal(app.state.selection,selection);assert.equal(app.state.result,null);assert.equal(app.cls('sticker-sheet'),panel);assert.equal(panel.scrollTop,240);
 assert.equal(app.tag('外伤后').props['aria-pressed'],true);
 app.open('signs');assert.equal(app.cls('sticker-sheet').scrollTop,0);app.open('feelings');assert.equal(app.cls('sticker-sheet').scrollTop,0);
 app.cls('sticker-sheet').scrollTop=190;app.select('Humerus.r');assert.equal(app.cls('sticker-sheet').scrollTop,0,'a different structure starts a new input context');
 app.open('diagnosis');const report=app.state.result;app.cls('sticker-sheet').scrollTop=170;app.open('diagnosis');
 assert.notEqual(app.state.result,report);assert.equal(app.cls('sticker-sheet').scrollTop,0,'an explicit reassessment returns to its top');
 app.click(app.button('RESET'));assert.equal(app.state.sheet,null);assert.equal(app.state.result,null);assert.deepEqual(app.state.selection.reports,[]);
});
