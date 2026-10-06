import {PAIN_TAGS} from './symptomLanguage.js';
const has=(report,...tags)=>tags.some(tag=>report.tags.has(tag));
const pain=report=>[...PAIN_TAGS,'放射痛','侧腰痛','突发剧痛','单侧头痛','双侧头痛'].some(tag=>report.tags.has(tag));
const jointRegions=['shoulder','upper-limb','hand','hip','knee','ankle','foot'];
const musculoskeletalRegions=['neck','spine','chest','abdomen','pelvis','lower-limb',...jointRegions];

// Source scope and independent positive/negative cases are recorded under the
// related review entries in data/evidence-review-2026-10.json. These predicates
// route assessment; they do not create diagnoses or require missing checkboxes.
const rules=[
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
