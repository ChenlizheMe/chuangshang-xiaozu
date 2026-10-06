import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessSymptoms} from '../src/clinicalEngine.js';
import {visibleSymptoms} from '../src/symptomFilters.js';
const k=JSON.parse(fs.readFileSync(new URL('../data/knowledge.json',import.meta.url)));
const fields=['feelings','signs','timing','triggers'];
const assess=(part,tags,layer='skeleton')=>{
 const report={part,layer,...Object.fromEntries(fields.map(field=>[field,tags.filter(tag=>k[field].some(t=>t.id===tag))]))};
 const available=new Set(fields.flatMap(kind=>visibleSymptoms(k,{parts:[part],layer,kind}).map(t=>t.id)));
 for(const tag of tags)assert.ok(available.has(tag),`${part}: ${tag}`);
 return assessSymptoms(k,{reports:[report]});
};
const cases=[
 ['oral swelling and restricted opening','Mandible',['面部肿胀','张口受限'],'emergency'],
 ['tooth swelling and restricted opening','Lower canine.l',['牙龈肿胀','张口受限'],'emergency'],
 ['oral purulence without pain or fever','Lower canine.l',['流脓'],'same-day'],
 ['lingering thermal pain','Lower canine.l',['持续冷热痛'],'prompt'],
 ['spontaneous and night pain','Lower canine.l',['自发痛','夜间痛'],'prompt'],
 ['observed cavity without selected pain','Lower canine.l',['牙龋洞'],'prompt'],
 ['observed crack without selected pain','Lower canine.l',['牙齿裂纹'],'prompt'],
 ['red irritated eye after injury','Lacrimal bone.l',['异物感','眼红','外伤后'],'emergency'],
 ['sudden diplopia','Lacrimal bone.l',['复视','突然起病'],'same-day'],
 ['diplopia after injury','Lacrimal bone.l',['复视','外伤后'],'emergency'],
 ['diplopia onset not supplied','Lacrimal bone.l',['复视'],'prompt'],
 ['sudden hearing reduction','Incus.l',['听力下降','突然起病'],'same-day'],
 ['ear pain does not explain away sudden hearing reduction','Incus.l',['疼痛','听力下降','突然起病'],'same-day'],
 ['purulence on a skeletal model','Anterior longitudinal ligament',['流脓'],'prompt'],
 ['itchy rash with pus','Humerus.l',['痒','皮疹','流脓'],'prompt'],
 ['red skin with systemic change','Humerus.l',['灼烧','红斑','发热','持续加重'],'same-day'],
 ['longer nosebleed course without proof of uninterrupted bleeding','Anterior cells of ethmoid bone.l',['鼻出血','持续数小时'],'same-day']
];
for(const [name,part,tags,level] of cases)test(`reviewed dental/ENT/skin boundary: ${name}`,()=>{
 const r=assess(part,tags);assert.equal(r.triageLevel,level);assert.ok(r.items.every(item=>item.priority&&item.advice.zh===r.urgent[0].zh));
});
for(const [name,part,tags] of [
 ['brief thermal sensitivity','Lower canine.l',['冷热敏感','刺激去除即缓解']],
 ['ordinary itchy rash','Humerus.l',['痒','皮疹']],
 ['dry eyes with screen use','Lacrimal bone.l',['眼干','长时间看屏幕']],
 ['isolated tooth tension','Lower canine.l',['紧绷']],
 ['ordinary ear pain without sudden hearing change','Incus.l',['疼痛']],
 ['isolated nosebleed without unreported duration','Anterior cells of ethmoid bone.l',['鼻出血']]
])test(`ordinary nearby case retains graded, non-emergency handling: ${name}`,()=>assert.equal(assess(part,tags).triageLevel,null));
test('brief thermal sensitivity stays qualified and cannot mask an observed tooth defect',()=>{
 const r=assess('Lower canine.l',['冷热敏感','刺激去除即缓解']);const c=r.items.find(c=>c.id==='dentin-sensitivity');assert.ok(c);assert.match(c.name.zh,/需牙科鉴别/);
 const defect=assess('Lower canine.l',['冷热敏感','刺激去除即缓解','牙龋洞']);assert.equal(defect.triageLevel,'prompt');assert.ok(defect.items.every(c=>c.priority));
});
test('infection signs without airway/opening problems are not all sent to hospital emergency care',()=>{
 const r=assess('Lower canine.l',['牙龈肿胀','发热']);assert.equal(r.triageLevel,'same-day');
 assert.match(r.urgent[0].zh,/急诊牙科/);assert.doesNotMatch(r.urgent[0].zh,/已确诊/);
});
test('nasal basic guidance supplies first aid conditionally without requiring injury',()=>{
 const r=assess('Anterior cells of ethmoid bone.l',['鼻出血']);assert.equal(r.items.length,1);assert.ok(r.items[0].basic);
 assert.match(r.items[0].advice.zh,/若正在流鼻血/);assert.match(r.items[0].advice.zh,/10–15分钟/);assert.match(r.items[0].advice.zh,/不仰头/);
 const long=assess('Anterior cells of ethmoid bone.l',['鼻出血','持续数小时']);assert.equal(long.triageLevel,'same-day');assert.match(long.urgent[0].zh,/若现在仍出血/);
});
test('minor eye-surface references do not absorb a reported eye injury',()=>{
 const r=assess('Lacrimal bone.l',['异物感','眼红','外伤后']);assert.ok(!r.items.some(c=>c.id==='eye-surface-irritation'));
});

