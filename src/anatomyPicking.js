// A mesh can retain visible=true while a Suspense ancestor is hidden, or after
// its cached GLTF root has moved to another canvas. Only the active branch may
// produce a selection, including queued pointer-up and near-miss callbacks.
export function isVisibleInScene(object,scene){
 for(let current=object;current;current=current.parent){
  if(current.visible===false)return false;
  if(current===scene)return true;
 }
 return false;
}
export function isPickableAnatomy(object,root,scene){
 if(!object?.isMesh||!object.userData?.inActiveLayer||!isVisibleInScene(object,scene))return false;
 for(let current=object;current&&current!==scene;current=current.parent)if(current===root)return true;
 return false;
}
