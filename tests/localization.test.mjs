import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
test('every English condition field is English rather than a Chinese placeholder',()=>{
 for(const c of k.conditions)for(const field of ['name','shortDescription','triggers','advice','threshold']){
  assert.match(c[field].en,/[A-Za-z]/,`${c.id}.${field}`);
  assert.doesNotMatch(c[field].en,/\p{Script=Han}/u,`${c.id}.${field}`);
 }
});
test('difficulty swallowing does not claim an unreported inability to swallow liquids',()=>{
 const result=assessSymptoms(k,{reports:[{part:'Oesophagus',layer:'organ',signs:['吞咽困难']}]});
 assert.ok(result.urgent.length);
 const message=result.urgent.find(u=>u.zh.includes('吞咽困难'));
 assert.match(message.zh,/如已无法吞咽液体/);
 assert.match(message.en,/If unable to swallow liquids/);
 assert.doesNotMatch(message.zh,/新发呼吸困难/);
});
test('dental swelling with swallowing difficulty preserves emergency action',()=>{
 for(const swelling of ['牙龈肿胀','面部肿胀','流脓']){
  const result=assessSymptoms(k,{reports:[{part:'Upper first molar tooth.r',layer:'skeleton',signs:[swelling,'吞咽困难']}]});
  assert.ok(result.urgent.some(u=>/立即急诊/.test(u.zh)&&/emergency assessment/.test(u.en)));
 }
});
test('right-lower migration guidance does not assert an unselected fever',()=>{
 const result=assessSymptoms(k,{reports:[{part:'Rectus abdominis muscle.r',layer:'muscle',feelings:['腹痛迁移至右下腹']}]});
 assert.ok(result.urgent.some(u=>u.zh.includes('伴发热时')));
});
