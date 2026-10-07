import test from 'node:test';
import assert from 'node:assert/strict';
import {mountEditorApp,textOf} from './helpers/editor-renderer.mjs';

test('camera updates reuse the editor, while clinical input and focus changes refresh it',async t=>{
  const app=await mountEditorApp();t.after(()=>app.destroy());
  app.layer('muscle');app.select('Rectus abdominis muscle.r');app.open('feelings');

  await t.test('60 wheel, keyboard-slider and pointer-slider updates skip editor/filter work',()=>{
    const panel=app.cls('sticker-sheet');
    const buttonState=()=>app.all(node=>node.type==='button'&&node.props.className?.includes('sheet-sticker'))
      .map(node=>[textOf(node),node.props['aria-pressed']]);
    const before=buttonState();
    for(const run of [
      ()=>{for(let i=0;i<60;i++)app.wheel(i%2?8:-8)},
      ()=>{for(let i=0;i<60;i++)app.sliderKey(i%2?'ArrowDown':'ArrowUp')},
      ()=>app.sliderMoves(60),
    ]){
      app.resetCounts();run();
      assert.deepEqual(app.counts,{app:60,editor:0,filters:0});
      assert.equal(app.cls('sticker-sheet'),panel);
      assert.deepEqual(buttonState(),before);
    }
  });

  await t.test('same-focus feelings, location, timing, signs and trigger patches stay live',()=>{
    const patch=(node,field,expected)=>{
      const before=app.state.selection.reports[0],focusId=app.state.selection.focusId,callback=app.state.updateReport;
      app.resetCounts();app.click(node);
      assert.equal(app.counts.editor,1);
      assert.equal(app.state.selection.focusId,focusId);
      assert.equal(app.state.updateReport,callback);
      assert.notEqual(app.state.selection.reports[0],before);
      assert.deepEqual(app.state.selection.reports[0][field],expected);
    };
    patch(app.tag('疼痛'),'feelings',['疼痛']);assert.equal(app.tag('疼痛').props['aria-pressed'],true);
    patch(app.tag('疼痛'),'feelings',[]);assert.equal(app.tag('疼痛').props['aria-pressed'],false);
    patch(app.tag('疼痛'),'feelings',['疼痛']);
    patch(app.button('右下腹'),'location','rlq');assert.equal(app.button('右下腹').props['aria-pressed'],true);
    patch(app.button('左下腹'),'location','llq');assert.equal(app.button('右下腹').props['aria-pressed'],false);
    patch(app.tag('刚刚开始'),'timing',['刚刚开始']);
    patch(app.tag('持续数小时'),'timing',['持续数小时']);
    assert.equal(app.tag('刚刚开始').props['aria-pressed'],false);
    assert.equal(app.tag('持续数小时').props['aria-pressed'],true);
    const trigger=app.knowledge.triggers.find(tag=>app.all(node=>node.type==='button'&&textOf(node)===tag.zh).length);
    patch(app.tag(trigger.id),'triggers',[trigger.id]);assert.equal(app.tag(trigger.id).props['aria-pressed'],true);
    app.open('signs');
    const sign=app.knowledge.signs.find(tag=>app.all(node=>node.type==='button'&&textOf(node)===tag.zh).length);
    patch(app.tag(sign.id),'signs',[sign.id]);assert.equal(app.tag(sign.id).props['aria-pressed'],true);
    app.open('feelings');assert.equal(app.tag('疼痛').props['aria-pressed'],true);
    assert.equal(app.tag('持续数小时').props['aria-pressed'],true);
  });

  await t.test('language, kind, part and layer refresh immediately; callbacks target the new ID',()=>{
    app.resetCounts();app.click(app.find(node=>node.props?.['aria-label']==='切换语言'));
    assert.equal(app.counts.editor,1);assert.equal(app.state.lang,'en');
    assert.equal(textOf(app.tag('疼痛')),'Pain / hard to describe');
    assert.equal(app.tag('疼痛').props['aria-pressed'],true);
    app.open('signs');assert.equal(app.state.sheet,'signs');assert.equal(app.cls('sticker-sheet').props['aria-label'],'ASSOCIATED SIGNS');
    app.open('feelings');assert.equal(app.state.sheet,'feelings');
    app.click(app.find(node=>node.props?.['aria-label']==='Switch language'));
    const oldId=app.state.selection.focusId,oldCallback=app.state.updateReport;
    app.select('Rectus femoris muscle.r');
    assert.notEqual(app.state.selection.focusId,oldId);assert.notEqual(app.state.updateReport,oldCallback);
    assert.deepEqual(app.state.selection.reports[0].feelings,[]);
    assert.equal(app.tag('疼痛').props['aria-pressed'],false);
    app.click(app.tag('疼痛'));
    assert.equal(app.state.selection.reports[0].id,'muscle:Rectus femoris muscle.r');
    assert.deepEqual(app.state.selection.reports[0].feelings,['疼痛']);
    assert.equal(app.tag('疼痛').props['aria-pressed'],true);
    app.select('Rectus femoris muscle.r');assert.equal(app.state.selection.focusId,null);
    assert.ok(app.all(node=>node.props?.className==='evidence-empty').some(node=>textOf(node).includes('先点击模型')));
    app.layer('organ');assert.equal(app.state.sheet,null);app.select('Stomach');app.open('feelings');
    assert.equal(app.state.selection.reports[0].id,'organ:Stomach');
    app.resetCounts();for(let i=0;i<60;i++)app.wheel(i%2?8:-8);
    assert.deepEqual(app.counts,{app:60,editor:0,filters:0});
  });
});
