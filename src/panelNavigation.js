// Panels remain non-modal so the model and the existing action keys are usable.
export function dismissPanel(onClose,opener){
 onClose();
 if(opener?.isConnected)opener.focus?.({preventScroll:true});
}
export function bindPanelKeyboard(panel,opener,onClose,host=window){
 panel?.querySelector('button')?.focus({preventScroll:true});
 const onKey=event=>{
  if(event.key!=='Escape')return;
  event.preventDefault();event.stopPropagation();dismissPanel(onClose,opener);
 };
 host.addEventListener('keydown',onKey);
 return()=>host.removeEventListener('keydown',onKey);
}
