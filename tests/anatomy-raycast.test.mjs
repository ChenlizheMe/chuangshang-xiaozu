import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';import {anatomyRaycast} from '../src/anatomyRaycast.js';
const mesh=()=>{const g=new THREE.BoxGeometry(2,2,2);g.boundsTree=new MeshBVH(g,{maxLeafTris:10});return new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));};
const cast=(object,raycaster,method)=>{object.raycast=method;return raycaster.intersectObject(object,false).map(h=>({distance:h.distance,point:h.point.toArray(),face:h.faceIndex}));};
const compare=(object,origin,direction,near=0,far=Infinity)=>{const ray=new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction).normalize(),near,far);ray.firstHitOnly=true;assert.deepEqual(cast(object,ray,anatomyRaycast),cast(object,ray,acceleratedRaycast));};
test('sphere rejection preserves hit details, tangent and inside-origin rays and near/far clipping',()=>{
 const object=mesh();object.updateMatrixWorld(true);
 for(const [origin,direction,near,far] of [[[0,0,5],[0,0,-1]],[[0,0,0],[1,0,0]],[[1,1,5],[0,0,-1]],[[5,5,5],[0,0,-1]],[[0,0,5],[0,0,-1],5,9],[[0,0,5],[0,0,-1],0,3]])compare(object,origin,direction,near,far);
 object.geometry.boundingSphere=null;compare(object,[0,0,5],[0,0,-1]);assert.ok(object.geometry.boundingSphere);
});
test('the world sphere follows translation, rotation, nonuniform scaling and reflection',()=>{
 const object=mesh();
 for(const scale of [[1,2,3],[-2,1,.5],[.01,.01,.01]]){
  object.position.set(3,-2,1);object.rotation.set(.2,.4,.7);object.scale.set(...scale);object.updateMatrixWorld(true);
  compare(object,[3,-2,10],[0,0,-1]);compare(object,[-20,7,10],[0,0,-1]);
 }
 object.position.set(-5,3,0);object.updateMatrixWorld(true);compare(object,[-5,3,10],[0,0,-1]);
});
test('a parent nonuniform scale with child rotation falls back instead of culling a real sheared hit',()=>{
 const object=mesh(),parent=new THREE.Group();parent.scale.set(10,1,1);object.rotation.z=Math.PI/4;parent.add(object);parent.updateMatrixWorld(true);
 const target=new THREE.Vector3(.95,-.95,1).applyMatrix4(object.matrixWorld);const ray=new THREE.Raycaster(new THREE.Vector3(target.x,target.y,10),new THREE.Vector3(0,0,-1));ray.firstHitOnly=true;
 assert.equal(cast(object,ray,acceleratedRaycast).length,1);assert.deepEqual(cast(object,ray,anatomyRaycast),cast(object,ray,acceleratedRaycast));
});
test('empty-space rays avoid BVH traversal and a following hit still reaches it',()=>{
 const object=mesh();object.updateMatrixWorld(true);let calls=0;const original=object.geometry.boundsTree.raycastFirst;object.geometry.boundsTree.raycastFirst=function(...args){calls++;return original.apply(this,args);};
 const ray=new THREE.Raycaster(new THREE.Vector3(10,10,5),new THREE.Vector3(0,0,-1));ray.firstHitOnly=true;
 assert.equal(cast(object,ray,anatomyRaycast).length,0);assert.equal(calls,0);
 ray.ray.origin.set(0,0,5);assert.equal(cast(object,ray,anatomyRaycast).length,1);assert.equal(calls,1);
});
