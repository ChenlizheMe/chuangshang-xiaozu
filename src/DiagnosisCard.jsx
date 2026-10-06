import React from 'react';

export default function DiagnosisCard({condition,index,lang,copy,displayWhy,partLabel}){
 const text=value=>value?.[lang]||'';
 const summary=text(condition.shortDescription);
 const trigger=text(condition.triggers);
 const threshold=text(condition.threshold);
 return <article className="card compact-card">
  <div className="card-heading"><span className="rank">{condition.priority?'↗':String(index+1).padStart(2,'0')}</span><div><small className="field-label">{condition.priority?(lang==='zh'?'优先评估参考':'PRIORITY REFERENCE'):condition.basic?(lang==='zh'?'基础分析':'BASIC ASSESSMENT'):condition.lifestyle?(lang==='zh'?'生活与负荷':'LIFESTYLE & LOAD'):copy.condition}</small><div className="condition">{text(condition.name)}</div><small className="affected-parts">{condition.partRefs?.map(partLabel).join(' / ')}</small></div></div>
  <div className="card-field evidence-line"><b>{copy.basis}</b><div>{condition.why.map(reason=><span key={reason}>{displayWhy(reason)}</span>)}</div></div>
  <div className="card-field"><b>{copy.symptoms}</b><p>{summary}</p></div>
  <div className="card-field"><b>{copy.triggers}</b><p>{trigger}</p></div>
  <div className="card-field"><b>{copy.advice}</b><p>{text(condition.advice)}</p></div>
  <div className="card-field threshold-field"><b>{copy.threshold}</b><p>{threshold}</p></div>
 </article>;
}
