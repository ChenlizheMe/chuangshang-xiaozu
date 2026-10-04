import {clinicalProfile} from './clinicalRegions.js';
import {ORGAN_CONDITIONS} from './organAtlas.js';

// Explicit clinical regions, not substring aliases (e.g. 'rectus' is not
// necessarily abdominal). These are educational differentials, not probabilities.
export const CONDITION_REGIONS = {
 'cardiac-ischaemia-warning':['chest'],'pancreatitis-pattern':['abdomen'],
 'hepatobiliary-pattern':['abdomen'],'splenic-injury-warning':['abdomen'],
 'muscle-strain':['neck','spine','shoulder','upper-limb','hand','chest','abdomen','hip','knee','lower-limb','ankle','foot'],
 'nerve-irritation':['neck','spine','shoulder','upper-limb','hand','hip','lower-limb','ankle','foot'],
 'skin-irritation':['skin'], 'itch-skin-pattern':['skin'], 'visible-skin-change-pattern':['skin'],
 'minor-injury-bruise':['neck','spine','shoulder','upper-limb','hand','chest','abdomen','hip','knee','lower-limb','ankle','foot'],
 'joint-inflammation':['shoulder','upper-limb','hand','hip','knee','ankle','foot'],
 'joint-swelling-pattern':['shoulder','upper-limb','hand','hip','knee','ankle','foot'],
 'muscle-cramp-pattern':['neck','spine','shoulder','upper-limb','hand','abdomen','hip','lower-limb','foot'],
 'nerve-sensation-pattern':['neck','spine','upper-limb','hand','hip','lower-limb','foot'],
 'head-pressure-pattern':['head'], 'headache-pattern':['head'], 'migraine-pattern':['head'],
 'dental-pulpitis':['tooth','jaw'], 'dental-caries':['tooth'], 'dental-fracture':['tooth'],
 'gingivitis-periodontitis':['tooth','jaw'], 'tmj-dysfunction':['jaw'],
 'rhinosinusitis':['nose'], 'nasal-trauma-epistaxis':['nose'],
 'vertebral-mechanical-pain':['neck','spine'], 'spinal-radiculopathy':['neck','spine','upper-limb','hand','hip','lower-limb','foot'],
 'rib-wall-injury':['chest'], 'rotator-cuff-irritation':['shoulder'],
 'ulnar-nerve-irritation':['upper-limb','hand'], 'hip-region-pain':['hip'],
 'knee-injury':['knee'], 'ankle-sprain':['ankle'], 'foot-plantar-pain':['foot','ankle'],
 'lower-limb-nerve-symptoms':['hip','lower-limb','ankle','foot'],
 'cranial-nerve-pattern':['head','eye','ear','jaw','throat'], 'spinal-cord-warning':['neck','spine'],
 'abdominal-wall-strain':['abdomen'], 'neck-muscle-tension':['neck'], 'thoracolumbar-myofascial':['spine'],
 'trigeminal-neuralgia':['head','jaw','tooth'], 'carpal-tunnel':['hand','upper-limb'],
 'sciatic-neuralgia':['spine','hip','lower-limb','foot'], 'peripheral-neuropathy':['upper-limb','hand','lower-limb','foot'],
 'facial-nerve-palsy':['head','eye','jaw'],
 'tendon-overuse':['shoulder','upper-limb','hand','hip','knee','ankle','foot'],
 'bursitis-pattern':['shoulder','hip','knee','ankle'], 'knee-meniscus-ligament':['knee'],
 'abdominal-visceral-left':['abdomen'], 'abdominal-visceral-right':['abdomen'],
 'gastroenteritis-pattern':['abdomen'], 'appendicitis-pattern':['abdomen'],
 'renal-colic-pattern':['abdomen','spine','hip'], 'pleuritic-chest-pain':['chest'],
 'eye-surface-irritation':['eye'], 'ear-infection-pattern':['ear'],
 'gout-like-arthritis':['hand','knee','ankle','foot'], 'deep-vein-thrombosis-warning':['lower-limb'],
 'diverticular-left-abdominal':['abdomen'], 'biliary-colic-pattern':['abdomen'],
 'urinary-tract-infection-pattern':['abdomen','spine','pelvis','hip'],
 'reflux-dyspepsia-pattern':['abdomen','chest'],
 'dental-abscess':['tooth','jaw'], 'pharyngitis':['throat'], 'pelvic-pain':['pelvis','abdomen'],
 'bone-injury':['skeleton'], 'autonomic-assessment':['autonomic']
};

