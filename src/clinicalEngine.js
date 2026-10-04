import {clinicalProfile} from './clinicalRegions.js';
import {ORGAN_CONDITIONS} from './organAtlas.js';
import {CLINICAL_RULES} from './clinicalRules.js';
import {evidenceFamily,interpretText,SYSTEMIC_TAGS} from './symptomLanguage.js';
export const CONDITION_REGIONS=Object.fromEntries(Object.entries(CLINICAL_RULES).map(([id,r])=>[id,r.regions]));
const DEFAULT_ORGAN_LOCATION={heart:'unknown',stomach:'epigastric',pancreas:'epigastric',appendix:'rlq',liver:'ruq',biliary:'ruq',spleen:'luq',kidney:'flank',ureter:'flank',bladder:'suprapubic'};
export function normalizeReport(report){
 const parsed=interpretText(report.text);
 // An explicit checkbox wins over text negation, but the conflict is surfaced.
 const checked=new Set([...(report.feelings||[]),...(report.signs||[]),...(report.context||[])]);
 const tags=new Set([...checked,...parsed.findings.map(f=>f.id)].filter(t=>t!=='看不出异常'));
 const conflicts=parsed.denied.filter(t=>checked.has(t)||parsed.findings.some(f=>f.id===t));
 return {...report,location:report.location&&report.location!=='unknown'?report.location:parsed.location||'unknown',tags,denied:new Set(parsed.denied.filter(t=>!checked.has(t))),conflicts};
}
const fits=(profile,rule,id)=>profile.organ?ORGAN_CONDITIONS[profile.organ]?.includes(id)||['sleep-deprivation','dehydration-pattern','blood-test-direction'].includes(id):rule.regions.includes(profile.region)&&(!rule.tissues||rule.tissues.includes(profile.tissue));
export function assessSymptoms(knowledge,input={}){
 const legacy=(input.parts||[]).map(part=>({part,layer:input.layer||'skeleton',feelings:input.feelings||[],signs:input.signs||[],context:input.context||[],text:input.text||'',location:input.location||'unknown'}));
 const normalized=(input.reports||legacy).filter(r=>r.part).map(normalizeReport);
 const profiles=normalized.map(r=>({...clinicalProfile(r.part,r.layer),raw:r.part,layer:r.layer}));
 const systemic=new Set(normalized.flatMap(r=>[...r.tags].filter(t=>SYSTEMIC_TAGS.has(t)&&!r.conflicts.includes(t))));
 const symptoms=new Set(normalized.flatMap(r=>[...r.tags]));
 const has=(...tags)=>tags.some(t=>symptoms.has(t));
 const abdominal=profiles.some(p=>p.region==='abdomen');
 const localHas=(index,...tags)=>tags.some(t=>normalized[index].tags.has(t));
 const urgent=[];
 const warn=(zh,en)=>urgent.push({zh,en});
 // Triage is independent of ranking and cannot disappear below the top cards.
 if(has('面部歪斜','说话含糊','突然单侧无力'))warn('新出现面部歪斜、说话含糊或单侧无力：立即联系急救，记录起病时间。','New facial droop, slurred speech or one-sided weakness: call emergency services and note onset time.');
 if(profiles.some((p,i)=>p.region==='chest'&&localHas(i,'压迫感','疼痛','呼吸痛','灼烧','放射痛','刺痛','钝痛')&&localHas(i,'气短','静息气短','冷汗','晕厥')))warn('胸痛伴气短、冷汗或晕厥：立即急诊，不要用胃药试验排除心脏原因。','Chest pain with breathlessness, cold sweat or fainting needs emergency assessment; an antacid response cannot exclude a cardiac cause.');
 else if(profiles.some((p,i)=>p.region==='chest'&&localHas(i,'压迫感')))warn('新发胸部压迫感应尽快就医；突然发生或持续不缓解时立即联系急救。','New chest pressure needs prompt assessment; sudden or persistent pressure needs emergency care.');
 if(abdominal&&(has('突发剧痛','黑便','血便','呕血','腹部僵硬','晕厥')))warn('严重或突发腹痛、出血、腹部僵硬或晕厥：立即急诊。','Severe or sudden abdominal pain, bleeding, rigidity or fainting: seek emergency assessment.');
 if(profiles.some((p,i)=>p.region==='abdomen'&&(normalized[i].tags.has('腹痛迁移至右下腹')||normalized[i].location==='rlq'&&normalized[i].tags.has('持续加重'))))warn('右下腹迁移痛或持续加重的右下腹痛伴发热：尽快急诊排查阑尾炎等原因。','Migrating or worsening right-lower abdominal pain, especially with fever, needs urgent assessment for appendicitis and other causes.');
 if(has('会阴麻木','排尿困难')&&profiles.some(p=>['spine','hip','lower-limb'].includes(p.region)))warn('腰腿症状伴会阴麻木或新发排尿困难：立即急诊评估。','Back/leg symptoms with saddle numbness or new difficulty passing urine need emergency assessment.');
 if(profiles.some((p,i)=>p.region==='eye'&&localHas(i,'视物模糊','畏光')))warn('眼痛伴视力变化或畏光：尽快眼科急诊。','Eye pain with vision change or light sensitivity: seek urgent eye assessment.');
 if(profiles.some((p,i)=>p.region==='lower-limb'&&localHas(i,'单侧肿胀')))warn('单侧腿部新发肿痛需要当日排查血栓；同时气短或胸痛应立即急救。','New one-sided leg swelling needs same-day assessment for a clot; associated breathlessness or chest pain is an emergency.');
 if(abdominal&&has('可能怀孕'))warn('可能怀孕且腹痛：尽快就医确认；单侧剧痛、出血、肩尖痛或晕厥立即急诊。','Possible pregnancy with abdominal pain needs prompt assessment; severe one-sided pain, bleeding, shoulder-tip pain or fainting is an emergency.');

 if(has('突发最严重头痛'))warn('突发最严重头痛：立即急诊，记录开始时间。','Sudden worst-ever headache: seek emergency care and note onset time.');
 if(has('呼吸困难','静息气短','吞咽困难'))warn('新发呼吸困难、静息气短或无法吞咽液体：立即就医；严重呼吸困难联系急救。','New breathing difficulty, breathlessness at rest or inability to swallow fluids needs immediate care; severe breathing difficulty is an emergency.');
 if(has('突然听力下降'))warn('突然听力下降：当日尽快耳鼻喉科评估。','Sudden hearing loss needs urgent same-day ENT assessment.');
 if(profiles.some((p,i)=>['shoulder','upper-limb','hand','hip','knee','ankle','foot'].includes(p.region)&&['红肿','局部肿胀'].some(t=>normalized[i].tags.has(t))&&has('发热','发冷')))
  warn('关节新发肿痛伴发烧或寒战：当日急诊排查关节感染。','New swollen joint with fever or chills needs same-day urgent assessment for infection.');
 if(has('黄疸'))warn('新出现眼白或皮肤发黄：尽快就医检查肝胆；伴发热或明显腹痛应急诊。','New yellow eyes or skin needs prompt liver/biliary assessment; fever or significant abdominal pain needs urgent care.');
 const missing=[],candidates=[];
 for(let i=0;i<normalized.length;i++){
  const report=normalized[i],profile=profiles[i];
  const tags=new Set([...report.tags,...[...systemic].filter(t=>!report.denied.has(t))]);
  for(const condition of knowledge.conditions){
   const rule=CLINICAL_RULES[condition.id];if(!rule||!fits(profile,rule,condition.id))continue;
   if(rule.lifestyle&&urgent.length||rule.exclude?.some(t=>tags.has(t)))continue;
   const location=report.location!=='unknown'&&report.location?report.location:DEFAULT_ORGAN_LOCATION[profile.organ]||'unknown';
   if(rule.locations&&location!=='diffuse'&&location!=='unknown'&&!rule.locations.includes(location))continue;
   const groups=rule.required.map(group=>group.filter(tag=>tags.has(tag)));
   const unmatched=rule.required.filter((_,index)=>!groups[index].length);
   const matched=[...new Set([...groups.flat(),...rule.optional.filter(t=>tags.has(t))])];
   const families=new Set(matched.map(evidenceFamily));
   const unknownLocation=rule.locations&&['unknown','diffuse'].includes(location)&&!tags.has('腹痛迁移至右下腹');
   if(unmatched.length||families.size<2||unknownLocation||matched.some(t=>report.conflicts.includes(t))){
    if(matched.length)missing.push({id:condition.id,part:report.part,layer:report.layer,matched:matched.length,groups:unmatched,location:unknownLocation});
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
 // Merge the same clinical direction across valid area reports. Specific
 // regional branches suppress their generic counterpart within that area.
 const chosen=[];
 for(const candidate of candidates.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id))){
  const duplicate=chosen.find(c=>c.id===candidate.id);
  if(duplicate){duplicate.partRefs.push(...candidate.partRefs.filter(p=>!duplicate.partRefs.some(q=>q.part===p.part&&q.layer===p.layer)));continue;}
  if(chosen.some(c=>c.family===candidate.family&&c.partRefs.some(p=>candidate.partRefs.some(q=>q.part===p.part&&q.layer===p.layer))))continue;
  chosen.push(candidate);
 }
 const items=chosen.slice(0,6);
 const suggestions=[...new Set(missing.sort((a,b)=>b.matched-a.matched).slice(0,3).flatMap(m=>m.groups.map(g=>g.find(t=>!symptoms.has(t))).filter(Boolean)))].slice(0,6);
 return {profiles,items,urgent:[...new Map(urgent.map(w=>[w.zh,w])).values()],suggestions,needsLocation:missing.some(m=>m.location),conflicts:[...new Set(normalized.flatMap(r=>r.conflicts))],needsSymptoms:!symptoms.size,needsPart:!profiles.length,needsEvidence:profiles.length>0&&!items.length};
}
