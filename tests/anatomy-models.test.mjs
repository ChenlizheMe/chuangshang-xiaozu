import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {NodeIO} from '@gltf-transform/core';
import {KHRDracoMeshCompression} from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import * as THREE from 'three';
import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';
import {isVisibleAnatomyMesh} from '../src/anatomyModels.js';
import {safePartLabel} from '../src/anatomyLabels.js';
import {ORGAN_GROUPS} from '../src/organAtlas.js';

const asset=file=>new URL(`../public/anatomy/${file}`,import.meta.url);
const readJSON=file=>{
 const bytes=fs.readFileSync(asset(file));
 return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
};
const io=new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule()});
const worldBounds=nodes=>{
 const box=new THREE.Box3(),point=new THREE.Vector3();
 for(const node of nodes)for(const primitive of node.getMesh().listPrimitives()){
  const positions=primitive.getAttribute('POSITION').getArray(),matrix=new THREE.Matrix4().fromArray(node.getWorldMatrix());
  for(let i=0;i<positions.length;i+=3)box.expandByPoint(point.fromArray(positions,i).applyMatrix4(matrix));
 }
 return box;
};

test('organs occupy the corresponding skeletal chest and pelvis frame at both detail levels',async()=>{
 for(const [bonesFile,organsFile] of [['skeletal_male.glb','organs-optimized.glb'],['skeleton-mobile.glb','organs-mobile.glb']]){
  const bones=await io.read(fileURLToPath(asset(bonesFile))),organs=await io.read(fileURLToPath(asset(organsFile)));
  const boneNodes=bones.getRoot().listNodes().filter(n=>n.getMesh()),organNodes=organs.getRoot().listNodes().filter(n=>n.getMesh());
  const organCenter=name=>worldBounds(organNodes.filter(n=>n.getName()===name)).getCenter(new THREE.Vector3());
  const sternum=worldBounds(boneNodes.filter(n=>n.getName()==='Body of sternum'));
  const clavicles=worldBounds(boneNodes.filter(n=>n.getName().startsWith('Clavicle.')));
  const pelvis=worldBounds(boneNodes.filter(n=>n.getName().startsWith('Hip bone.')));
  assert.ok(organCenter('Heart').y>sternum.min.y&&organCenter('Heart').y<sternum.max.y,organsFile+' heart level differs from sternum');
  assert.ok(organCenter('Heart').z<sternum.getCenter(new THREE.Vector3()).z,organsFile+' heart must lie behind sternum');
  for(const name of ['Left lung','Right lung'])assert.ok(organCenter(name).y>sternum.min.y&&organCenter(name).y<clavicles.max.y,organsFile+' '+name+' outside chest level');
  assert.ok(pelvis.containsPoint(organCenter('Urinary bladder')),organsFile+' bladder outside bony pelvis');
  for(const name of ['Kidney.l','Kidney.r','Liver','Stomach'])assert.ok(organCenter(name).y>pelvis.max.y&&organCenter(name).y<sternum.min.y,organsFile+' '+name+' outside upper abdominal level');
 }
});

test('heart and each lung are single selectable meshes in their original anatomical positions',async()=>{
 const sourceNodes=new Map();
 for(const file of ['visceral_male.glb','organ-supplement-source.glb']){
  const source=await io.read(fileURLToPath(asset(file)));
  for(const n of source.getRoot().listNodes().filter(n=>n.getMesh()))sourceNodes.set(n.getName(),n);
 }
 for(const file of ['organs-optimized.glb','organs-mobile.glb']){
  const result=await io.read(fileURLToPath(asset(file))),nodes=result.getRoot().listNodes().filter(n=>n.getMesh());
  for(const [name,members] of Object.entries(ORGAN_GROUPS)){
   const selected=nodes.filter(n=>n.getName()===name);assert.equal(selected.length,1,name);
   assert.equal(selected[0].getMesh().listPrimitives().length,1,name+' must highlight as a whole');
   assert.ok(!nodes.some(n=>members.includes(n.getName())),name+' retains a selectable fragment');
   const before=worldBounds(members.map(n=>sourceNodes.get(n))),after=worldBounds(selected);
   const tolerance=before.getSize(new THREE.Vector3()).length()*.025;
   assert.ok(before.min.distanceTo(after.min)<tolerance&&before.max.distanceTo(after.max)<tolerance,name+' changed anatomical position');
  }
 }
});

test('mobile atlases preserve every selectable structure with substantially lighter geometry',()=>{
 for(const [layer,fullFile,mobileFile] of [['skeleton','skeletal_male.glb','skeleton-mobile.glb'],['muscle','muscle-optimized.glb','muscle-mobile.glb'],['organ','organs-optimized.glb','organs-mobile.glb']]){
  const full=readJSON(fullFile),mobile=readJSON(mobileFile);
  const selectable=json=>json.nodes.filter(n=>n.mesh!==undefined);
  assert.deepEqual(selectable(mobile).map(n=>n.name).sort(),selectable(full).map(n=>n.name).sort());
  const faces=json=>selectable(json).reduce((sum,n)=>sum+json.meshes[n.mesh].primitives.reduce((total,p)=>total+json.accessors[p.indices].count/3,0),0);
  assert.ok(faces(mobile)<faces(full)*.5,`${mobileFile} too many faces`);
  for(const node of selectable(mobile)){
   assert.ok(!/待核验|[a-z]{2}/i.test(safePartLabel(node.name,layer).zh),node.name);
   assert.ok(isVisibleAnatomyMesh(node.name,layer),node.name);
  }
 }
});