const IMPORTANT={
 'dental-pulpitis':['持续冷热痛','自发痛','夜间痛'], 'dental-caries':['冷热敏感','牙龋洞'],
 'dental-fracture':['咬合痛','外伤后'], 'dental-abscess':['牙龈肿胀','面部肿胀','流脓'],
 'gingivitis-periodontitis':['牙龈出血','口腔异味'], 'tmj-dysfunction':['张口受限','关节卡住'],
 'trigeminal-neuralgia':['电击','触碰诱发'], 'carpal-tunnel':['拇食中指麻木','夜间麻木'],
 'ulnar-nerve-irritation':['无名小指麻木'], 'migraine-pattern':['跳痛','畏光','恶心'],
 'abdominal-wall-strain':['运动后','转身牵拉痛'], 'gastroenteritis-pattern':['腹泻','呕吐'],
 'appendicitis-pattern':['腹痛迁移至右下腹','持续加重'],
 'biliary-colic-pattern':['黄疸','油腻餐后痛'], 'diverticular-left-abdominal':['发热','排便改变'],
 'renal-colic-pattern':['血尿','腰腹向腹股沟放射'], 'urinary-tract-infection-pattern':['尿频','尿痛'],
 'reflux-dyspepsia-pattern':['反酸','进食后腹痛'], 'bone-injury':['外伤后','无法承重'],
 'deep-vein-thrombosis-warning':['单侧肿胀'], 'facial-nerve-palsy':['面部歪斜'],
 'spinal-cord-warning':['会阴麻木','排尿困难','肌力下降'], 'pharyngitis':['吞咽痛','发热']
};
const QUADRANTS={
 'appendicitis-pattern':['rlq'], 'biliary-colic-pattern':['ruq','epigastric'],
 'diverticular-left-abdominal':['llq'], 'reflux-dyspepsia-pattern':['epigastric','luq'],
 'renal-colic-pattern':['flank'], 'urinary-tract-infection-pattern':['suprapubic','flank'],
 'pelvic-pain':['suprapubic','llq','rlq']
};
const NEURAL=/nerve|neural|neuropathy|carpal|radiculopathy|spinal-cord/;
const MUSCULAR=/muscle|myofascial|tendon|wall-strain|rotator/;
const SKIN_SIGNS=['皮疹','脱皮','干燥','痒','灼痒','水泡'];

