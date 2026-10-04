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

const asset=file=>new URL(`../public/anatomy/${file}`,import.meta.url);
const readJSON=file=>{
 const bytes=fs.readFileSync(asset(file));
 return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
};
const io=new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule()});

test('optimized muscles retain every selectable source structure and reduce loading/rendering cost',()=>{
 const original=readJSON('nervous_male.glb');
 const optimized=readJSON('muscle-optimized.glb');
 const source=original.nodes.filter(n=>n.mesh!==undefined&&isVisibleAnatomyMesh(n.name,'muscle'));
 const result=optimized.nodes.filter(n=>n.mesh!==undefined);
 assert.deepEqual(result.map(n=>n.name).sort(),source.map(n=>n.name).sort());
 assert.equal(result.length,274);
 for(const node of result){
  assert.ok(isVisibleAnatomyMesh(node.name,'muscle'),node.name);
  assert.ok(!/待核验|[a-z]{2}/i.test(safePartLabel(node.name,'muscle').zh),node.name);
 }
 const faces=(document,nodes)=>nodes.reduce((count,node)=>count+document.meshes[node.mesh].primitives.reduce((sum,p)=>sum+document.accessors[p.indices].count/3,0),0);
 const before=faces(original,source),after=faces(optimized,result);
 assert.ok(after<before*.45,`${after} faces compared with ${before}`);
 assert.ok(fs.statSync(asset('muscle-optimized.glb')).size<fs.statSync(asset('nervous_male.glb')).size*.2);
});

test('decimation preserves per-part transforms, bounds and BVH click results',async()=>{
 const original=await io.read(fileURLToPath(asset('nervous_male.glb')));
 const optimized=await io.read(fileURLToPath(asset('muscle-optimized.glb')));
 const sourceNodes=new Map(original.getRoot().listNodes().filter(n=>n.getMesh()&&isVisibleAnatomyMesh(n.getName(),'muscle')).map(n=>[n.getName(),n]));
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
  assert.deepEqual(node.getWorldMatrix(),source.getWorldMatrix(),`${name} moved`);
  const before=bounds(source.getMesh()),after=bounds(node.getMesh());
  const tolerance=before.getSize(new THREE.Vector3()).length()*.012+.00002;
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
