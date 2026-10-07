import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ANATOMY_MODELS,isVisibleAnatomyMesh} from '../../src/anatomyModels.js';
const assets=new Map();
// A recognized anatomical alias is not proof that a user can click that name.
// UI fixtures must exist as visible mesh nodes in both shipped quality levels.
export function assertSelectableStructure(part,layer){
 const model=ANATOMY_MODELS[layer];assert.ok(model,`No active model layer: ${layer}`);
 if(!assets.has(layer))assets.set(layer,[...new Set([model.file,model.mobileFile])].map(file=>{
  const bytes=fs.readFileSync(new URL(`../../public/anatomy/${file}`,import.meta.url));
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  return {file,names:new Set(gltf.nodes.filter(node=>node.mesh!==undefined&&isVisibleAnatomyMesh(node.name,layer)).map(node=>node.name))};
 }));
 for(const {file,names} of assets.get(layer))assert.ok(names.has(part),`${part} must be a visible mesh in ${file}`);
}
