export const emptySelection={reports:[],focusId:null};
export const reportId=(part,layer)=>`${layer}:${part}`;
export function selectionReducer(state,action){
 if(action.type==='reset')return emptySelection;
 if(action.type==='focus')return state.reports.some(r=>r.id===action.id)?{...state,focusId:action.id}:state;
 if(action.type==='toggle'){
  const id=reportId(action.part,action.layer),existing=state.reports.some(r=>r.id===id);
  if(existing){const reports=state.reports.filter(r=>r.id!==id);return {reports,focusId:state.focusId===id?reports[reports.length-1]?.id||null:state.focusId};}
  return {focusId:id,reports:[...state.reports,{id,part:action.part,layer:action.layer,feelings:[],signs:[],context:[],text:'',location:'unknown'}]};
 }
 if(action.type==='update')return {...state,reports:state.reports.map(r=>r.id===action.id?{...r,...action.patch,id:r.id,part:r.part,layer:r.layer}:r)};
 return state;
}
// Selection stores stable anatomy names rather than Three.js objects. Local
// symptoms belong to one area and remain serializable across layer changes.
export const assessmentReports=state=>state.reports.map(({object,...report})=>report);
