import React,{useMemo} from 'react';
import {safePartLabel} from './anatomyLabels.js';
import {clinicalProfile,ABDOMEN_LOCATIONS} from './clinicalRegions.js';
import {visibleSymptoms} from './symptomFilters.js';
import {interpretText} from './symptomLanguage.js';
export const labelFor=(tag,lang)=>tag?.[lang]||tag?.id||'';
export default function ReportEditor({knowledge,reports,focused,kind,lang,onFocus,onUpdate}){
 const parsed=useMemo(()=>interpretText(focused?.text),[focused?.text]);
 const tags=[...knowledge.feelings,...knowledge.signs,...knowledge.context];
 if(!focused)return <p className="evidence-empty">{lang==='zh'?'先点击模型添加一个或多个不舒服的部位。再点一次可取消。':'Click the model to add one or more uncomfortable areas. Click again to remove.'}</p>;
 const field=kind==='feelings'?'feelings':'signs';
 const toggle=(field,id)=>onUpdate({[field]:focused[field].includes(id)?focused[field].filter(t=>t!==id):[...focused[field],id]});
 const tagButtons=field=>visibleSymptoms(knowledge,{parts:[focused.part],layer:focused.layer,kind:field}).map(tag=><button type="button" key={tag.id} aria-pressed={focused[field].includes(tag.id)} className={`sheet-sticker ${focused[field].includes(tag.id)?'selected':''}`} onClick={()=>toggle(field,tag.id)}>{labelFor(tag,lang)}</button>);
 const profile=clinicalProfile(focused.part,focused.layer);
 const examples={tooth:['牙齿牵扯着痛，喝冷水后还疼很久，没碰也痛。','Pulling tooth pain that lingers after cold water, even without touch.'],jaw:['咬东西时痛，张嘴有弹响，晚上磨牙。','Pain when chewing, clicking on opening, and night grinding.'],abdomen:['右下腹疼，越来越痛，有点想吐，没有拉肚子。','Worsening right-lower abdominal pain with nausea, without diarrhoea.'],eye:['盯手机很久后眼睛干，像进了沙子，没有看不清。','Dry, gritty eyes after screen use, without blurred vision.'],chest:['胸口压着难受，活动时更明显，伴有气短。','Chest pressure, worse with exertion, with breathlessness.'],spine:['坐久了腰酸，起来走走会好，没有腿麻。','Back ache after sitting, better with walking, without leg numbness.']};
 const example=(examples[profile.region]||['什么时候开始？什么动作会加重或减轻？还有什么变化？','When did it start? What makes it better or worse? Any other changes?'])[lang==='zh'?0:1];
 return <>
  <label className="report-target"><span>{lang==='zh'?'症状对应':'SYMPTOMS FOR'}</span><select aria-label={lang==='zh'?'症状对应部位':'Area for these symptoms'} value={focused.id} onChange={e=>onFocus(e.target.value)}>{reports.map(r=><option key={r.id} value={r.id}>{safePartLabel(r.part,r.layer)[lang]}</option>)}</select></label>
  {kind==='feelings'&&profile.region==='abdomen'&&<div className="location-control"><b>{lang==='zh'?'你实际感觉的位置':'WHERE YOU FEEL IT'}</b><div className="location-grid">{ABDOMEN_LOCATIONS.map(([id,zh,en])=><button type="button" key={id} aria-pressed={focused.location===id} className={`location-chip ${focused.location===id?'selected':''}`} onClick={()=>onUpdate({location:id})}>{lang==='zh'?zh:en}</button>)}</div></div>}
  <div className="sticker-grid">{tagButtons(field)}</div>
  {kind==='feelings'&&<>
   <div className="editor-section"><b>{lang==='zh'?'时间与诱因':'TIMING & TRIGGERS'}</b><div className="sticker-grid">{tagButtons('context')}</div></div>
   <label className="narrative-label"><b>{lang==='zh'?'也可以用自己的话补充':'DESCRIBE IT IN YOUR WORDS'}</b><textarea maxLength={300} rows={3} value={focused.text} onChange={e=>onUpdate({text:e.target.value})} placeholder={example}/></label>
   {parsed.findings.length>0&&<div className="recognized"><small>{lang==='zh'?'已识别的描述':'RECOGNIZED'}</small>{parsed.findings.map(f=><span key={f.id}>{labelFor(tags.find(t=>t.id===f.id)||{id:f.id},lang)}</span>)}</div>}
   {parsed.denied.length>0&&<p className="text-hint">{lang==='zh'?'否定描述不会当作阳性症状。':'Negated descriptions do not count as positive findings.'}</p>}
  </>}
 </>;
}
