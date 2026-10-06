import {clinicalProfile,ABDOMEN_LOCATIONS} from './clinicalRegions.js';

// Reuse the current location choices only where an existing rule needs them.
// A spine or hip click alone never implies that pain is in the flank.
export function reportLocationOptions(report){
 if(!report?.part)return [];
 const {region}=clinicalProfile(report.part,report.layer);
 if(region==='abdomen')return ABDOMEN_LOCATIONS;
 if(region==='pelvis')return ABDOMEN_LOCATIONS.filter(([id])=>['unknown','rlq','llq','suprapubic','diffuse'].includes(id));
 const tags=[...(report.feelings||[]),...(report.signs||[])];
 if(['spine','hip'].includes(region)&&tags.some(tag=>['侧腰痛','绞痛','腰腹向腹股沟放射','血尿'].includes(tag)))
  return ABDOMEN_LOCATIONS.filter(([id])=>['unknown','flank','diffuse'].includes(id));
 return [];
}
