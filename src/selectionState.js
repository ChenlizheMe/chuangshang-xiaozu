export const emptySelection={reports:[],focusId:null};
export const reportId=(part,layer)=>`${layer}:${part}`;
export function selectionReducer(state,action){
 if(action.type==='reset')return emptySelection;
 if(action.type==='focus')return state.reports.some(r=>r.id===action.id)?{...state,focusId:action.id}:state;
 if(action.type==='toggle'){
  const id=reportId(action.part,action.layer),existing=state.reports.some(r=>r.id===id);
  if(existing)return emptySelection;
  return {focusId:id,reports:[{id,part:action.part,layer:action.layer,feelings:[],signs:[],timing:[],triggers:[],location:'unknown'}]};
 }
 if(action.type==='update')return {...state,reports:state.reports.map(r=>r.id===action.id?{...r,...action.patch,id:r.id,part:r.part,layer:r.layer}:r)};
 return state;
}
// Selection stores stable anatomy names rather than Three.js objects. Local
// Choosing a different area replaces the report and its symptoms.
export const assessmentReports=state=>state.reports.map(({object,...report})=>report);
