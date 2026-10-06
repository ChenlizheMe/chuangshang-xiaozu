import {clinicalProfile} from './clinicalRegions.js';
import {CONDITION_REGIONS} from './clinicalEngine.js';
import {ORGAN_CONDITIONS} from './organAtlas.js';
import {SYSTEMIC_TAGS} from './symptomLanguage.js';
import {CLINICAL_RULES} from './clinicalRules.js';

// A selector should answer one question at a time. These overrides keep
// unmistakably local observations out of unrelated body regions (for example,
// nasal congestion should not appear when the selected structure is the mouth).
const REGION_OVERRIDES={
  '磨牙':['tooth','jaw','head'],
  '咀嚼加重':['tooth','jaw'],'压力大':['tooth','jaw','head','neck'],
  '眼干':['eye'],'异物感':['eye'],'眼红':['eye'],'复视':['eye','head'],
  '冷热敏感':['tooth'],'持续冷热痛':['tooth','jaw'],'刺激去除即缓解':['tooth'],
  '自发痛':['tooth','jaw'],'牙齿裂纹':['tooth'],'牙齿松动':['tooth','jaw'],'牙龈退缩':['tooth','jaw'],
  '腹胀':['abdomen'],'反酸':['abdomen','chest'],'餐后饱胀':['abdomen'],'早饱':['abdomen'],
  '干硬便':['abdomen','pelvis'],'排便费力':['abdomen','pelvis'],'清水鼻涕':['nose'],'喷嚏':['nose'],'鼻痒':['nose'],
  '突发最严重头痛':['head'],'单侧头痛':['head'],'双侧头痛':['head'],
  '拇食中指麻木':['hand','upper-limb'],'无名小指麻木':['hand','upper-limb'],
  '会阴麻木':['neck','spine','hip','pelvis','lower-limb'],'排尿困难':['neck','spine','hip','pelvis','abdomen','lower-limb'],
  '耳道流液':['ear'],'耳屏牵拉痛':['ear'],'突然听力下降':['ear'],
  '牙龈肿胀':['tooth','jaw'],'闭眼困难':['eye','head','jaw'],
  '肩尖痛':['abdomen','shoulder'],'苍白便':['abdomen'],
  '呼吸困难':['chest','throat','jaw','head','tooth'],'静息气短':['chest'],
  '吞咽困难':['head','eye','ear','chest','throat','jaw','tooth','abdomen'],
  '突发剧痛':['chest','abdomen','pelvis'],
  '黑便':['abdomen','pelvis'],'呕血':['abdomen','chest'],'腹部僵硬':['abdomen'],
  '说话含糊':['head','jaw','throat'],'突然单侧无力':['head','neck','spine','upper-limb','hand','hip','lower-limb','foot'],
  '冷汗':['chest','abdomen','head'],'晕厥':['head','chest','abdomen','pelvis'],
  '可能怀孕':['abdomen','pelvis'],
  '鼻塞':['nose'], '脓性鼻涕':['nose'], '鼻出血':['nose'],
  '牙龈出血':['tooth','jaw'], '牙龋洞':['tooth'], '牙龈肿胀':['tooth','jaw'],
  '牙龈出血':['tooth','jaw'], '口腔异味':['tooth','jaw','throat'],
  '视物模糊':['eye','head'], '畏光':['eye','head'], '流泪':['eye'],
  '耳鸣':['ear'], '听力下降':['ear'],
  '吞咽痛':['throat','jaw'], '张口受限':['jaw'], '咬合改变':['jaw'],
  '咳嗽':['chest','throat'], '呼吸痛':['chest'], '气短':['chest'],
  '恶心':['head','abdomen','pelvis','autonomic','chest'], '呕吐':['head','abdomen','pelvis','autonomic','chest'],
  '腹泻':['abdomen','pelvis','autonomic'], '便秘':['abdomen','pelvis','autonomic'],
  '进食后腹痛':['abdomen'], '排便后缓解':['abdomen','pelvis'],
  '尿频':['abdomen','pelvis','spine','hip','autonomic'], '尿痛':['abdomen','pelvis','spine','hip'],
  '血尿':['abdomen','pelvis','spine','hip'], '黄疸':['abdomen'], '血便':['abdomen','pelvis'],
  '心悸':['chest','head','autonomic'], '眩晕':['head','ear','autonomic'],
  '面部歪斜':['head','eye','jaw'], '单侧肿胀':['lower-limb','upper-limb','face','jaw'],
  '关节不稳':['shoulder','upper-limb','hand','hip','knee','ankle','foot'],
  '关节卡住':['jaw','shoulder','upper-limb','hand','hip','knee','ankle','foot'],
  '无法承重':['hip','knee','ankle','foot','lower-limb'],
  '活动受限':['neck','shoulder','upper-limb','hand','spine','hip','knee','ankle','foot'],
  '肌力下降':['head','neck','spine','upper-limb','hand','hip','lower-limb','foot'],
  '感觉减退':['head','neck','spine','upper-limb','hand','hip','lower-limb','foot'],
  '局部压痛':['head','neck','shoulder','upper-limb','hand','chest','spine','abdomen','pelvis','hip','knee','lower-limb','ankle','foot'],
  '发冷':['chest','abdomen','pelvis','upper-limb','lower-limb','autonomic'],
  '出汗':['chest','abdomen','head','autonomic']
};

