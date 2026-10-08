import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
import {mixedHandDistributionContext} from '../src/mixedHandContext.js';
import {assertSelectableStructure} from './helpers/selectable-anatomy.mjs';
import {mountEditorApp,textOf} from './helpers/editor-renderer.mjs';
const knowledge=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const fields=['feelings','signs','timing','triggers'];
const median='拇食中指麻木',ulnar='无名小指麻木',night='夜间麻木';
function assess(tags,part='Humerus.r'){
 const layer='skeleton';assertSelectableStructure(part,layer);
 for(const tag of tags)assert.ok(fields.some(field=>knowledge[field].some(t=>t.id===tag)),tag);
 const report={part,layer,location:'unknown',...Object.fromEntries(fields.map(field=>[field,tags.filter(tag=>knowledge[field].some(t=>t.id===tag))]))};
 for(const field of fields){const visible=new Set(visibleSymptoms(knowledge,{parts:[part],layer,kind:field}).map(t=>t.id));for(const tag of report[field])assert.ok(visible.has(tag),`${part}: ${field}: ${tag}`);}
 return assessSymptoms(knowledge,{reports:[report]});
}
const contexts=app=>app.all(node=>node.props?.className?.split(' ').includes('mixed-hand-context'));
function fill(app,tags){
 app.select('Humerus.r');app.open('feelings');
 for(const tag of tags.filter(id=>!knowledge.signs.some(t=>t.id===id)))app.click(app.tag(tag));
 const signs=tags.filter(id=>knowledge.signs.some(t=>t.id===id));
 if(signs.length){app.open('signs');for(const tag of signs)app.click(app.tag(tag));}
 app.open('diagnosis');
}
test('mixed hand context preserves the same assessment, evidence and possible references',()=>{
 for(const part of ['Scaphoid bone.l','Humerus.r'])for(const tags of [[median,ulnar],[median,ulnar,night],[median,ulnar,'屈肘加重'],[median,ulnar,'甩手缓解']]){
  const result=assess(tags,part),before=JSON.stringify(result),context=mixedHandDistributionContext(result);
  assert.ok(context);assert.match(context.zh,/拇指、食指、中指和无名指、小指/);assert.match(context.en,/ring and little fingers/);
  assert.equal(JSON.stringify(result),before);assert.equal(result.triageLevel,null);
  assert.equal(mixedHandDistributionContext(assess([...tags].reverse(),part)),context);
  assert.equal(mixedHandDistributionContext(assess([...tags,...tags],part)),context);
 }
 for(const tags of [[median,night],[ulnar,night]])assert.equal(mixedHandDistributionContext(assess(tags)),null);
});
test('missing, malformed, multiple or out-of-region saved contexts do not infer a combined distribution',()=>{
 const result=assess([median,ulnar,night]);
 for(const input of [null,undefined,{}, {...result,error:true}, {...result,profiles:undefined}, {...result,profiles:[]}, {...result,profiles:[...result.profiles,...result.profiles]}, {...result,profiles:[{region:'foot'}]}, {...result,items:null}, {...result,reportedSymptoms:null}, {...result,reportedSymptoms:'拇食中指麻木 无名小指麻木'}, {...result,reportedSymptoms:[median]}])assert.equal(mixedHandDistributionContext(input),null);
 const saved=JSON.parse(JSON.stringify(result));Object.freeze(saved.reportedSymptoms);Object.freeze(saved.profiles);Object.freeze(saved);
 assert.ok(mixedHandDistributionContext(saved));
});
for(const fixture of [
 {name:'basic',tags:[median,ulnar],card:'basic-sensory-upper-limb',level:null},
 {name:'carpal',tags:[median,ulnar,night],card:'carpal-tunnel',level:null},
 {name:'ulnar',tags:[median,ulnar,'屈肘加重'],card:'ulnar-nerve-irritation',level:null},
 {name:'emergency',tags:[median,ulnar,night,'突然单侧无力'],card:'carpal-tunnel',level:'emergency'}
])test(`actual saved ${fixture.name} report places one translated context after priority and before cards`,async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());fill(app,fixture.tags);
 const result=app.state.result,before=JSON.stringify(result),selection=app.state.selection;
 assert.deepEqual(result,assess(fixture.tags));assert.equal(result.triageLevel,fixture.level);assert.equal(result.items[0].id,fixture.card);
 assert.equal(contexts(app).length,1);assert.equal(textOf(contexts(app)[0]),mixedHandDistributionContext(result).zh);
 const order=app.all(node=>node.props?.className==='urgent-strip'||node.props?.className==='cards'||node.props?.className?.includes('mixed-hand-context')).map(node=>node.props.className);
 assert.deepEqual(order,fixture.level?['urgent-strip','evidence-empty mixed-hand-context','cards']:['evidence-empty mixed-hand-context','cards']);
 if(fixture.level)for(const item of result.items)for(const lang of ['zh','en'])assert.equal(item.advice[lang],result.urgent[0][lang]);
 const why=JSON.stringify(result.items.map(item=>item.why));
 app.click(app.find(node=>node.type==='button'&&node.props?.['aria-label']==='切换语言'));
 assert.equal(textOf(contexts(app)[0]),mixedHandDistributionContext(result).en);assert.equal(app.state.result,result);assert.equal(app.state.selection,selection);assert.equal(JSON.stringify(result),before);assert.equal(JSON.stringify(result.items.map(item=>item.why)),why);
 app.navigate('#/about');assert.equal(app.cls('app').props.hidden,true);app.navigate('#/');
 assert.equal(app.state.result,result);assert.equal(contexts(app).length,1);assert.equal(textOf(contexts(app)[0]),mixedHandDistributionContext(result).en);
});
test('editing and reassessing removes or restores context without changing an older saved result',async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());fill(app,[median,night]);
 const single=app.state.result,singleBefore=JSON.stringify(single);assert.equal(contexts(app).length,0);
 app.open('feelings');app.click(app.tag(ulnar));assert.equal(app.state.result,null);assert.equal(mixedHandDistributionContext(single),null);assert.equal(contexts(app).length,0);
 app.open('diagnosis');const mixed=app.state.result,mixedBefore=JSON.stringify(mixed);assert.equal(contexts(app).length,1);
 app.open('feelings');app.click(app.tag(median));assert.equal(app.state.result,null);app.open('diagnosis');
 assert.equal(contexts(app).length,0);assert.equal(app.state.result.items[0].id,'ulnar-nerve-irritation');assert.equal(JSON.stringify(mixed),mixedBefore);assert.equal(JSON.stringify(single),singleBefore);
 app.open('feelings');app.click(app.tag(median));app.open('diagnosis');assert.equal(contexts(app).length,1);
 app.select('Scaphoid bone.l');assert.equal(app.state.result,null);assert.equal(contexts(app).length,0);
});
test('camera changes reuse the saved context and existing memoized cards',async t=>{
 const app=await mountEditorApp();t.after(()=>app.destroy());fill(app,[median,ulnar,night]);
 const result=app.state.result,node=contexts(app)[0];app.resetCounts();for(let i=0;i<60;i++)app.wheel(i%2?8:-8);
 assert.equal(contexts(app)[0],node);assert.equal(app.state.result,result);assert.deepEqual(app.cardCounts,{cards:0,why:0});assert.equal(app.counts.filters,0);
});
