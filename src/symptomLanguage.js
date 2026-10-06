// Similar selected pain words share one evidence family.
// They never fabricate a disease-specific finding.
const pain=['疼痛','针刺','钝痛','胀痛','酸痛','灼烧','跳痛','撕裂','电击','抽筋','压迫感','隐痛','刺痛','刀割感','牵拉痛','酸胀','紧绷','紧箍感','酸涩','咬合痛','呼吸痛','绞痛'];
const families={
 pain, sensory:['麻木','麻刺','感觉减退','拇食中指麻木','无名小指麻木','会阴麻木'],
 thermal:['冷热敏感','持续冷热痛'], thermalDuration:['刺激去除即缓解'], spontaneous:['自发痛','夜间痛'],
 swelling:['红肿','局部肿胀','牙龈肿胀','面部肿胀','单侧肿胀'],
 rash:['皮疹','红斑','水泡','脱皮','干燥','结痂','起包'], itch:['痒','灼痒'],
 weakness:['肌力下降','突然单侧无力'], colour:['苍白','发凉','发青','发紫'],
 injury:['外伤后','扭伤后'], exercise:['运动后','新运动后1至3天','反复用力'],
 posture:['久坐后','久站后','活动诱发','转身牵拉痛','抬臂加重','上下楼加重','蹲起加重'],
 sleep:['睡眠不足','失眠'], urinaryFrequency:['尿频','尿急'],
 bowelFrequency:['便秘','排便改变'], stoolForm:['干硬便'], bowelStrain:['排便费力'],
 timing:['持续加重','突发','反复数月','突然起病','刚刚开始','持续数小时','持续1至3天','持续超过3天'], bleeding:['无故淤青','异常出血'],
 fatigue:['疲劳乏力','白天困倦'], hydration:['喝水少','口渴口干'],
 screen:['长时间看屏幕'], fever:['发热','发冷'],
 hearing:['听力下降','突然听力下降'], localHeat:['局部发热'], toothLesion:['牙龋洞','牙齿裂纹'],
 respiratory:['气短','静息气短'], bowelRelief:['排便后缓解'],
 meal:['进食后加重','进食后腹痛','油腻餐后痛'], radiation:['放射痛','沿腿向下','腰腹向腹股沟放射']
};
const groupByTag=Object.fromEntries(Object.entries(families).flatMap(([group,tags])=>tags.map(tag=>[tag,group])));
export const evidenceFamily=tag=>groupByTag[tag]||tag;
export const PAIN_TAGS=new Set(pain);
export const LOCAL_PAIN_TAGS=new Set([...PAIN_TAGS,'放射痛','局部压痛','突发剧痛','新运动后1至3天','转身牵拉痛']);
export const SYSTEMIC_TAGS=new Set(['发热','发冷','疲劳乏力','白天困倦','睡眠不足','失眠','喝水少','口渴口干','尿色深','无故淤青','异常出血','反复感染','体重下降','可能怀孕']);

// These existing labels themselves report pain/discomfort. Recognizing that
// meaning for triage does not make related labels independent disease evidence.
export const REPORTED_PAIN_TAGS=new Set([...LOCAL_PAIN_TAGS,'放射痛','侧腰痛','突发剧痛','单侧头痛','双侧头痛','局部压痛','向背部放射','腰腹向腹股沟放射','腹痛迁移至右下腹','运动诱发胸闷']);
export const hasReportedPain=tags=>[...REPORTED_PAIN_TAGS].some(tag=>tags.has(tag));