test('nasal trauma keeps conditional head-injury emergency safety net',()=>{
 const c=k.conditions.find(c=>c.id==='nasal-trauma-epistaxis');
 assert.match(c.threshold.zh,/头伤后嗜睡、意识变化或清液流出也应立即急诊/);
 assert.match(c.threshold.en,/Drowsiness, altered awareness or clear fluid drainage after head injury also needs emergency care/);
});

for(const tags of [['畏光','外伤后'],['眼红','视物模糊'],['眼红','畏光']])test(`eye emergency boundary: ${tags.join('/')}`,()=>{
 assert.equal(assess('Lacrimal bone.l',tags).triageLevel,'emergency');
});
test('post-injury discomfort without reported severe features is not automatically emergency',()=>{
 for(const tags of [['灼烧','外伤后'],['异物感','外伤后']])assert.equal(assess('Lacrimal bone.l',tags).triageLevel,'same-day');
});
test('ordinary swallowing difficulty receives same-day advice without inventing liquid obstruction',()=>{
 const r=assess('Oesophagus',['吞咽困难'],'organ');assert.equal(r.triageLevel,'same-day');
 assert.match(r.urgent[0].zh,/今天联系/);assert.match(r.urgent[0].zh,/如已无法吞咽液体/);
});

test('specific dental pain labels need no redundant generic pain to receive fever guidance',()=>{
 for(const tag of ['持续冷热痛','自发痛','夜间痛'])assert.equal(assess('Lower canine.l',[tag,'发热']).triageLevel,'same-day');
 assert.equal(assess('Lower canine.l',['发热']).triageLevel,null);
});
test('pus after periocular injury asks urgently about source instead of asserting intraocular pus',()=>{
 const r=assess('Lacrimal bone.l',['流脓','外伤后']);assert.equal(r.triageLevel,'same-day');
 assert.match(r.urgent[0].zh,/脓液来自眼内\/眼表/);
});

test('isolated eye visual observations do not invent eye pain',()=>{
 for(const tag of ['视物模糊','畏光']){const r=assess('Lacrimal bone.l',[tag]);assert.equal(r.triageLevel,'same-day');assert.doesNotMatch(r.urgent[0].zh,/眼痛/);assert.doesNotMatch(r.urgent[0].en,/Eye pain/);}
});