export function assessSymptoms(knowledge,{parts=[],layer='skeleton',feelings=[],signs=[],location='unknown',severity=5}={}){
 const profiles=parts.map(raw=>({...clinicalProfile(raw,layer),raw}));
 const symptoms=new Set([...feelings,...signs].filter(s=>s!=='看不出异常'));
 const has=(...tags)=>tags.some(t=>symptoms.has(t));
 const abdominal=profiles.some(p=>p.region==='abdomen');
 const chest=profiles.some(p=>p.region==='chest');
 const urgent=[];
 const warn=(zh,en)=>urgent.push({zh,en});
 // Triage is independent of ranking and cannot disappear below the top cards.
 if(has('面部歪斜','说话含糊','突然单侧无力'))warn('新出现面部歪斜、说话含糊或单侧无力：立即联系急救，记录起病时间。','New facial droop, slurred speech or one-sided weakness: call emergency services and note onset time.');
 if(chest&&(has('气短','冷汗','晕厥')||has('压迫感')&&severity>=7))warn('胸痛伴气短、冷汗、晕厥或明显压迫：立即急诊，不要用胃药试验排除心脏原因。','Chest pain with breathlessness, cold sweat, fainting or marked pressure needs emergency assessment; an antacid response cannot exclude a cardiac cause.');
 if(abdominal&&(severity>=8||has('突发剧痛','黑便','血便','呕血','腹部僵硬','晕厥')))warn('严重或突发腹痛、出血、腹部僵硬或晕厥：立即急诊。','Severe or sudden abdominal pain, bleeding, rigidity or fainting: seek emergency assessment.');
 if(abdominal&&has('腹痛迁移至右下腹')||abdominal&&location==='rlq'&&has('持续加重','发热'))warn('右下腹迁移痛或持续加重的右下腹痛伴发热：尽快急诊排查阑尾炎等原因。','Migrating or worsening right-lower abdominal pain, especially with fever, needs urgent assessment for appendicitis and other causes.');
 if(has('会阴麻木','排尿困难')&&profiles.some(p=>['spine','hip','lower-limb'].includes(p.region)))warn('腰腿症状伴会阴麻木或新发排尿困难：立即急诊评估。','Back/leg symptoms with saddle numbness or new difficulty passing urine need emergency assessment.');
 if(profiles.some(p=>p.region==='eye')&&has('视物模糊','畏光'))warn('眼痛伴视力变化或畏光：尽快眼科急诊。','Eye pain with vision change or light sensitivity: seek urgent eye assessment.');
 if(has('单侧肿胀')&&profiles.some(p=>p.region==='lower-limb'))warn('单侧腿部新发肿痛需要当日排查血栓；同时气短或胸痛应立即急救。','New one-sided leg swelling needs same-day assessment for a clot; associated breathlessness or chest pain is an emergency.');
 if(abdominal&&has('可能怀孕'))warn('可能怀孕且腹痛：尽快就医确认；单侧剧痛、出血、肩尖痛或晕厥立即急诊。','Possible pregnancy with abdominal pain needs prompt assessment; severe one-sided pain, bleeding, shoulder-tip pain or fainting is an emergency.');
 const items=knowledge.conditions.flatMap(condition=>{
   const regions=CONDITION_REGIONS[condition.id]||[];
   const matching=profiles.filter(p=>p.organ?ORGAN_CONDITIONS[p.organ]?.includes(condition.id):regions.includes(p.region)||regions.includes('skeleton')&&p.tissue==='skeleton'||regions.includes('skin')&&SKIN_SIGNS.some(t=>symptoms.has(t))&& !['tooth','autonomic'].includes(p.region));
   if(!matching.length)return [];
   // Location is user-confirmed; mesh laterality alone cannot tell upper/lower abdomen.
   let locationMismatch=false;
   if(abdominal&&QUADRANTS[condition.id]&&location!=='unknown'&&location!=='diffuse')locationMismatch=!QUADRANTS[condition.id].includes(location);
   if(condition.id==='abdominal-visceral-left'&&['ruq','rlq'].includes(location))return [];
   if(condition.id==='abdominal-visceral-right'&&['luq','llq'].includes(location))return [];
   if(location!=='unknown'&&location!=='diffuse'&&condition.parts.includes('abdomen-left')&&!condition.parts.includes('abdomen-right')&&!['luq','llq'].includes(location))return [];
   if(location!=='unknown'&&location!=='diffuse'&&condition.parts.includes('abdomen-right')&&!condition.parts.includes('abdomen-left')&&!['ruq','rlq','epigastric'].includes(location))return [];
   const important=(IMPORTANT[condition.id]||[]).filter(s=>symptoms.has(s));
   const matched=[...symptoms].filter(s=>condition.feelings.includes(s)||condition.signs.includes(s)||important.includes(s));
   const evidence=[...new Set([...matching.map(p=>p.raw),...matched].filter(Boolean))];
   // A body-part label alone is too weak to justify a disease card. Require
   // one additional reported feature.
   if(evidence.length<2||!matched.length)return [];
   if(regions.includes('skin')&&!SKIN_SIGNS.some(t=>symptoms.has(t)))return [];
   let score=4+matched.length*2+important.length*4;
   if(matching.some(p=>p.tissue==='nerve')&&NEURAL.test(condition.id))score+=2;
   if(matching.some(p=>p.tissue==='muscle')&&MUSCULAR.test(condition.id))score+=2;
   if(QUADRANTS[condition.id]?.includes(location))score+=3;
   if(locationMismatch)score-=5;
   if(condition.id==='muscle-strain'||condition.id.startsWith('abdominal-visceral'))score-=2;
   return [{...condition,score,why:evidence,matchedSymptoms:matched,locationMismatch}];
 }).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 const limitedItems=items.slice(0,6);
 return {profiles,items:limitedItems,urgent,needsSymptoms:!symptoms.size,needsPart:!profiles.length,needsEvidence:profiles.length>0&&!limitedItems.length};
}
