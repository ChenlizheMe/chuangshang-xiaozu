import React from 'react';
import {reportLocationOptions} from './reportLocation.js';
import {visibleSymptoms} from './symptomFilters.js';
export const labelFor=(tag,lang)=>tag?.[lang]||tag?.id||'';
const groupNames={
 zh:{location:'你实际感觉的位置',feelings:'不舒服的感觉',signs:'伴随表现',timing:'时间',triggers:'诱因与缓解因素'},
 en:{location:'WHERE YOU FEEL IT',feelings:'FEELINGS',signs:'ASSOCIATED SIGNS',timing:'TIMING',triggers:'TRIGGERS & RELIEF'}
};
export default function ReportEditor({knowledge,focused,kind,lang,onUpdate}){
 if(!focused)return <p className="evidence-empty">{lang==='zh'?'先点击模型选择一个不舒服的部位。再点一次可取消。':'Click the model to choose an uncomfortable area. Click again to remove.'}</p>;
 const field=kind==='feelings'?'feelings':'signs';
 const names=groupNames[lang];
 const toggle=(field,id)=>{
  const selected=focused[field],tag=knowledge[field].find(t=>t.id===id);
  const others=tag.group?selected.filter(t=>knowledge[field].find(k=>k.id===t)?.group!==tag.group):selected;
  onUpdate({[field]:selected.includes(id)?selected.filter(t=>t!==id):[...others,id]});
 };
 const tagButtons=field=>visibleSymptoms(knowledge,{parts:[focused.part],layer:focused.layer,kind:field}).map(tag=><button type="button" key={tag.id} aria-pressed={focused[field].includes(tag.id)} className={`sheet-sticker ${focused[field].includes(tag.id)?'selected':''}`} onClick={()=>toggle(field,tag.id)}>{labelFor(tag,lang)}</button>);
 const locations=reportLocationOptions(focused);
 return <>
  {kind==='feelings'&&locations.length>0&&<div className="location-control" role="group" aria-label={names.location}><b>{names.location}</b><div className="location-grid">{locations.map(([id,zh,en])=><button type="button" key={id} aria-pressed={focused.location===id} className={`location-chip ${focused.location===id?'selected':''}`} onClick={()=>onUpdate({location:id})}>{lang==='zh'?zh:en}</button>)}</div></div>}
  <div className="sticker-grid" role="group" aria-label={names[field]}>{tagButtons(field)}</div>
  {kind==='feelings'&&<>
   <div className="editor-section" role="group" aria-label={names.timing}><b>{names.timing}</b><div className="sticker-grid">{tagButtons('timing')}</div></div>
   <div className="editor-section" role="group" aria-label={names.triggers}><b>{names.triggers}</b><div className="sticker-grid">{tagButtons('triggers')}</div></div>
  </>}
 </>;
}
