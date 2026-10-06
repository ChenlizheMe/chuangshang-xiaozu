// Disposition is separate from a rule-match score. The labels describe when to
// seek assessment; they are neither diagnostic certainty nor disease severity.
export const PRIORITY_LEVELS={
 emergency:{rank:3,zh:'立即评估',en:'IMMEDIATE ASSESSMENT'},
 'same-day':{rank:2,zh:'当天评估',en:'SAME-DAY ASSESSMENT'},
 prompt:{rank:1,zh:'尽快评估',en:'PROMPT ASSESSMENT'}
};
export function orderPriorityGuidance(warnings){
 const ordered=[...warnings].sort((a,b)=>(PRIORITY_LEVELS[b.level]?.rank||0)-(PRIORITY_LEVELS[a.level]?.rank||0));
 const unique=new Map();for(const warning of ordered)if(!unique.has(warning.zh))unique.set(warning.zh,warning);
 return [...unique.values()];
}
export function applyPriorityGuidance(items,warnings){
 if(!warnings.length)return items;
 const first=warnings[0];
 return items.map(item=>({...item,priority:true,priorityLevel:first.level,
  advice:{zh:first.zh,en:first.en},
  threshold:{zh:'本卡只是参考匹配，不能降低上方就医建议的紧迫性，也不能证明已排除其他原因。',en:'This is a reference match. It cannot reduce the urgency of the guidance above or establish that other causes have been ruled out.'}
 }));
}
