// A small, deterministic vocabulary for patient language. Similar pain words
// share one evidence family; they never fabricate a disease-specific finding.
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
 timing:['持续加重','突发','反复数月','突然起病'], bleeding:['无故淤青','异常出血'],
 fatigue:['疲劳乏力','白天困倦'], hydration:['喝水少','口渴口干'],
 screen:['长时间看屏幕'], fever:['发热','发冷'],
 localHeat:['局部发热'], toothLesion:['牙龋洞','牙齿裂纹'],
 respiratory:['气短','静息气短'], bowelRelief:['排便后缓解'],
 meal:['进食后加重','进食后腹痛','油腻餐后痛'], radiation:['放射痛','腰腹向腹股沟放射']
};
const groupByTag=Object.fromEntries(Object.entries(families).flatMap(([group,tags])=>tags.map(tag=>[tag,group])));
export const evidenceFamily=tag=>groupByTag[tag]||tag;
export const PAIN_TAGS=new Set(pain);
export const SYSTEMIC_TAGS=new Set(['发热','发冷','疲劳乏力','白天困倦','睡眠不足','失眠','喝水少','口渴口干','尿色深','无故淤青','异常出血','反复感染','体重下降','可能怀孕']);
const vocabulary={
 '持续冷热痛':['冷热刺激后持续痛','冷热刺激停止后仍痛','喝冷水后还疼很久','喝热水后还疼很久','刺激去掉还痛','lingering thermal pain'],
 '刺激去除即缓解':['刺激一停就不痛','冷水离开就不疼','冷刺激后很快缓解','brief sensitivity'],
 '冷热敏感':['冷热敏感','喝冷水疼','喝热水疼','遇冷会痛','遇热会痛','cold sensitivity','hot sensitivity'],
 '自发痛':['自发痛','没碰也痛','不碰也痛','自己就开始疼','spontaneous pain'],
 '夜间痛':['夜里痛','夜间痛','晚上痛','疼醒','痛醒','night pain'],
 '针刺':['针扎','针刺','扎着痛','pin prick'], '刺痛':['刺痛','stinging'],
 '牵拉痛':['牵扯痛','牵扯着痛','牵拉痛','拉扯痛','扯着疼','pulling pain'],
 '酸痛':['酸痛','发酸','sore'], '酸胀':['酸胀','sore and full'],
 '钝痛':['钝痛','dull ache'], '胀痛':['胀痛','胀得疼'],
 '灼烧':['烧灼','灼烧','火辣辣','烧着疼','burning'],
 '电击':['电击','像过电','过电一样','electric shock'],
 '压迫感':['压迫感','压着痛','压得难受','胸口发紧','squeezing','pressure'],
 '紧箍感':['紧箍','像被勒住','band-like'], '跳痛':['跳痛','一跳一跳地疼','throbbing'],
 '麻木':['麻木','发麻','numb'], '麻刺':['麻刺','tingling'],
 '放射痛':['放射痛','沿着腿痛','痛到手臂','radiating pain'],
 '腰腹向腹股沟放射':['腰痛往腹股沟跑','腰腹向腹股沟放射'],
 '绞痛':['绞痛','肚子拧着疼','cramping abdominal pain'],
 '抽筋':['抽筋','肌肉突然缩紧','muscle cramp'],
 '疼痛':['疼痛','腹痛','头痛','牙痛','牙疼','肚子痛','肚子疼','pain'],
 '发热':['发烧','体温升高','发热','fever'], '局部发热':['局部发热','摸起来发烫','warm to touch'],
 '红肿':['红肿','red and swollen'], '局部肿胀':['局部肿胀','肿起来','swelling'],
 '牙龈肿胀':['牙龈肿','gum swelling'], '牙龈出血':['牙龈出血','刷牙出血','bleeding gums'],
 '牙龋洞':['牙龋洞','牙上有洞','蛀牙','cavity'], '牙齿裂纹':['牙齿裂纹','牙裂了','cracked tooth'],
 '咬合痛':['咬合痛','咬东西疼','咬下去疼','pain on biting'],
 '局部压痛':['按压会痛','按着痛','局部压痛','tender to touch'],
 '气短':['气短','喘不过气','shortness of breath'], '静息气短':['坐着也喘','休息也喘','breathless at rest'],
 '呼吸痛':['呼吸痛','深呼吸疼','pain with breathing'], '咳嗽':['咳嗽','cough'],
 '恶心':['恶心','想吐','nausea'], '呕吐':['呕吐','吐了','vomiting'],
 '腹泻':['腹泻','拉肚子','稀便','diarrhea','diarrhoea'], '便秘':['便秘','几天没大便','constipation'],
 '干硬便':['干硬便','大便干硬','hard stools'], '排便费力':['排便费力','大便很费劲','straining to poo'],
 '尿频':['尿频','总想小便','小便次数多','frequent urination'], '尿痛':['尿痛','小便疼','尿尿疼','painful urination'],
 '尿急':['尿急','憋不住尿','urinary urgency'], '血尿':['血尿','尿里有血','blood in urine'],
 '尿色深':['尿色深','尿很黄','dark urine'], '黄疸':['黄疸','眼白发黄','jaundice'],
 '反酸':['反酸','酸水上来','酸水反流','acid reflux'], '早饱':['早饱','吃一点就饱','early satiety'],
 '腹胀':['腹胀','肚子胀','bloating'], '排便后缓解':['排便后缓解','大便后不疼了'],
 '进食后加重':['进食后加重','吃完更疼','worse after eating'], '油腻餐后痛':['油腻餐后痛','吃油腻的会疼'],
 '久坐后':['久坐后','坐久了','sitting for a long time'], '久站后':['久站后','站久了'],
 '运动后':['运动后','锻炼后','after exercise'], '新运动后1至3天':['新运动后1至3天','练完第二天酸痛','练完隔天酸'],
 '反复用力':['反复用力','一直重复用手','repetitive use'], '外伤后':['外伤后','撞到后','摔倒后','after injury'],
 '活动诱发':['活动诱发','动一下就痛','运动时痛','pain with movement'], '转身牵拉痛':['转身牵拉痛','转身会痛'],
 '抬臂加重':['抬臂加重','举手会痛'], '上下楼加重':['上下楼加重','走楼梯疼'], '蹲起加重':['蹲起加重','蹲下站起疼'],
 '睡眠不足':['睡眠不足','没睡够','熬夜','lack of sleep'], '失眠':['失眠','睡不着','insomnia'],
 '疲劳乏力':['疲劳乏力','很疲倦','浑身没劲','疲劳','fatigue'], '白天困倦':['白天困倦','白天很困','daytime sleepiness'],
 '压力大':['压力大','很焦虑','stressed'], '喝水少':['喝水少','没怎么喝水'], '口渴口干':['口渴口干','嘴巴很干','口渴','dry mouth'],
 '长时间看屏幕':['长时间看屏幕','一直看电脑','盯手机很久','screen use'], '眼干':['眼干','眼睛干','dry eyes'],
 '异物感':['异物感','眼睛像进沙子','gritty eyes'], '休息后缓解':['休息后缓解','休息会好','better with rest'],
 '持续加重':['持续加重','越来越痛','worsening'], '反复数月':['反复数月','反复几个月','for months'],
 '无故淤青':['无故淤青','没撞到也淤青','unexplained bruising'], '异常出血':['异常出血','出血止不住','unusual bleeding'],
 '反复感染':['反复感染','经常感染'], '体重下降':['体重下降','无故消瘦','weight loss'],
 '流脓':['流脓','pus'], '鼻塞':['鼻塞','鼻子堵','blocked nose'], '脓性鼻涕':['脓性鼻涕','黄绿鼻涕'],
 '清水鼻涕':['清水鼻涕','流清鼻涕'], '喷嚏':['喷嚏','打喷嚏','sneezing'],
 '痒':['痒','itch'], '皮疹':['皮疹','rash'], '吞咽痛':['吞咽痛','咽口水疼','painful swallowing'],
 '冷汗':['冷汗','cold sweat'], '晕厥':['晕厥','晕倒','fainting'], '呕血':['呕血','吐血','vomiting blood'],
 '黑便':['黑便','黑色柏油样便','black stools'], '血便':['血便','便血','blood in stool'],
 '突发剧痛':['突发剧痛','突然剧痛'], '突发最严重头痛':['突发最严重头痛','突然最严重的头痛','worst headache'],
 '说话含糊':['说话含糊','slurred speech'], '突然单侧无力':['突然单侧无力','一侧突然没力气'],
 '面部歪斜':['面部歪斜','嘴角突然歪','facial droop'], '会阴麻木':['会阴麻木','saddle numbness'],
 '排尿困难':['排尿困难','尿不出来','unable to urinate'], '单侧肿胀':['单侧肿胀','一条腿肿'],
 '视物模糊':['视物模糊','看不清','blurred vision'], '畏光':['畏光','怕光','light sensitivity'],
 '呼吸困难':['呼吸困难','difficulty breathing'], '吞咽困难':['吞咽困难','swallowing difficulty']
};
const extra={
 '向背部放射':['向背部放射','上腹痛到后背'], '沿腿向下':['沿腿向下','沿着腿往下'],
 '腹痛迁移至右下腹':['腹痛迁移至右下腹','先肚脐周围疼后来右下腹疼'],
 '腹部僵硬':['腹部僵硬','肚子硬得像板'], '尿量减少':['尿量减少','小便很少'],
 '短暂发作':['短暂发作','每次几秒','每次几分钟'], '触碰诱发':['触碰诱发','轻碰就痛','刷牙就痛'],
 '夜间麻木':['夜间麻木','夜里手麻'], '闭眼困难':['闭眼困难','一侧眼睛闭不上'],
 '单侧头痛':['单侧头痛','一侧头疼'], '双侧头痛':['双侧头痛','两边头疼'],
 '眼红':['眼红','眼睛红'], '复视':['复视','看东西重影'], '鼻痒':['鼻痒','鼻子痒'],
 '牙齿松动':['牙齿松动','牙松了'],'牙龈退缩':['牙龈退缩'],
 '拇食中指麻木':['拇食中指麻木','拇指食指中指麻'], '无名小指麻木':['无名小指麻木','无名指小指麻'],
 '活动后缓解':['活动后缓解','起来走走会好'],'负重加重':['负重加重','走路更疼'],
 '餐后饱胀':['餐后饱胀','吃完很撑'],'咀嚼加重':['咀嚼加重','嚼东西更疼'],
 '突然起病':['突然起病','突然开始'], '扭伤后':['扭伤后','扭到后']
};
const patterns=Object.entries({...vocabulary,...extra}).flatMap(([id,terms])=>[...new Set([id,...terms])].map(term=>({id,term,lower:term.toLowerCase()}))).sort((a,b)=>b.term.length-a.term.length);
export function interpretText(text=''){
 const lower=String(text).slice(0,300).toLowerCase(),occupied=[],findings=[],denied=new Set();
 for(const {id,term,lower:needle} of patterns){
  let start=lower.indexOf(needle);
  while(start!==-1){
   const end=start+needle.length;
   if(!occupied.some(([a,b])=>start<b&&end>a)){
    const prefix=lower.slice(Math.max(0,start-18),start).split(/[，。；,;.\n]/).pop();
    const negative=/(?:没有|否认|不伴|未见|无|不|no |not |without )[^但却有]{0,8}$/.test(prefix)&&!/^(?:不碰也痛|没碰也痛)/.test(term);
    if(negative)denied.add(id);else findings.push({id,text:lower.slice(start,end),start,end});
    occupied.push([start,end]);
   }
   start=lower.indexOf(needle,end);
  }
 }
 const location=[['rlq',/右下腹/],['llq',/左下腹/],['ruq',/右上腹/],['luq',/左上腹/],['epigastric',/上腹正中/],['suprapubic',/下腹正中/],['flank',/侧腰/]].find(([,pattern])=>pattern.test(lower))?.[0];
 return {findings:[...new Map(findings.map(f=>[f.id,f])).values()],denied:[...denied],location};
}
