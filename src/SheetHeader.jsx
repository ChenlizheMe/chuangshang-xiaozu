import React from 'react';
import {safePartLabel,anatomyNameNote} from './anatomyLabels.js';

export default function SheetHeader({title,focused,lang,onClose}){
 const label=focused?.part?safePartLabel(focused.part,focused.layer)[lang]:null;
 const note=focused?.part?anatomyNameNote(focused.part,lang):'';
 return <div className="sheet-head">
  <div className="sheet-heading"><b>{title}</b>{label&&<small id="sheet-selected-structure" className="sheet-context">{lang==='zh'?'已选结构':'Selected structure'} · {label}{note&&<span className="anatomy-name-note">{note}</span>}</small>}</div>
  <button type="button" onClick={onClose} aria-label={lang==='zh'?'关闭':'Close'}>×</button>
 </div>;
}
