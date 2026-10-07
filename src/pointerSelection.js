// Native pointer bookkeeping is separate from R3F intersection work. R3F 8
// does not forward pointercancel to mesh handlers, and a multi-pointer gesture
// must not become a near-miss click after one finger lifts.
// Native event time measures the gesture, rather than time spent queued before
// handlers run. Use one clock for the whole pair; missing/implausible event time
// falls back to the two processing samples, never a mixture of both clocks.
const sampleTime=(event,processedAt)=>{
 const stamp=(event.nativeEvent??event).timeStamp;
 return {processedAt,eventAt:Number.isFinite(stamp)&&stamp>0&&Number.isFinite(processedAt)&&stamp<=processedAt?stamp:null};
};
const elapsedTime=(down,up)=>{
 if(down.eventAt!==null&&up.eventAt!==null&&up.eventAt>=down.eventAt)return up.eventAt-down.eventAt;
 const elapsed=up.processedAt-down.processedAt;
 return Number.isFinite(elapsed)&&elapsed>=0?elapsed:Infinity;
};
export function createPointerSelection({now=()=>performance.now()}={}){
 const active=new Map();let candidate=null,blocked=false,suppressClick=false;
 const validPoint=e=>Number.isFinite(e.clientX)&&Number.isFinite(e.clientY);
 const distance=(e,p)=>Math.hypot(e.clientX-p.x,e.clientY-p.y);
 const down=e=>{
  if(e.pointerId===undefined||!validPoint(e)||e.button!==undefined&&e.button!==0)return;
  // A fresh native down also recovers a mouse released outside the window.
  if(active.has(e.pointerId)){active.delete(e.pointerId);if(candidate?.id===e.pointerId)candidate=null;}
  if(!active.size){blocked=false;suppressClick=false;}
  active.set(e.pointerId,{x:e.clientX,y:e.clientY,...sampleTime(e,now()),moved:false});
  if(active.size>1||e.isPrimary===false){blocked=true;suppressClick=true;candidate=null;}
 };
 const begin=(e,object)=>{if(!active.has(e.pointerId))down(e);if(blocked||!active.has(e.pointerId)||e.button!==undefined&&e.button!==0)return;if(candidate?.id===e.pointerId)return;candidate={id:e.pointerId,object,...active.get(e.pointerId)};};
 const move=e=>{const pointer=active.get(e.pointerId);if(!pointer||!validPoint(e))return;if(distance(e,pointer)>6){pointer.moved=true;suppressClick=true;if(candidate?.id===e.pointerId)candidate.moved=true;}};
 // Record a native release before click can invoke the near-miss fallback.
 // Keep the candidate alive for the later R3F target listener to consume.
 const release=e=>{
  const pointer=active.get(e.pointerId);if(!pointer)return Infinity;
  if(pointer.elapsed===undefined)pointer.elapsed=elapsedTime(pointer,sampleTime(e,now()));
  if(pointer.elapsed>520)suppressClick=true;
  return pointer.elapsed;
 };
 const end=e=>{
  const elapsed=release(e);let object=null;
  if(candidate?.id===e.pointerId){if(!blocked&&!suppressClick&&!candidate.moved&&validPoint(e)&&elapsed<=520&&distance(e,candidate)<=14)object=candidate.object;candidate=null;}
  active.delete(e.pointerId);if(!active.size)blocked=false;return object;
 };
 const cancel=e=>{active.delete(e.pointerId);candidate=null;suppressClick=true;blocked=active.size>0;};
 const clear=()=>{active.clear();candidate=null;blocked=false;suppressClick=true;};
 const canApproximate=e=>(!e.type||e.type==='click')&&(e.button===undefined||e.button===0)&&active.size<2&&!blocked&&(e.detail===0||!suppressClick);
 return {down,begin,move,release,end,cancel,clear,canApproximate,token:id=>active.get(id),finishOutside:(e,token)=>{if(token&&active.get(e.pointerId)===token)end(e);}};
}
