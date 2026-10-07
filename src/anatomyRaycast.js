import {Sphere} from 'three';
import {acceleratedRaycast} from 'three-mesh-bvh';

const worldSphere=new Sphere(),orthogonalTolerance=1e-6;
function conservativeSphereTransform(matrix){
 const e=matrix.elements;
 const a=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],b=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],c=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];
 if(!Number.isFinite(a)||!Number.isFinite(b)||!Number.isFinite(c)||a<=0||b<=0||c<=0)return false;
 const ab=e[0]*e[4]+e[1]*e[5]+e[2]*e[6],ac=e[0]*e[8]+e[1]*e[9]+e[2]*e[10],bc=e[4]*e[8]+e[5]*e[9]+e[6]*e[10];
 const t2=orthogonalTolerance*orthogonalTolerance;
 const abLimit=t2*a*b,acLimit=t2*a*c,bcLimit=t2*b*c;
 if(!Number.isFinite(abLimit)||!Number.isFinite(acLimit)||!Number.isFinite(bcLimit)||abLimit<=0||acLimit<=0||bcLimit<=0)return false;
 return ab*ab<=abLimit&&ac*ac<=acLimit&&bc*bc<=bcLimit;
}

// Static anatomy uses rotation/translation/scale. Reject rays outside a
// conservative sphere before paying for matrix inversion and BVH traversal.
// A sheared or deforming mesh keeps the original raycast path instead.
export function anatomyRaycast(raycaster,intersections){
 const geometry=this.geometry;
 if(geometry?.boundsTree&&!this.isSkinnedMesh&&!this.isInstancedMesh&&!geometry.morphAttributes.position?.length&&conservativeSphereTransform(this.matrixWorld)){
  if(!geometry.boundingSphere)geometry.computeBoundingSphere();
  if(geometry.boundingSphere&&Number.isFinite(geometry.boundingSphere.radius)&&geometry.boundingSphere.radius>=0){
   worldSphere.copy(geometry.boundingSphere).applyMatrix4(this.matrixWorld);
   // Cover the allowed near-orthogonal rounding error in the world axes.
   worldSphere.radius*=1+2*orthogonalTolerance;
   if(!raycaster.ray.intersectsSphere(worldSphere))return;
  }
 }
 return acceleratedRaycast.call(this,raycaster,intersections);
}