test('optimized muscles retain every selectable source structure and reduce loading/rendering cost',()=>{
 const original=readJSON('nervous_male.glb');
 const optimized=readJSON('muscle-optimized.glb');
 const source=original.nodes.filter(n=>n.mesh!==undefined&&isVisibleAnatomyMesh(n.name,'muscle'));
 const result=optimized.nodes.filter(n=>n.mesh!==undefined);
 const names=new Set(result.map(n=>n.name));
 for(const node of source)assert.ok(names.has(node.name),node.name);
 assert.ok(result.length>600);
 for(const term of ['Rectus abdominis muscle','External abdominal oblique muscle','Internal abdominal oblique muscle','Transversus abdominis muscle']){
  assert.ok(result.some(n=>n.name===term+'.l'),term+' left missing');
  assert.ok(result.some(n=>n.name===term+'.r'),term+' right missing');
 }
 for(const node of result){
  assert.ok(isVisibleAnatomyMesh(node.name,'muscle'),node.name);
  assert.ok(!/待核验|[a-z]{2}/i.test(safePartLabel(node.name,'muscle').zh),node.name);
 }
 const faces=(document,nodes)=>nodes.reduce((count,node)=>count+document.meshes[node.mesh].primitives.reduce((sum,p)=>sum+document.accessors[p.indices].count/3,0),0);
 const muscular=readJSON('muscular_male.glb');
 const extra=muscular.nodes.filter(n=>n.mesh!==undefined&&names.has(n.name)&&!source.some(s=>s.name===n.name));
 const before=faces(original,source)+faces(muscular,extra),after=faces(optimized,result);
 assert.ok(after<before*.45,`${after} faces compared with ${before}`);
 assert.ok(fs.statSync(asset('muscle-optimized.glb')).size<(fs.statSync(asset('nervous_male.glb')).size+fs.statSync(asset('muscular_male.glb')).size)*.2);
});

test('decimation preserves per-part transforms, bounds and BVH click results',async()=>{
 const original=await io.read(fileURLToPath(asset('nervous_male.glb')));
 const optimized=await io.read(fileURLToPath(asset('muscle-optimized.glb')));
 const sourceNodes=new Map(original.getRoot().listNodes().filter(n=>n.getMesh()&&isVisibleAnatomyMesh(n.getName(),'muscle')).map(n=>[n.getName(),n]));
 const supplemental=await io.read(fileURLToPath(asset('muscular_male.glb')));
 for(const node of supplemental.getRoot().listNodes().filter(n=>n.getMesh()))if(!sourceNodes.has(node.getName()))sourceNodes.set(node.getName(),node);
 const bounds=mesh=>{
  const box=new THREE.Box3();
  const point=new THREE.Vector3();
  for(const primitive of mesh.listPrimitives()){
   const attribute=primitive.getAttribute('POSITION');
   for(let i=0;i<attribute.getCount();i++)box.expandByPoint(point.fromArray(attribute.getArray(),i*3));
  }
  return box;
 };
 let hits=0;
 for(const node of optimized.getRoot().listNodes().filter(n=>n.getMesh())){
  const name=node.getName(),source=sourceNodes.get(name);
  assert.ok(node.getWorldMatrix().every((value,i)=>Math.abs(value-source.getWorldMatrix()[i])<.00001),`${name} moved`);
  const before=bounds(source.getMesh()),after=bounds(node.getMesh());
  const tolerance=before.getSize(new THREE.Vector3()).length()*.02+.00002;
  assert.ok(before.min.distanceTo(after.min)<tolerance&&before.max.distanceTo(after.max)<tolerance,`${name} silhouette bounds changed`);
  for(const primitive of node.getMesh().listPrimitives()){
   const geometry=new THREE.BufferGeometry();
   geometry.setAttribute('position',new THREE.BufferAttribute(primitive.getAttribute('POSITION').getArray(),3));
   geometry.setIndex(new THREE.BufferAttribute(primitive.getIndices().getArray(),1));
   const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
   geometry.computeBoundingSphere();
   const center=geometry.boundingSphere.center,radius=geometry.boundingSphere.radius;
   geometry.boundsTree=new MeshBVH(geometry);
   for(const direction of [new THREE.Vector3(0,0,-1),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,-1,0)]){
    const ray=new THREE.Raycaster(center.clone().addScaledVector(direction,-radius*2),direction);
    const normal=ray.intersectObject(mesh)[0];
    mesh.raycast=acceleratedRaycast;ray.firstHitOnly=true;
    const accelerated=ray.intersectObject(mesh)[0];
    mesh.raycast=THREE.Mesh.prototype.raycast;
    assert.equal(Boolean(accelerated),Boolean(normal),`${name} BVH changed a click hit`);
    if(normal){hits++;assert.ok(Math.abs(normal.distance-accelerated.distance)<.00001,`${name} BVH changed hit distance`);}
   }
   geometry.dispose();mesh.material.dispose();
  }
 }
 assert.ok(hits>200);
});
