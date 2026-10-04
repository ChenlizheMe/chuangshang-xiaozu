import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Document,NodeIO} from '@gltf-transform/core';
import {KHRDracoMeshCompression} from '@gltf-transform/extensions';
import {prune,weld,simplifyPrimitive,draco,mergeDocuments,unpartition,joinPrimitives,transformPrimitive} from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import {MeshoptSimplifier} from 'meshoptimizer';
import {isVisibleAnatomyMesh} from '../src/anatomyModels.js';
import {anatomyIdentity} from '../src/anatomyLabels.js';
import {ORGAN_GROUPS} from '../src/organAtlas.js';

const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public/anatomy');
const io=new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({
 'draco3d.decoder':await draco3d.createDecoderModule(),'draco3d.encoder':await draco3d.createEncoderModule()
});
await MeshoptSimplifier.ready;
const read=file=>io.read(path.join(dir,file));
const nodes=doc=>doc.getRoot().listNodes().filter(n=>n.getMesh());
const faces=doc=>doc.getRoot().listMeshes().reduce((sum,m)=>sum+m.listPrimitives().reduce((n,p)=>n+(p.getIndices()?.getCount()||0)/3,0),0);
const identity=n=>{const {name,side}=anatomyIdentity(n.getName());return `${name.toLowerCase()}|${side}`;};
async function filter(doc,predicate){
 for(const node of nodes(doc))if(!predicate(node))node.setMesh(null);
 await doc.transform(prune({keepAttributes:true}),weld());return doc;
}
function merge(target,source){
 const map=mergeDocuments(target,source),scene=target.getRoot().listScenes()[0];
 for(const sourceScene of source.getRoot().listScenes()){
  const imported=map.get(sourceScene);
  for(const child of imported.listChildren())scene.addChild(child);
  imported.dispose();
 }
 target.getRoot().setDefaultScene(scene);
}
async function muscles(){
 const doc=await filter(await read('nervous_male.glb'),n=>isVisibleAnatomyMesh(n.getName(),'muscle'));
 const existing=new Set(nodes(doc).map(identity));
 const extra=await read('muscular_male.glb');
 const candidates=new Map();
 // Use one complete surface per named muscle/side. Atlas .o/.e variants are
 // alternate cutaway surfaces, not additional muscles to draw on top of it.
 const priority=n=>/\.[lr]$/.test(n.getName())?0:/\.[eo][lr]$/.test(n.getName())?1:2;
 for(const node of nodes(extra)){
  const key=identity(node);
  if(existing.has(key)||!isVisibleAnatomyMesh(node.getName(),'muscle')||/\bfascia\b/i.test(node.getName()))continue;
  if(!candidates.has(key)||priority(node)<priority(candidates.get(key)))candidates.set(key,node);
 }
 const keep=new Set(candidates.values());await filter(extra,n=>keep.has(n));merge(doc,extra);
 return doc;
}
async function organs(){
 const doc=await filter(await read('visceral_male.glb'),n=>isVisibleAnatomyMesh(n.getName(),'organ'));
 merge(doc,await read('organ-supplement-source.glb'));
 for(const [name,members] of Object.entries(ORGAN_GROUPS)){
  const parts=nodes(doc).filter(n=>members.includes(n.getName()));
  if(parts.length!==members.length)throw new Error(`${name}: missing source components`);
  const primitives=[];
  for(const node of parts){
   for(const primitive of node.getMesh().listPrimitives()){
    transformPrimitive(primitive,node.getWorldMatrix());primitives.push(primitive);
   }
   node.setMesh(null);
  }
  // One indexed mesh, one selection, one highlight, in the original world
  // position. No visual cutaways or heart-chamber/ lung-lobe selection targets.
  const mesh=doc.createMesh(name).addPrimitive(joinPrimitives(primitives));
  doc.getRoot().getDefaultScene().addChild(doc.createNode(name).setMesh(mesh));
 }
 await doc.transform(prune({keepAttributes:true}));return doc;
}
// Optional regeneration of the extracted heart chambers and spleen from the
// upstream checkout. Runtime does not download these large vascular atlases.
if(process.argv[2]){
 const doc=new Document();doc.createScene('Organs');
 for(const file of ['cardiovascular_male.glb','lymphatic_male.glb']){
  const source=await io.read(path.join(process.argv[2],file));
  await filter(source,n=>/^(?:Left|Right) (?:atrium|ventricle)$|^Spleen$/.test(n.getName()));merge(doc,source);
 }
 await doc.transform(unpartition(),draco({quantizePosition:14,quantizeNormal:10}));
 await io.write(path.join(dir,'organ-supplement-source.glb'),doc);
}
const reports=[];
for(const [layer,build,variants] of [
 ['muscle',muscles,[['muscle-optimized.glb',.2,.003],['muscle-mobile.glb',.06,.012]]],
 ['organ',organs,[['organs-optimized.glb',.45,.002],['organs-mobile.glb',.18,.006]]],
 ['skeleton',()=>read('skeletal_male.glb'),[['skeleton-mobile.glb',.1,.008]]]
]){
 for(const [file,ratio,error] of variants){
  const doc=await build();await doc.transform(prune({keepAttributes:true}),weld(),unpartition());
  const sourceFaces=faces(doc),names=nodes(doc).map(n=>n.getName()).sort();
  for(const mesh of doc.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()){
   const count=(primitive.getIndices()?.getCount()||0)/3;
   if(count>=100)simplifyPrimitive(primitive,{simplifier:MeshoptSimplifier,ratio:Math.max(ratio,64/count),error,lockBorder:true});
  }
  await doc.transform(prune({keepAttributes:true}),draco({encodeSpeed:5,decodeSpeed:8,quantizePosition:14,quantizeNormal:10}));
  await io.write(path.join(dir,file),doc);
  const decoded=await read(file);
  if(JSON.stringify(nodes(decoded).map(n=>n.getName()).sort())!==JSON.stringify(names))throw new Error(`${file}: selectable names changed`);
  const report={layer,file,sourceFaces,reducedFaces:faces(doc),selectableStructures:names.length,bytes:(await fs.stat(path.join(dir,file))).size,simplify:{ratio,error,lockBorder:true,minimumFaces:64}};
  reports.push(report);console.log(report);
 }
}
await fs.writeFile(path.join(dir,'optimization-report.json'),JSON.stringify({upstreamCommit:'6f464dfec563352ea4eebd1219f4866a14e7dbf8',attribution:'Anatria-3D / Z-Anatomy / BodyParts3D, CC BY-SA 4.0; see NOTICE',assets:reports},null,2)+'\n');
await fs.writeFile(path.join(dir,'muscle-optimized.json'),JSON.stringify({sources:['nervous_male.glb','muscular_male.glb'],...reports[0],attribution:'Anatria-3D / Z-Anatomy / BodyParts3D, CC BY-SA 4.0; see NOTICE'},null,2)+'\n');
