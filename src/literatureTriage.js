import {hasReportedPain,PAIN_TAGS} from './symptomLanguage.js';
import {referenceLocation} from './reportLocation.js';
const has=(report,...tags)=>tags.some(tag=>report.tags.has(tag));
const pain=report=>hasReportedPain(report.tags);
const upperAbdominalPain=report=>[...PAIN_TAGS,'放射痛','局部压痛','突发剧痛','向背部放射'].some(tag=>report.tags.has(tag));
const jointRegions=['shoulder','upper-limb','hand','hip','knee','ankle','foot'];
const musculoskeletalRegions=['neck','spine','chest','abdomen','pelvis','lower-limb',...jointRegions];

// Source scope and independent positive/negative cases are recorded under the
// related review entries in data/evidence-review-2026-10.json. These predicates
// route assessment; they do not create diagnoses or require missing checkboxes.
const rules=[
 {id:'reported-haematemesis',level:'emergency',matches:(p,r)=>has(r,'呕血'),
  zh:'报告呕血时应立即联系医疗机构评估；如仍在出血，或伴晕厥、冷汗、气短、腹痛或黑便，立即急诊。未勾伴随表现不能证明出血已停或情况稳定。',
  en:'Vomiting blood needs immediate medical assessment. Ongoing bleeding, fainting, cold sweat, breathlessness, abdominal pain or black stools needs emergency care. Unreported associated symptoms do not establish that bleeding has stopped or that you are stable.'},
 {id:'upper-left-trauma',level:'same-day',matches:(p,r)=>p.region==='abdomen'&&referenceLocation(p,r)==='luq'&&has(r,'外伤后')&&upperAbdominalPain(r),
  zh:'左上腹/脾区受伤后出现疼痛或压痛：今天尽快到医疗机构评估内脏损伤，不能只按表面挫伤处理；部分问题可延迟出现。',
  en:'Pain or tenderness after injury in the left upper abdominal/splenic area needs same-day assessment for internal injury. Do not assume a surface bruise; some problems can appear later.'},
 {id:'upper-left-trauma-shoulder-warning',level:'emergency',matches:(p,r)=>p.region==='abdomen'&&referenceLocation(p,r)==='luq'&&has(r,'外伤后')&&has(r,'肩尖痛','晕厥','突发剧痛'),
  zh:'左上腹/脾区受伤后伴肩尖痛、晕厥或突发剧痛：立即急诊评估可能的内脏损伤，不等待其他表现。',
  en:'Shoulder-tip pain, fainting or sudden severe pain after injury in the left upper abdominal/splenic area needs emergency assessment for possible internal injury without waiting for other signs.'},
 {id:'renal-colic-fever',level:'emergency',matches:(p,r)=>['abdomen','spine','hip'].includes(p.region)&&has(r,'发热','发冷')&&(has(r,'腰腹向腹股沟放射')||has(r,'绞痛')&&referenceLocation(p,r)==='flank'),
  zh:'侧腰绞痛或腰腹向腹股沟放射，并伴发热/寒战：立即就医评估感染或排尿通路受阻等原因，不需等出现血尿。不能凭选择确诊结石。',
  en:'Flank colic or pain radiating toward the groin with fever or chills needs immediate assessment for infection or urinary obstruction. Do not wait for blood in urine; these selections do not diagnose a stone.'},
 {id:'right-upper-pain-fever',level:'same-day',matches:(p,r)=>p.region==='abdomen'&&referenceLocation(p,r)==='ruq'&&upperAbdominalPain(r)&&has(r,'发热','发冷'),
  zh:'右上腹/肝胆区域疼痛伴发热或寒战：当天尽快就医检查，不需要等油腻餐后发作或出现黄疸才评估。',
  en:'Right upper abdominal/liver-biliary area pain with fever or chills needs same-day assessment. Do not wait for fatty-meal association or jaundice.'},
 {id:'right-upper-pain-fever-jaundice',level:'emergency',matches:(p,r)=>p.region==='abdomen'&&referenceLocation(p,r)==='ruq'&&upperAbdominalPain(r)&&has(r,'发热','发冷')&&has(r,'黄疸'),
  zh:'右上腹疼痛、发热/寒战和黄疸同时出现：立即急诊检查胆道感染或阻塞等原因，不能只按普通胆绞痛观察。',
  en:'Right upper abdominal pain together with fever/chills and jaundice needs emergency assessment for biliary infection or obstruction rather than observation as ordinary biliary colic.'},
 {id:'upper-abdominal-pain-vomiting',level:'same-day',matches:(p,r)=>p.region==='abdomen'&&['epigastric','luq'].includes(referenceLocation(p,r))&&upperAbdominalPain(r)&&has(r,'呕吐')&&has(r,'持续加重','向背部放射'),
  zh:'上腹或左上腹疼痛伴呕吐，且持续加重或向背部放射：当天尽快就医检查；未报告背部放射不能作为继续观察的理由。',
  en:'Upper or left upper abdominal pain with vomiting and worsening or back radiation needs same-day assessment. Lack of reported back radiation is not a reason to keep observing worsening symptoms.'},
 {id:'constipation-alarm-features',level:'same-day',matches:(p,r)=>['abdomen','pelvis'].includes(p.region)&&has(r,'便秘')&&has(r,'发热','发冷','呕吐'),
  zh:'便秘同时伴发热、寒战或呕吐：当天尽快就医检查，先不要仅靠增加纤维或自行观察处理。',
  en:'Constipation with fever, chills or vomiting needs same-day assessment before relying only on extra fibre or observation.'},
 {id:'epigastric-pressure-cold-sweat',level:'same-day',matches:(p,r)=>p.region==='abdomen'&&referenceLocation(p,r)==='epigastric'&&has(r,'压迫感')&&has(r,'冷汗'),
  zh:'上腹压迫感伴冷汗：当天立即联系医疗机构评估，不能仅按胃部问题解释；需考虑包括心脏在内的其他原因。',
  en:'Upper abdominal pressure with cold sweat needs same-day medical assessment. Do not attribute it solely to the stomach; cardiac and other causes need consideration.'},
 {id:'acute-epigastric-pressure-cold-sweat',level:'emergency',matches:(p,r)=>p.region==='abdomen'&&referenceLocation(p,r)==='epigastric'&&has(r,'压迫感')&&has(r,'冷汗')&&has(r,'突然起病','持续数小时','持续1至3天','持续超过3天','持续加重'),
  zh:'突然或持续的上腹压迫感伴冷汗：立即急诊评估。上腹不适也可能是心脏警讯，不能先用胃病解释排除。',
  en:'Sudden or ongoing upper abdominal pressure with cold sweat needs emergency assessment. Upper abdominal discomfort can be a cardiac warning and cannot be excluded by a stomach explanation.'},
 {id:'hot-swollen-joint',level:'same-day',matches:(p,r)=>jointRegions.includes(p.region)&&has(r,'红肿','局部肿胀')&&has(r,'局部发热','流脓'),
  zh:'局部肿胀或发红伴热感或流脓：当天尽快就医评估关节及周围组织，不能仅按痛风或滑囊劳损处理；未报告发烧也不能排除感染。',
  en:'Swelling or redness with local heat or purulent drainage needs same-day assessment of the joint and nearby tissues. Do not assume gout or bursal strain; unreported fever does not rule out infection.'},
 {id:'headache-systemic-progressive',level:'same-day',matches:(p,r)=>p.region==='head'&&pain(r)&&has(r,'发热','发冷','持续加重'),
  zh:'头部疼痛伴发热、寒战或持续加重：当天尽快就医评估，不先按普通紧张或偏头痛自行处理。',
  en:'Head pain with fever, chills or progressive worsening needs same-day assessment before routine tension-type or migraine self-care.'},
 {id:'headache-neurological-change',level:'same-day',matches:(p,r)=>p.region==='head'&&pain(r)&&has(r,'复视','肌力下降'),
  zh:'头部疼痛伴复视或力量下降：当天尽快接受神经系统评估；不能把未核实的神经变化当作普通先兆。',
  en:'Head pain with double vision or reduced strength needs same-day neurological assessment; do not assume an unassessed neurological change is a routine aura.'},
 {id:'sudden-motor-or-head-neurological-change',level:'emergency',matches:(p,r)=>has(r,'突然起病')&&(has(r,'肌力下降')||p.region==='head'&&pain(r)&&has(r,'复视')),
  zh:'突然出现力量下降，或突然头痛伴复视：立即联系急救或急诊评估，记录起病时间；不要按局部神经受压先观察。',
  en:'Sudden loss of strength, or sudden head pain with double vision, needs emergency assessment. Record onset time rather than observing it as local nerve compression.'},
 {id:'neck-back-pain-fever',level:'same-day',matches:(p,r)=>['neck','spine'].includes(p.region)&&pain(r)&&has(r,'发热','发冷'),
  zh:'颈背疼痛伴发热或寒战：当天尽快就医排查感染等原因，不能只用久坐或肌肉负荷解释。',
  en:'Neck or back pain with fever or chills needs same-day assessment for infection and other causes; posture or muscle load alone is not an adequate explanation.'},
 {id:'exercise-muscle-urine-warning',level:'emergency',matches:(p,r)=>musculoskeletalRegions.includes(p.region)&&pain(r)&&has(r,'运动后','新运动后1至3天')&&has(r,'尿色深')&&has(r,'肌力下降','局部肿胀','持续加重'),
  zh:'运动后局部或肢体疼痛伴尿色变深及力量下降、肿胀或加重：立即就医检查，不能只按延迟性酸痛或缺水处理。尿色深本身不能确定病因。',
  en:'Local or limb pain after exercise with darker urine and reduced strength, swelling or worsening need immediate medical assessment. Do not assume delayed soreness or dehydration; dark urine alone does not establish a cause.'},
 {id:'injury-with-functional-loss',level:'same-day',matches:(p,r)=>[...jointRegions,'lower-limb'].includes(p.region)&&has(r,'外伤后','扭伤后')&&has(r,'无法承重','关节卡住'),
  zh:'受伤或扭伤后不能承重或关节卡住：当天尽快接受损伤评估，不强行活动。仅靠这些选择不能判断是否骨折或是否需要拍片。',
  en:'Inability to bear weight or a locked joint after injury or twisting needs same-day injury assessment. Do not force movement. These selections cannot determine whether a fracture or imaging is present or needed.'}
];
export function literatureWarnings(profiles,reports){
 const warnings=[];
 for(let i=0;i<profiles.length;i++)for(const rule of rules)if(rule.matches(profiles[i],reports[i]))warnings.push({id:rule.id,level:rule.level,zh:rule.zh,en:rule.en});
 return warnings;
}

export const LITERATURE_RULE_IDS=rules.map(rule=>rule.id);
