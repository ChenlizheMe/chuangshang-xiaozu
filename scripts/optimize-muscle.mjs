import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {NodeIO} from '@gltf-transform/core';
import {KHRDracoMeshCompression} from '@gltf-transform/extensions';
import {prune,weld,simplifyPrimitive,draco} from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import {MeshoptSimplifier} from 'meshoptimizer';
import {isVisibleAnatomyMesh} from '../src/anatomyModels.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const input=path.join(root,'public/anatomy/nervous_male.glb');
const output=path.join(root,'public/anatomy/muscle-optimized.glb');
const io=new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({
 'draco3d.decoder':await draco3d.createDecoderModule(),
 'draco3d.encoder':await draco3d.createEncoderModule()
});
await MeshoptSimplifier.ready;
const document=await io.read(input);
const countFaces=()=>document.getRoot().listMeshes().reduce((sum,mesh)=>sum+mesh.listPrimitives().reduce((n,p)=>n+(p.getIndices()?.getCount()||0)/3,0),0);
const sourceFaces=countFaces();
// Remove unused tissue offline, rather than decoding and raycasting hidden
// nerves on every client. Retain the transforms and the original part names.
for(const node of document.getRoot().listNodes()){
 if(node.getMesh()&&!isVisibleAnatomyMesh(node.getName(),'muscle'))node.setMesh(null);
}
await document.transform(prune({keepAttributes:true}),weld());
const visibleFaces=countFaces();
const names=document.getRoot().listNodes().filter(n=>n.getMesh()).map(n=>n.getName()).sort();
for(const mesh of document.getRoot().listMeshes()){
 for(const primitive of mesh.listPrimitives()){
  const faces=(primitive.getIndices()?.getCount()||0)/3;
  if(faces<100)continue; // Keep the smallest anatomical structures intact.
  simplifyPrimitive(primitive,{simplifier:MeshoptSimplifier,ratio:Math.max(.3,64/faces),error:.002,lockBorder:true});
 }
}
const reducedFaces=countFaces();
// The same Draco decoder is already shipped with the viewer. No additional
// runtime codec, remote asset or client-side simplification is necessary.
await document.transform(prune({keepAttributes:true}),draco({encodeSpeed:5,decodeSpeed:8,quantizePosition:14,quantizeNormal:10}));
await io.write(output,document);
const roundTrip=await io.read(output);
const resultingNames=roundTrip.getRoot().listNodes().filter(n=>n.getMesh()).map(n=>n.getName()).sort();
if(JSON.stringify(resultingNames)!==JSON.stringify(names))throw new Error('Optimization changed selectable anatomy names.');
const report={source:'nervous_male.glb',output:'muscle-optimized.glb',sourceFaces,visibleFaces,reducedFaces,selectableStructures:names.length,
 sourceBytes:(await fs.stat(input)).size,outputBytes:(await fs.stat(output)).size,
 simplify:{ratio:.3,error:.002,lockBorder:true,minimumFaces:64},
 attribution:'Anatria-3D / Z-Anatomy / BodyParts3D, CC BY-SA 4.0; see NOTICE'};
await fs.writeFile(path.join(root,'public/anatomy/muscle-optimized.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
