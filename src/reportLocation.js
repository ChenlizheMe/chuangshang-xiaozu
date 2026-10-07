import {clinicalProfile,ABDOMEN_LOCATIONS} from './clinicalRegions.js';

// Reuse the current location choices only where an existing rule needs them.
// A spine or hip click alone never implies that pain is in the flank.
export function reportLocationOptions(report){
 if(!report?.part)return [];
 const {region}=clinicalProfile(report.part,report.layer);
 if(region==='abdomen')return ABDOMEN_LOCATIONS;
 if(region==='pelvis')return ABDOMEN_LOCATIONS.filter(([id])=>['unknown','rlq','llq','suprapubic','diffuse'].includes(id));
 const tags=[...(report.feelings||[]),...(report.signs||[])];
 if(['spine','hip'].includes(region)&&(['flank','diffuse'].includes(report.location)||tags.some(tag=>['侧腰痛','绞痛','腰腹向腹股沟放射','血尿'].includes(tag))))
  return ABDOMEN_LOCATIONS.filter(([id])=>['unknown','flank','diffuse'].includes(id));
 return [];
}

// Anatomy provides a reference area, never a confirmed diseased organ. An
// explicitly selected actual location takes precedence over that reference.
const ORGAN_REFERENCE_LOCATIONS={heart:'unknown',stomach:'epigastric',pancreas:'epigastric',appendix:'rlq',liver:'ruq',biliary:'ruq',spleen:'luq',kidney:'flank',ureter:'flank',bladder:'suprapubic'};
export const referenceLocation=(profile,report)=>report.location&&report.location!=='unknown'?report.location:ORGAN_REFERENCE_LOCATIONS[profile.organ]||'unknown';
