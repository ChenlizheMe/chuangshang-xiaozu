import {clinicalProfile} from './clinicalRegions.js';
import {CONDITION_REGIONS} from './clinicalEngine.js';
import {ORGAN_CONDITIONS} from './organAtlas.js';

// A selector should answer one question at a time. These overrides keep
// unmistakably local observations out of unrelated body regions (for example,
// nasal congestion should not appear when the selected structure is the mouth).
const REGION_OVERRIDES={
  '鼻塞':['nose'], '脓性鼻涕':['nose'], '鼻出血':['nose'],
  '牙龈出血':['tooth','jaw'], '牙龋洞':['tooth'], '牙龈肿胀':['tooth','jaw'],
  '牙龈出血':['tooth','jaw'], '口腔异味':['tooth','jaw','throat'],
  '视物模糊':['eye','head'], '畏光':['eye','head'], '流泪':['eye'],
  '耳鸣':['ear'], '听力下降':['ear'],
  '吞咽痛':['throat','jaw'], '张口受限':['jaw'], '咬合改变':['jaw'],
  '咳嗽':['chest','throat'], '呼吸痛':['chest'], '气短':['chest'],
  '恶心':['abdomen','pelvis','autonomic'], '呕吐':['abdomen','pelvis','autonomic'],
  '腹泻':['abdomen','pelvis','autonomic'], '便秘':['abdomen','pelvis','autonomic'],
  '进食后腹痛':['abdomen'], '排便后缓解':['abdomen','pelvis'],
  '尿频':['abdomen','pelvis','spine','autonomic'], '尿痛':['abdomen','pelvis','spine'],
  '血尿':['abdomen','pelvis','spine'], '黄疸':['abdomen'], '血便':['abdomen','pelvis'],
  '心悸':['chest','head','autonomic'], '眩晕':['head','ear','autonomic'],
  '面部歪斜':['head','jaw'], '单侧肿胀':['lower-limb','upper-limb','face','jaw'],
  '关节不稳':['shoulder','upper-limb','hand','hip','knee','ankle','foot'],
  '关节卡住':['jaw','shoulder','upper-limb','hand','hip','knee','ankle','foot'],
  '无法承重':['hip','knee','ankle','foot','lower-limb'],
  '活动受限':['neck','shoulder','upper-limb','hand','spine','hip','knee','ankle','foot'],
  '肌力下降':['head','neck','spine','upper-limb','hand','hip','lower-limb','foot'],
  '感觉减退':['head','neck','spine','upper-limb','hand','hip','lower-limb','foot'],
  '局部压痛':['head','neck','shoulder','upper-limb','hand','chest','spine','abdomen','pelvis','hip','knee','ankle','foot'],
  '发冷':['chest','abdomen','pelvis','upper-limb','lower-limb','autonomic'],
  '出汗':['chest','abdomen','head','autonomic']
};

const regionForTag=(knowledge,id)=>{
  if(REGION_OVERRIDES[id])return REGION_OVERRIDES[id];
  const regions=new Set();
  for(const condition of knowledge.conditions||[]){
    if(![...(condition.feelings||[]),...(condition.signs||[])].includes(id))continue;
    for(const region of CONDITION_REGIONS[condition.id]||[])regions.add(region);
  }
  return [...regions];
};

export function visibleSymptoms(knowledge,{parts=[],layer='skeleton',kind='feelings'}={}){
  const tags=knowledge[kind]||[];
  const profiles=parts.map(part=>clinicalProfile(part,layer));
  if(profiles.length&&profiles.every(p=>p.organ)){
    const conditions=new Set(profiles.flatMap(p=>ORGAN_CONDITIONS[p.organ]||[]));
    const supported=new Set(knowledge.conditions.filter(c=>conditions.has(c.id)).flatMap(c=>[...c.feelings,...c.signs]));
    return tags.filter(tag=>supported.has(tag.id));
  }
  const selected=new Set(parts.map(part=>clinicalProfile(part,layer).region).filter(region=>region&&region!=='general'));
  if(!selected.size)return tags;
  return tags.filter(tag=>{
    const regions=regionForTag(knowledge,tag.id);
    return !regions.length||regions.some(region=>selected.has(region));
  });
}

export const symptomRegionOverrides=REGION_OVERRIDES;
