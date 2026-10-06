import {clinicalProfile} from './clinicalRegions.js';
import {ORGAN_CONDITIONS} from './organAtlas.js';
import {CLINICAL_RULES} from './clinicalRules.js';
import {evidenceFamily,LOCAL_PAIN_TAGS} from './symptomLanguage.js';
import {basicAssessment} from './basicAssessments.js';
import {orderPriorityGuidance,applyPriorityGuidance} from './priorityGuidance.js';
import {literatureWarnings} from './literatureTriage.js';
import {referenceLocation} from './reportLocation.js';
export const CONDITION_REGIONS=Object.fromEntries(Object.entries(CLINICAL_RULES).map(([id,r])=>[id,r.regions]));
export function normalizeReport(report){
 // Only explicitly selected tags are clinical inputs. context remains an API
 // compatibility alias; the interface records timing and triggers separately.
 const tags=new Set([...(report.feelings||[]),...(report.signs||[]),...(report.timing||[]),...(report.triggers||[]),...(report.context||[])].filter(t=>t!=='看不出异常'));
 return {...report,location:report.location||'unknown',tags};
}
const fits=(profile,rule,id)=>profile.organ?ORGAN_CONDITIONS[profile.organ]?.includes(id)||['sleep-deprivation','dehydration-pattern','blood-test-direction'].includes(id):rule.regions.includes(profile.region)&&(!rule.tissues||rule.tissues.includes(profile.tissue));
export function assessSymptoms(knowledge,input={}){
 const legacy=(input.parts||[]).map(part=>({...input,part,layer:input.layer||'skeleton',location:input.location||'unknown'}));
 const validTags=new Set(['feelings','signs','timing','triggers'].flatMap(kind=>knowledge[kind].map(t=>t.id)));
 const normalized=(input.reports||legacy).filter(r=>r.part).slice(0,1).map(normalizeReport);
 // Canonical option order makes all output evidence stable under input order.
 for(const report of normalized)report.tags=new Set([...validTags].filter(t=>report.tags.has(t)));
 const profiles=normalized.map(r=>({...clinicalProfile(r.part,r.layer),raw:r.part,layer:r.layer}));
 const symptoms=new Set(normalized.flatMap(r=>[...r.tags]));
 const has=(...tags)=>tags.some(t=>symptoms.has(t));
 const abdominal=profiles.some(p=>['abdomen','pelvis'].includes(p.region));
 const chestPain=[...LOCAL_PAIN_TAGS,'运动诱发胸闷'];
 const localHas=(index,...tags)=>tags.some(t=>normalized[index].tags.has(t));
 const urgent=[];
 const warn=(zh,en,level='emergency')=>urgent.push({zh,en,level});
 // Triage is independent of ranking and cannot disappear below the top cards.
 if(has('面部歪斜','说话含糊','突然单侧无力'))warn('面部歪斜、说话含糊或突然单侧无力：立即联系急救，记录起病时间。','Facial droop, slurred speech or sudden one-sided weakness: call emergency services and note onset time.');
 if(profiles.some((p,i)=>p.region==='chest'&&localHas(i,...chestPain)&&localHas(i,'气短','静息气短','呼吸困难','冷汗','出汗','晕厥','恶心','呕吐')))warn('胸部疼痛或不适伴气短、出汗、恶心或晕厥：立即急诊，不要用胃药试验排除心脏原因。','Chest pain or discomfort with breathlessness, sweating, nausea or fainting needs emergency assessment; an antacid response cannot exclude a cardiac cause.');
 else if(profiles.some((p,i)=>p.region==='chest'&&localHas(i,...chestPain)&&localHas(i,'突然起病')&&localHas(i,'持续数小时','持续1至3天','持续超过3天')))warn('突然发生且持续不缓解的胸部疼痛或不适：立即联系急救，不要等待气短或其他表现。','Sudden chest pain or discomfort that persists needs emergency care; do not wait for breathlessness or other signs.');
 else if(profiles.some((p,i)=>p.region==='chest'&&localHas(i,'突发剧痛')))warn('突发严重胸痛：立即联系急救，不要等待更多症状。','Sudden severe chest pain: call emergency services without waiting for more symptoms.');
 else if(profiles.some((p,i)=>p.region==='chest'&&localHas(i,'压迫感','运动诱发胸闷')))warn('胸部压迫感或活动时胸闷应当天尽快就医；持续不缓解或伴气短、冷汗时立即联系急救。','Chest pressure or exertional chest tightness needs same-day assessment; persistent pressure or associated breathlessness or cold sweat needs emergency care.','same-day');
 if(abdominal&&(has('突发剧痛','黑便','血便','腹部僵硬','晕厥')))warn('严重或突发腹部/盆腔痛、出血、腹部僵硬或晕厥：立即急诊。','Severe or sudden abdominal/pelvic pain, bleeding, rigidity or fainting: seek emergency assessment.');
 if(profiles.some((p,i)=>p.region==='abdomen'&&(normalized[i].tags.has('腹痛迁移至右下腹')||normalized[i].location==='rlq'&&normalized[i].tags.has('持续加重')&&localHas(i,...chestPain,'局部压痛'))))warn('右下腹迁移痛或持续加重的右下腹痛：尽快急诊排查阑尾炎等原因，伴发热时更应警惕。','Migrating or worsening right-lower abdominal pain, especially with fever, needs urgent assessment for appendicitis and other causes.','same-day');
 if(has('会阴麻木')&&profiles.some(p=>['neck','spine','hip','pelvis','lower-limb'].includes(p.region)))warn('所选颈背/腰腿区域伴会阴麻木：立即急诊评估。','Selected neck/back or leg area with saddle numbness need emergency assessment.');
 if(profiles.some((p,i)=>p.region==='eye'&&localHas(i,'视物模糊','畏光')))warn('报告视物模糊或畏光：今天尽快眼科评估。','Reported blurred vision or light sensitivity needs same-day eye assessment.','same-day');
 if(profiles.some((p,i)=>p.region==='lower-limb'&&localHas(i,'单侧肿胀')))warn('单侧腿部肿胀需要当日排查血栓；同时气短或胸痛应立即急救。','One-sided leg swelling needs same-day assessment for a clot; associated breathlessness or chest pain is an emergency.','same-day');
 if(abdominal&&has('可能怀孕')&&has('肩尖痛','晕厥','突发剧痛'))warn('可能怀孕并出现肩尖痛、晕厥或突发剧痛：立即急诊评估，不能等待其他表现。','Possible pregnancy with shoulder-tip pain, fainting or sudden severe pain needs emergency assessment without waiting for other signs.');
 else if(abdominal&&has('可能怀孕')&&has(...chestPain,'侧腰痛','腹痛迁移至右下腹','肩尖痛','向背部放射','腰腹向腹股沟放射','局部压痛'))warn('可能怀孕且腹部/盆腔痛：尽快就医确认；单侧剧痛、出血、肩尖痛或晕厥立即急诊。','Possible pregnancy with abdominal/pelvic pain needs prompt assessment; severe one-sided pain, bleeding, shoulder-tip pain or fainting is an emergency.','same-day');

 // Selected urinary warning signs must not fall through to mechanical back care.
 if(profiles.some((p,i)=>['abdomen','pelvis','spine','hip'].includes(p.region)&&localHas(i,'侧腰痛','尿痛','尿频','尿急')&&localHas(i,'发热','发冷')))warn('侧腰痛或排尿变化伴发热、寒战：当日尽快就医排查肾脏/尿路感染，不按普通腰背劳损处理。','Flank pain or urinary changes with fever or chills need urgent same-day assessment for kidney/urinary infection; do not treat it as ordinary back strain.','same-day');
 if(has('血尿')&&has('发热','发冷'))warn('血尿伴发热或寒战：当天尽快就医排查感染等原因；如剧痛、不能排尿或明显不适，立即急诊。','Blood in urine with fever or chills needs same-day assessment for infection and other causes; severe pain, inability to urinate or feeling very unwell needs emergency care.','same-day');
 else if(has('血尿'))warn('出现血尿：尽快就医检查；伴发热或排尿变化应当日评估；如剧痛或无法排尿，立即急诊。','Blood in urine needs prompt medical assessment; fever or urinary changes need same-day assessment; severe pain or inability to pass urine needs emergency care.','prompt');

 if(has('突发最严重头痛'))warn('突发最严重头痛：立即急诊，记录开始时间。','Sudden worst-ever headache: seek emergency care and note onset time.');
 if(has('呼吸困难','静息气短'))warn('呼吸困难或静息气短：立即就医；严重呼吸困难联系急救。','Breathing difficulty or breathlessness at rest needs immediate care; severe breathing difficulty is an emergency.');
 if(has('吞咽困难')){
  if(profiles.some((p,i)=>['tooth','jaw'].includes(p.region)&&localHas(i,'牙龈肿胀','面部肿胀','流脓')))warn('牙齿或颌面肿胀/感染表现伴吞咽困难：立即急诊；伴呼吸困难联系急救。','Dental or facial swelling/infection signs with difficulty swallowing need emergency assessment; call emergency services if breathing is affected.');
  else warn('吞咽困难：今天联系医疗机构评估；如已无法吞咽液体、明显口腔肿胀或伴呼吸困难，立即急诊。','Difficulty swallowing needs same-day medical assessment. If unable to swallow liquids, the mouth is markedly swollen or breathing is affected, seek emergency care.','same-day');
 }
 if(has('突然听力下降'))warn('突然听力下降：当日尽快耳鼻喉科评估。','Sudden hearing loss needs urgent same-day ENT assessment.','same-day');
 if(profiles.some((p,i)=>['shoulder','upper-limb','hand','hip','knee','ankle','foot'].includes(p.region)&&['红肿','局部肿胀'].some(t=>normalized[i].tags.has(t))&&has('发热','发冷')))
  warn('关节区域肿胀伴发烧或寒战：当日急诊排查关节感染。','Swelling around a joint with fever or chills needs same-day urgent assessment for infection.','same-day');
 if(has('黄疸')&&has('发热','发冷'))warn('黄疸伴发热或寒战：当天尽快就医检查肝胆；如明显腹痛、意识变化或晕厥，立即急诊。','Jaundice with fever or chills needs same-day liver/biliary assessment; significant abdominal pain, altered awareness or fainting needs emergency care.','same-day');
 else if(has('黄疸'))warn('眼白或皮肤发黄：尽快就医检查肝胆；伴发热或明显腹痛应急诊。','Yellow eyes or skin needs prompt liver/biliary assessment; fever or significant abdominal pain needs urgent care.','prompt');
 urgent.push(...literatureWarnings(profiles,normalized));
 const orderedUrgent=orderPriorityGuidance(urgent);
 const missing=[],candidates=[];
 for(let i=0;i<normalized.length;i++){
  const report=normalized[i],profile=profiles[i];
  const tags=report.tags;
  for(const condition of knowledge.conditions){
   const rule=CLINICAL_RULES[condition.id];if(!rule||!fits(profile,rule,condition.id))continue;
   if(rule.lifestyle&&urgent.length||rule.exclude?.some(t=>tags.has(t)))continue;
   // Urinary observations are not explained by a mechanical-only reference card.
   if(rule.family==='mechanical'&&['abdomen','pelvis','spine','hip'].includes(profile.region)&&['尿痛','尿频','尿急','侧腰痛','血尿'].some(t=>tags.has(t)))continue;
   const location=referenceLocation(profile,report);
   const locations=(!rule.locationRegions||rule.locationRegions.includes(profile.region))?rule.locations:null;
   if(locations&&location!=='diffuse'&&location!=='unknown'&&!locations.includes(location))continue;
   const groups=rule.required.map(group=>group.filter(tag=>tags.has(tag)));
   const unmatched=rule.required.filter((_,index)=>!groups[index].length);
   const matched=[...new Set([...groups.flat(),...rule.optional.filter(t=>tags.has(t))])];
   const families=new Set(matched.map(evidenceFamily));
   const unknownLocation=locations&&['unknown','diffuse'].includes(location)&&!(condition.id==='appendicitis-pattern'&&tags.has('腹痛迁移至右下腹'));
   if(unmatched.length||families.size<2||unknownLocation){
    if(matched.length)missing.push({id:condition.id,part:report.part,layer:report.layer,matched:matched.length,groups:unmatched,location:!!unknownLocation&&!unmatched.length&&families.size>=2});
    continue;
   }
   // One representative per independent family. Anatomy and synonyms never
   // count toward the two clinical inputs required to emit a card.
   const evidenceByFamily=new Map();for(const tag of matched)if(!evidenceByFamily.has(evidenceFamily(tag)))evidenceByFamily.set(evidenceFamily(tag),tag);
   const why=[...evidenceByFamily.values()];
   const score=rule.required.length*3+(rule.priority||0)+Math.min(2,rule.optional.filter(t=>tags.has(t)).length*.4);
   candidates.push({...condition,score,why,matchedSymptoms:matched,evidenceFamilies:[...families],family:rule.family,partRefs:[{part:report.part,layer:report.layer}],lifestyle:!!rule.lifestyle});
  }
 }
 // Specific branches suppress their generic counterpart within the area.
 const chosen=[];
 for(const candidate of candidates.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id))){
  const duplicate=chosen.find(c=>c.id===candidate.id);
  if(duplicate){duplicate.partRefs.push(...candidate.partRefs.filter(p=>!duplicate.partRefs.some(q=>q.part===p.part&&q.layer===p.layer)));continue;}
  if(chosen.some(c=>c.family===candidate.family&&c.partRefs.some(p=>candidate.partRefs.some(q=>q.part===p.part&&q.layer===p.layer))))continue;
  chosen.push(candidate);
 }
 let items=chosen.slice(0,6);
 if(!items.length&&normalized.length){const basic=basicAssessment(profiles[0],normalized[0],orderedUrgent);if(basic)items.push(basic);}
 items=applyPriorityGuidance(items,orderedUrgent);
 const suggestions=[...new Set(missing.sort((a,b)=>b.matched-a.matched).slice(0,3).flatMap(m=>m.groups.map(g=>g.find(t=>!symptoms.has(t))).filter(Boolean)))].slice(0,6);
 return {profiles,items,urgent:orderedUrgent,triageLevel:orderedUrgent[0]?.level||null,suggestions,needsLocation:missing.some(m=>m.location),needsSymptoms:!symptoms.size,needsPart:!profiles.length,needsEvidence:profiles.length>0&&!items.length};
}
