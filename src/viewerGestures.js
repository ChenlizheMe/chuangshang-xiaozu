export const idleViewerGesture=()=>({drag:null,pinch:null,interaction:'idle'});
export function startViewerTouch(touches){
 if(touches.length===2){const [a,b]=touches;return {drag:null,pinch:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),interaction:'press'};}
 if(touches.length===1){const {clientX:x,clientY:y}=touches[0];return {drag:{id:'touch',x,y,startX:x,startY:y,vOrbit:0,vElevation:0,active:false},pinch:null,interaction:'press'};}
 return idleViewerGesture();
}
export function endViewerTouch(touches,drag,cancelled=false){
 if(cancelled)return {...idleViewerGesture(),release:false};
 // After a pinch, the remaining finger starts a fresh drag anchor. It does not
 // inherit the other finger's coordinates or the pinch's zoom momentum.
 if(touches.length)return {...startViewerTouch(touches),release:false};
 return {...idleViewerGesture(),release:true,orbitVelocity:drag?.active?{azimuth:drag.vOrbit,elevation:drag.vElevation}:null};
}
