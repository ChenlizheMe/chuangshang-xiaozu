import {focusConsoleControl} from './consoleViewport.js';
// Panels remain non-modal. Very short viewports show one panel at a time.
export function openPanel(onOpen,openerRef,trigger){
 if(trigger?.tagName==='BUTTON'&&!trigger.closest?.('.sticker-sheet'))openerRef.current=trigger;
 onOpen();
}
export function dismissPanel(onClose,opener,host=opener?.ownerDocument?.defaultView||globalThis.window){
 const document=opener?.ownerDocument||host?.document;
 const focusedBefore=document?.activeElement;
 onClose();
 // React must first remove the covering panel so its trigger becomes visible.
 // A new panel opened before this frame keeps control of focus.
 const restore=()=>{
  if(!opener?.isConnected||opener.closest?.('.viewer')?.querySelector('.sticker-sheet'))return;
  const focusedNow=document?.activeElement;
  if(focusedNow&&focusedNow!==focusedBefore&&focusedNow!==opener&&focusedNow.isConnected&&!['BODY','HTML'].includes(focusedNow.tagName))return;
  if(opener.getClientRects&&!opener.getClientRects().length)return;
  const style=host?.getComputedStyle?.(opener);
  if(style?.visibility==='hidden'||style?.display==='none')return;
  focusConsoleControl(opener,host);
 };
 if(host?.requestAnimationFrame)host.requestAnimationFrame(restore);else setTimeout(restore,0);
}
// Native focus scrolling does not consistently account for the sticky heading.
// Measure the real header, including translated names and provisional notes.
export function bindPanelFocusVisibility(panel,host=window){
 const header=panel?.querySelector?.('.sheet-head');
 if(!header?.getBoundingClientRect||!panel?.addEventListener||!panel.style)return()=>{};
 let active=true,frame=null;
 const request=callback=>host.requestAnimationFrame?host.requestAnimationFrame(callback):setTimeout(callback,0);
 const cancel=id=>host.cancelAnimationFrame?host.cancelAnimationFrame(id):clearTimeout(id);
 const reveal=()=>{
  frame=null;if(!active||!panel.isConnected||!panel.getClientRects().length)return;
  const target=panel.ownerDocument.activeElement;
  if(!target?.getBoundingClientRect||!panel.contains(target)||header.contains(target)||!target.getClientRects().length)return;
  const bounds=panel.getBoundingClientRect(),head=header.getBoundingClientRect(),item=target.getBoundingClientRect();
  const top=Math.max(bounds.top+panel.clientTop,head.bottom)+6;
  const bottom=bounds.top+panel.clientTop+panel.clientHeight-6;
  if(bottom<=top)return;
  if(item.top<top||item.height>bottom-top)panel.scrollTop+=item.top-top;
  else if(item.bottom>bottom)panel.scrollTop+=item.bottom-bottom;
 };
 const schedule=()=>{if(active&&frame===null)frame=request(reveal);};
 const measure=()=>{
  if(!active||!panel.getClientRects().length)return;
  panel.style.setProperty('--sheet-header-height',`${header.getBoundingClientRect().height}px`);
  schedule();
 };
 panel.addEventListener('focusin',schedule);
 const observer=host.ResizeObserver?new host.ResizeObserver(measure):null;
 observer?.observe(header);observer?.observe(panel);
 host.addEventListener('resize',measure);measure();
 return()=>{active=false;panel.removeEventListener('focusin',schedule);host.removeEventListener('resize',measure);observer?.disconnect();if(frame!==null)cancel(frame);panel.style.removeProperty('--sheet-header-height');};
}
export function bindPanelKeyboard(panel,opener,onClose,host=window){
 const releaseVisibility=bindPanelFocusVisibility(panel,host);
 panel?.querySelector('button')?.focus({preventScroll:true});
 const onKey=event=>{
  if(event.key!=='Escape')return;
  event.preventDefault();event.stopPropagation();dismissPanel(onClose,opener,host);
 };
 host.addEventListener('keydown',onKey);
 return()=>{host.removeEventListener('keydown',onKey);releaseVisibility();};
}
