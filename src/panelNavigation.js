// Panels remain non-modal so the model and the existing action keys are usable.
export function openPanel(onOpen,openerRef,trigger){
 if(trigger?.tagName==='BUTTON'&&!trigger.closest?.('.sticker-sheet'))openerRef.current=trigger;
 onOpen();
}
export function dismissPanel(onClose,opener,host=opener?.ownerDocument?.defaultView||globalThis.window){
 onClose();
 // React must first remove the covering panel so its trigger becomes visible.
 // A new panel opened before this frame keeps control of focus.
 const restore=()=>{
  if(!opener?.isConnected||opener.closest?.('.viewer')?.querySelector('.sticker-sheet'))return;
  if(opener.getClientRects&&!opener.getClientRects().length)return;
  const style=host?.getComputedStyle?.(opener);
  if(style?.visibility==='hidden'||style?.display==='none')return;
  opener.focus?.({preventScroll:true});
 };
 if(host?.requestAnimationFrame)host.requestAnimationFrame(restore);else setTimeout(restore,0);
}
export function bindPanelKeyboard(panel,opener,onClose,host=window){
 panel?.querySelector('button')?.focus({preventScroll:true});
 const onKey=event=>{
  if(event.key!=='Escape')return;
  event.preventDefault();event.stopPropagation();dismissPanel(onClose,opener,host);
 };
 host.addEventListener('keydown',onKey);
 return()=>host.removeEventListener('keydown',onKey);
}