const indexes=new WeakMap();
const regionForTag=(knowledge,id)=>{
  if(REGION_OVERRIDES[id])return REGION_OVERRIDES[id];
  if(!indexes.has(knowledge)){
    const index=new Map();
    for(const condition of knowledge.conditions||[]){
      const rule=CLINICAL_RULES[condition.id];if(!rule)continue;
      for(const tag of [...rule.required.flat(),...rule.optional,...(rule.exclude||[])]){
        if(!index.has(tag))index.set(tag,new Set());
        for(const region of CONDITION_REGIONS[condition.id]||[])index.get(tag).add(region);
      }
    }
    indexes.set(knowledge,index);
  }
  return [...indexes.get(knowledge).get(id)||[]];
};

export function visibleSymptoms(knowledge,{parts=[],layer='skeleton',kind='feelings'}={}){
  const tags=knowledge[kind]||[];
  const universalTiming=tag=>kind==='timing'&&(tag.group==='duration'||['突然起病','持续加重','短暂发作','反复数月'].includes(tag.id));
  const profiles=parts.map(part=>clinicalProfile(part,layer));
  if(profiles.length&&profiles.every(p=>p.organ)){
    const conditions=new Set(profiles.flatMap(p=>ORGAN_CONDITIONS[p.organ]||[]));
    const supported=new Set(knowledge.conditions.filter(c=>conditions.has(c.id)).flatMap(c=>{const r=CLINICAL_RULES[c.id];return [...r.required.flat(),...r.optional,...(r.exclude||[])];}));
    const urgent={chest:['突发剧痛','晕厥','呼吸困难'],abdomen:['突发剧痛','晕厥','黑便','血便','呕血','腹部僵硬']};
    return tags.filter(tag=>{
      if(universalTiming(tag))return true;
      if(tag.id==='可能怀孕')return profiles.some(p=>p.region==='abdomen');
      return supported.has(tag.id)||SYSTEMIC_TAGS.has(tag.id)||profiles.some(p=>urgent[p.region]?.includes(tag.id));
    });
  }
  const selected=new Set(parts.map(part=>clinicalProfile(part,layer).region).filter(region=>region&&region!=='general'));
  if(!selected.size)return tags;
  return tags.filter(tag=>{
    if(universalTiming(tag))return true;
    if(SYSTEMIC_TAGS.has(tag.id)&&tag.id!=='可能怀孕')return true;
    const regions=regionForTag(knowledge,tag.id);
    return regions.some(region=>selected.has(region));
  });
}

export const symptomRegionOverrides=REGION_OVERRIDES;
