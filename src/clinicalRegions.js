import {anatomyIdentity,safePartLabel} from './anatomyLabels.js';
import {ORGAN_ATLAS} from './organAtlas.js';

// Anatomical identity is independent of the visible layer: the nervous GLB
// contains muscles and sense organs as well as nerves.
const REGIONS=[
 ['eye',/总腱环|上斜肌|上直肌|玻璃体|睫状|视交叉|视束/],
 ['ear',/鼓索/],
 ['nose',/筛骨|大翼软骨/],
 ['throat',/小角软骨|环甲肌/],
 ['jaw',/腭骨|颧骨|颊神经/],
 ['hand',/小多角骨|屈肌总腱鞘|指纤维鞘|指深屈肌|指浅屈肌/],
 ['upper-limb',/伸肌总腱|屈肌总腱|前骨间神经|肌皮神经/],
 ['hip',/髂耻|孖肌|转子/],
 ['shoulder',/斜方肌|结节间腱鞘/],
 ['neck',/头斜肌|头前直肌|头外侧直肌|头后.*直肌|副神经/],
 ['chest',/剑突|锯肌|胸横肌|胸长神经/],
 ['abdomen',/锥状肌|髂腹下神经/],
 ['spine',/前纵韧带|后纵韧带|黄韧带|马尾|中央管|外侧中间质|后外侧束/],
 ['lower-limb',/半膜肌|半腱肌/],
 ['head',/降眉间肌|笑肌|颧.*肌|小叶|绒球|脚间窝|乳头体|延髓|终纹|脉络丛/],
 ['autonomic',/交感|迷走神经/],
 ['tooth',/牙|切齿|尖齿|磨齿|tooth|molar|incisor|canine/i],
 ['eye',/眼|睑|泪|角膜|虹膜|晶状体|巩膜|视网膜|视神经|orbicularis oculi|oculomotor|trochlear nerve|abducens/i],
 ['ear',/耳|蜗|听|鼓膜|鼓室|锤骨|砧骨|镫骨|前庭|cochlea/i],
 ['nose',/鼻|筛窦|额窦|蝶窦|额骨窦|蝶骨窦|嗅|vomer/i],
 ['jaw',/颌|咬肌|翼内肌|翼外肌|颊肌|颞肌|masseter|pterygoid/i],
 ['throat',/咽|喉|舌骨|甲杓|环杓|杓|声带|甲状软骨|环状软骨|舌肌|舌下神经|舌咽神经|吞咽/i],
 ['hand',/手|掌|腕|拇指|示指|小指|中指|无名指|指骨|指伸肌|指屈肌|pollicis|carpi|metacarpal|carpal|scaphoid|lunate bone|triquetrum|trapezi[ou]m|capitate bone|hamate|pisiform/i],
 ['foot',/足|跖|趾|楔骨|骰骨|hallucis|plantar|metatarsal|navicular/i],
 ['ankle',/踝|跟腱|跟骨|距骨|calcaneal|talus|ankle/i],
 ['knee',/膝|髌|腘|半月板|鹅足|patellar|cruciate/i],
 ['abdomen',/腹直肌|腹斜肌|腹外|腹内|腹横|腹肌|腹白线|^白线$|abdomin|linea alba|umbilic/i],
 ['pelvis',/会阴|盆底|肛|尿道|阴部|阴茎|睾|耻骨|坐骨海绵|球海绵|levator ani|coccygeus/i],
 ['hip',/髋|骨盆|臀|腹股沟|髂肌|腰大肌|腰小肌|梨状肌|闭孔|股方肌|髂腰|pelvi|inguinal/i],
 ['shoulder',/肩|锁骨|三角肌|冈上|冈下|圆肌|菱形肌|腋|supraspin|infraspin|deltoid/i],
 ['chest',/胸大肌|胸小肌|胸骨|肋|膈|pectoral|intercostal|diaphragm|serratus anterior/i],
 ['neck',/颈|项|斜角肌|胸锁乳突|头夹肌|头半棘|头长肌|头最长|sternocleido/i],
 ['spine',/椎|髓核|脊|骶|尾骨|背|腰|多裂|棘|竖脊|longissimus|multifidus|vertebra|lumbar|cervical|sacrum|coccyx/i],
 ['upper-limb',/臂|肘|肱|桡|尺|正中神经|臂丛|旋前|旋后|coracobrach|brachii/i],
 ['lower-limb',/股|胫|腓|腿|比目鱼|缝匠|收肌|薄肌|阔筋膜|坐骨神经|隐神经|sciatic/i],
 ['head',/脑|颅|额|枕|颞|顶骨|蝶骨|头皮|表情|面神经|三叉|额肌|皱眉|轮匝|口角|唇|颏|舌神经|丘|核|回|沟|蚓|穹隆|胼胝|穹窿|缰|杏仁|透明隔|壳核|苍白球|海马|橄榄|楔叶|楔前叶|岛叶|连合|脑膜|falx|gyrus|sulc|cereb|cranial|vermis|nucleus|collicul|peduncle|fasciculus/i]
];
const INFO={
 autonomic:['自主神经','Autonomic nervous system','自主神经跨越多个器官。点击神经干不能确定内脏病因，需要先描述实际不适部位和功能变化。','Autonomic nerves serve multiple organs. A nerve-trunk selection cannot identify an organ disease; specify the symptomatic body region.','实际是胸腹痛、心悸、出汗、眩晕还是排便排尿异常？','Is the symptom chest/abdominal pain, palpitations, sweating, dizziness or bowel/urinary change?'],
 tooth:['牙齿','Teeth','区分冷热刺激后短暂敏感、刺激去除后持续痛、自发夜间痛及咬合痛；模型不能看出龋深、牙裂或牙髓状态。','Distinguish brief sensitivity, lingering sensitivity, spontaneous night pain and biting pain. A model cannot assess decay depth or pulp health.','疼痛在冷热刺激后多久消失？有龋洞、牙龈肿包或近期外伤吗？','Does pain linger after cold or heat? Any cavity, gum swelling or recent injury?'],
 eye:['眼及眼周','Eye and orbit','眼轮匝肌是闭眼肌。眼周痛也可能来自眼表、眼压或神经，不能按表层肌肉直接判断。','Orbicularis oculi closes the eyelids. Pain here may instead involve the eye surface, pressure or nerves.','是否眼红、畏光、视力下降、戴隐形眼镜或眼外伤？','Any redness, light sensitivity, reduced vision, contact lenses or injury?'],
 ear:['耳及听觉系统','Ear and hearing','区分外耳触痛、耳内痛、听力变化及眩晕，也要考虑牙齿或颞下颌关节牵涉痛。','Separate outer-ear tenderness, deep ear pain, hearing changes and vertigo; dental or jaw pain can refer here.','是否突然听力下降、耳道分泌物、旋转感或近期游泳？','Sudden hearing loss, discharge, spinning dizziness or recent swimming?'],
 nose:['鼻及鼻窦','Nose and sinuses','结合鼻塞、分泌物、过敏诱因与外伤；不能仅凭面部压痛确定细菌感染。','Consider blockage, discharge, allergy triggers and injury; facial tenderness alone does not establish bacterial infection.','单侧还是双侧？持续多久？是否外伤、出血或眼周肿胀？','One or both sides? How long? Any injury, bleeding or eye swelling?'],
 jaw:['颌面及咀嚼肌','Jaw and chewing muscles','咬肌、翼肌或颞下颌关节问题常与咀嚼和张口有关；牙源性痛也可能扩散到这里。','Chewing and opening symptoms may involve muscles or the TMJ; dental pain can spread here.','张口是否弹响、卡住？是否磨牙、咬合痛或某一颗牙敏感？','Clicking or locking on opening? Grinding, biting pain or one sensitive tooth?'],
 throat:['咽喉及舌骨区','Throat and hyoid','区分吞咽痛、发声相关疼痛与颈部肌肉牵拉；吞咽或呼吸困难优先处理。','Separate painful swallowing, voice-related pain and neck strain; airway or swallowing difficulty takes priority.','有发热、声音改变、流口水或无法吞咽液体吗？','Any fever, voice change, drooling or inability to swallow fluids?'],
 head:['头部及中枢神经','Head and central nervous system','点击脑区不能定位头痛病灶。应按起病方式、持续时间、神经功能和伴随症状判断评估方向。','Clicking a brain structure cannot localize a headache lesion. Onset, duration and neurological symptoms guide evaluation.','是否突发最严重头痛？有视力、说话、面部或肢体功能变化吗？','Sudden worst headache? Any new vision, speech, facial or limb changes?'],
 neck:['颈部','Neck','区分姿势或转头相关肌肉痛与沿手臂放射的神经根痛；发热颈硬和外伤是另一类风险。','Separate movement-related pain from arm-radiating nerve-root symptoms, injury and fever with neck stiffness.','转头是否加重？痛或麻是否延伸到手指？有外伤或发热吗？','Worse on turning? Pain or numbness into fingers? Any injury or fever?'],
 spine:['脊柱与背部','Spine and back','局部活动痛、沿肢体放射痛和伴尿路症状的侧腰痛需要分开；脊髓功能变化不能靠模型诊断。','Separate mechanical pain, limb-radiating pain and flank pain with urinary symptoms. A model cannot assess spinal cord function.','有腿麻无力、发热、夜间痛、排尿变化或会阴麻木吗？','Any leg weakness, fever, night pain, urinary changes or saddle numbness?'],
 chest:['胸壁及胸腔','Chest wall and chest','胸肌或肋骨点位也可能是在描述心肺或食管疼痛。压痛和活动相关性不能独自排除心肺疾病。','A chest muscle or rib selection can describe cardiac, lung or oesophageal pain. Tenderness alone does not rule these out.','是否胸部压迫、气短、冷汗、咳嗽，或疼痛向手臂、背和下颌扩散？','Pressure, breathlessness, sweating, cough or pain spreading to arm, back or jaw?'],
 abdomen:['腹壁及腹腔','Abdominal wall and viscera','腹肌覆盖多个内脏。左/右侧和上/下腹需进一步确认；运动牵拉痛与进食、排便或排尿相关痛分别分析。','Abdominal muscles cover several organs. Confirm the quadrant and distinguish movement, meal, bowel and urinary triggers.','请补充上/下腹、左右侧、起病和疼痛迁移；是否腹泻、呕吐、尿痛或可能怀孕？','Confirm quadrant, onset and migration. Diarrhoea, vomiting, urinary pain or pregnancy possibility?'],
 pelvis:['盆底及会阴','Pelvic floor and perineum','模型性别不代表使用者性别。盆腔、泌尿、生殖及肠道来源都需结合症状核实。','The model sex does not identify the user. Consider pelvic, urinary, reproductive and bowel symptoms.','有排尿、排便、月经、妊娠可能、异常出血或生殖器疼痛吗？','Urinary, bowel or menstrual changes, pregnancy possibility, unusual bleeding or genital pain?'],
 shoulder:['肩部','Shoulder','区分抬臂负荷痛、关节僵硬、外伤及颈部放射痛；伴胸部不适需考虑牵涉痛。','Separate overhead-load pain, stiffness, injury and neck-radiating pain; associated chest symptoms require assessment.','抬臂或侧卧是否疼痛？是否受伤后突然无力？有手麻或胸闷吗？','Pain overhead or lying on that side? Sudden weakness after injury, numbness or chest symptoms?'],
 'upper-limb':['上肢','Upper limb','肌肉或肌腱负荷痛与神经分布性麻木需区分；明确肘、前臂、手腕与哪些手指受累。','Separate load-related muscle/tendon pain from nerve-distribution numbness; identify the elbow, forearm, wrist and affected fingers.','是否反复用力、碰撞、肿胀？麻木具体到哪些手指，握力是否下降？','Repetitive use, impact or swelling? Which fingers are numb, and is grip weaker?'],
 hand:['手及手腕','Hand and wrist','区分关节、肌腱、外伤与神经受压；拇食中指和无名小指分布对鉴别有帮助。','Consider joint, tendon, injury and nerve causes; thumb/index/middle versus ring/little-finger symptoms help distinguish patterns.','夜间是否加重？有手指卡顿、关节红热或受伤后骨点压痛吗？','Worse at night? Finger catching, hot swollen joints or focal bony tenderness after injury?'],
 hip:['髋臀及腹股沟','Hip, buttock and groin','腹股沟痛、髋外侧痛和从腰臀向下放射的痛对应不同方向，也需询问尿路和盆腔症状。','Groin, outer-hip and back-to-leg pain suggest different directions; ask about urinary and pelvic symptoms too.','负重是否加重？能否走路？有腹股沟包块、尿痛或放射到腿的麻痛吗？','Worse with loading? Able to walk? Groin lump, urinary pain or numb pain down the leg?'],
 knee:['膝部','Knee','区分扭伤后不稳或锁住、前膝负荷痛、滑囊局部肿胀与红热关节。','Separate twisting injury with instability/locking, anterior load pain, focal bursitis and a hot swollen joint.','是否扭伤、有响声、卡住或快速肿胀？能否承重？','Twist, pop, locking or rapid swelling? Can you bear weight?'],
 ankle:['踝及跟腱','Ankle and Achilles','扭伤、骨折、跟腱损伤与负荷性腱病需要结合外伤经过、骨点压痛及步行能力。','Sprain, fracture, Achilles injury and tendinopathy require the injury history, tenderness and walking ability.','是否扭伤或突然断裂感？能否走四步或踮脚？','Twist or sudden snap? Can you walk four steps or stand on tiptoe?'],
 foot:['足部','Foot','区分晨起足跟痛、局部骨负荷痛、红热关节及烧灼麻木；糖尿病足伤需特别检查。','Separate first-step heel pain, focal load pain, hot swollen joints and burning numbness; inspect diabetic foot wounds.','痛在足跟、前脚掌还是某个脚趾？有伤口、红热或麻木吗？','Heel, forefoot or a toe? Any wound, heat, redness or numbness?'],
 'lower-limb':['下肢','Lower limb','运动负荷痛、抽筋、沿神经放射痛和单侧小腿肿痛需要分开评估。','Separate exercise-related pain, cramp, nerve-radiating symptoms and one-sided calf swelling.','是否运动后出现、单侧肿胀、近期久坐或手术？有麻木或肌力下降吗？','After exercise, one-sided swelling, recent immobility or surgery? Numbness or weakness?'],
 general:['所选结构','Selected structure','该结构的空间位置尚不能可靠归类。请补充症状并确认具体身体区域，避免用通用病名替代分析。','This structure cannot yet be reliably assigned to a clinical region. Confirm the body area and symptoms before interpretation.','请说明疼痛所在身体区域、起病时间、诱因及伴随症状。','Specify body region, onset, triggers and associated symptoms.']
};
export function clinicalProfile(raw,layer){
 const {name,side}=anatomyIdentity(raw);const label=safePartLabel(raw,layer);
 const text=`${/待核验|人体骨骼|所选结构/.test(label.zh)?'':label.zh} ${name}`;
 const organ=layer==='organ'?ORGAN_ATLAS[name.toLowerCase()]:null;
 const region=organ?.region||REGIONS.find(([,pattern])=>pattern.test(text))?.[0]||'general';
 const tissue=organ?'organ':/神经|脊髓|脑|nerve|tract|nucleus|gyrus|sulc|cereb|fascicul|gangli/i.test(text)?'nerve':/肌|腱|筋膜|muscle|tendon|fascia/i.test(text)?'muscle':/骨|韧带|软骨|椎间盘|关节|bone|ligament|cartilage/i.test(text)?'skeleton':layer;
 const [zh,en,summary,summaryEn,question,questionEn]=INFO[region];
 const sideZh=side?`${side==='left'?'左侧':'右侧'}${zh}`:zh;
 const sideEn=side?`${side==='left'?'Left ':'Right '}${en}`:en;
 return {region,tissue,organ:organ?.organ,side,name,label,title:{zh:sideZh,en:sideEn},summary,summaryEn,question,questionEn};
}
export const ABDOMEN_LOCATIONS=[['unknown','腹部位置待确认','Location uncertain'],['ruq','右上腹','Right upper'],['luq','左上腹','Left upper'],['epigastric','上腹正中','Upper middle'],['rlq','右下腹','Right lower'],['llq','左下腹','Left lower'],['suprapubic','下腹正中','Lower middle'],['flank','侧腰腹','Flank'],['diffuse','弥漫/说不清','Diffuse']];
