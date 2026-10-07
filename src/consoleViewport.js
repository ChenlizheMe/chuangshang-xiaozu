// At very short viewport heights the housing scrolls while the action keys
// stay in view. Keep model input separate from that native page scrolling.
export function isScrollingConsole(app){
 return !!app&&app.clientHeight>0&&app.scrollHeight>app.clientHeight+1;
}
export function isConsoleScrollTarget(target){
 return isScrollingConsole(target?.closest?.('.app'))&&!target?.closest?.('.anatomy-canvas');
}
export function bindCanvasWheelBoundary(app){
 if(!app?.addEventListener)return()=>{};
 const preventScroll=event=>{
  if(isScrollingConsole(app)&&event.target?.closest?.('.anatomy-canvas')&&Number.isFinite(event.deltaY)&&event.deltaY!==0)event.preventDefault();
 };
 // React's delegated wheel listener can be passive. This only cancels native
 // scrolling; the existing viewer handler remains the sole zoom calculation.
 app.addEventListener('wheel',preventScroll,{capture:true,passive:false});
 return()=>app.removeEventListener('wheel',preventScroll,true);
}
export function focusConsoleControl(target,host=target?.ownerDocument?.defaultView||globalThis.window){
 target?.focus?.({preventScroll:true});
 const app=target?.closest?.('.app');
 if(!isScrollingConsole(app)||!target?.getBoundingClientRect||!app.getBoundingClientRect)return;
 const dock=app.querySelector?.('.sticker-dock');
 if(dock?.contains?.(target))return;
 const viewport=app.getBoundingClientRect(),item=target.getBoundingClientRect(),style=host?.getComputedStyle?.(app);
 const top=viewport.top+(app.clientTop||0)+Math.max(6,Number.parseFloat(style?.paddingTop)||0);
 let bottom=viewport.top+(app.clientTop||0)+app.clientHeight-Math.max(6,Number.parseFloat(style?.paddingBottom)||0);
 if(dock?.getClientRects?.().length&&host?.getComputedStyle?.(dock)?.visibility!=='hidden')bottom=Math.min(bottom,dock.getBoundingClientRect().top-6);
 if(item.top<top)app.scrollTop+=item.top-top;
 else if(item.bottom>bottom)app.scrollTop+=item.bottom-bottom;
}
