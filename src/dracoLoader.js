import {LoadingManager} from 'three';
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader.js';

// GLTFLoader is cached across layer loads. Share its decoder and worker pool too.
// A dedicated manager observes only decoder JS/WASM library loading failures.
// Those occur before workers exist, so a failed initializer can be replaced
// without terminating a healthy decoder or another model's decode operation.
export function createSharedDraco({decoderPath='./draco/',workerLimit=1,makeManager=()=>new LoadingManager(),makeLoader=manager=>new DRACOLoader(manager)}={}){
 let shared=null;
 return()=>{
  if(shared)return shared;
  const manager=makeManager(),decoder=makeLoader(manager);
  decoder.setDecoderPath(decoderPath);decoder.setWorkerLimit(workerLimit);
  manager.onError=()=>{if(shared!==decoder)return;shared=null;decoder.dispose();};
  shared=decoder;return decoder;
 };
}
