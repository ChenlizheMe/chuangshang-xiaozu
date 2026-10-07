import React,{useEffect,useMemo,useRef,useLayoutEffect,Suspense} from 'react';
import {Canvas,useLoader,useThree} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import * as THREE from 'three';
import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createSharedDraco} from './dracoLoader.js';
import SignalDisplay from './SignalDisplay.jsx';
import {decodeName,safePartLabel,anatomyIdentity} from './anatomyLabels.js';
import {ANATOMY_MODELS,isVisibleAnatomyMesh} from './anatomyModels.js';
import {ORGAN_ATLAS} from './organAtlas.js';
import {renderProfile} from './renderProfile.js';
import {isVisibleInScene,isPickableAnatomy} from './anatomyPicking.js';
const quality=renderProfile({mobile:window.matchMedia('(max-width:700px), (pointer:coarse)').matches,memory:navigator.deviceMemory,cores:navigator.hardwareConcurrency,saveData:navigator.connection?.saveData});
const MODEL_URLS=Object.fromEntries(Object.entries(ANATOMY_MODELS).map(([layer,model])=>[layer,`./anatomy/${quality.light?model.mobileFile:model.file}?v=5`]));
const getDracoLoader=createSharedDraco({workerLimit:quality.workers});
const configureGLTF=loader=>loader.setDRACOLoader(getDracoLoader());
useLoader.preload(GLTFLoader,MODEL_URLS.skeleton,configureGLTF);
function semanticPartName(object){let current=object;while(current){const name=decodeName(current.userData?.clinicalName||current.userData?.anatomyName||current.name||'');if(name&&!/^mesh(?:[_-]|$)/i.test(name)&&!/^scene$/i.test(name))return name;current=current.parent}return ''}
const CANONICAL_FRAME={center:[0,0.857,0.005],height:1.7};
const INITIAL_ZOOM=3.8,MIN_ZOOM=1.3;
function CameraRig({orbit,lift,elevation,zoom}){const {camera,invalidate}=useThree(); useEffect(()=>{const radius=(INITIAL_ZOOM*INITIAL_ZOOM)/Math.max(MIN_ZOOM,zoom); const theta=orbit*Math.PI/180; const phi=elevation*Math.PI/180; const horizontalRadius=Math.cos(phi)*radius; camera.position.set(Math.sin(theta)*horizontalRadius,lift+Math.sin(phi)*radius,Math.cos(theta)*horizontalRadius);
 camera.lookAt(0,lift,0); camera.updateProjectionMatrix();invalidate()},[camera,invalidate,orbit,lift,elevation,zoom]); return null}
function Model({layer,onPart,selectedParts,registerApproximatePick}){
  const {camera,gl,scene,invalidate,raycaster:sceneRaycaster}=useThree();
  const markDirty=()=>{scene.userData.anatomyRevision=(scene.userData.anatomyRevision||0)+1;invalidate();};
  const gltf=useLoader(GLTFLoader,MODEL_URLS[layer],configureGLTF);
  // Reuse cached geometry and shared base materials. Only the selected mesh
  // receives a temporary material, keeping memory use low during layer swaps.
  const root=useMemo(()=>{
    gltf.scene.traverse(object=>{
      const node=gltf.parser.associations.get(object)?.nodes;
      const original=node===undefined?null:gltf.parser.json.nodes[node]?.name;
      if(original){
        const clinicalName=decodeName(original);
        const displayName=safePartLabel(clinicalName,layer).zh;
        // Keep the source term only for internal clinical matching. Three.js
        // object names and display metadata must never expose raw atlas text.
        object.userData.clinicalName=clinicalName;
        object.userData.anatomyName=displayName;
        object.name=displayName;
      }
    });
    gltf.scene.traverse(object=>{
      if(!object.isMesh)return;
      object.userData.inActiveLayer=isVisibleAnatomyMesh(semanticPartName(object),layer);
      object.visible=object.userData.inActiveLayer;
      if(object.visible){
        if(!object.geometry.boundsTree)object.geometry.boundsTree=new MeshBVH(object.geometry,{maxLeafTris:10});
        object.raycast=acceleratedRaycast;
      }else object.raycast=()=>{};
    });
    return gltf.scene;
  },[gltf,layer]);
  const pickableMeshes=useMemo(()=>{const meshes=[];root.traverse(object=>{if(object.isMesh&&object.userData.inActiveLayer)meshes.push(object)});return meshes},[root]);
  useEffect(()=>{const previous=sceneRaycaster.firstHitOnly;sceneRaycaster.firstHitOnly=true;return()=>{sceneRaycaster.firstHitOnly=previous}},[sceneRaycaster]);
  const groupRef=useRef();
  const clickRef=useRef(null);
  // All published atlases use the same centered, human-scale frame. Combined
  // with the shared camera, a layer change preserves each anatomical location.
  useLayoutEffect(()=>{
    if(!groupRef.current) return;
    // Do not derive scale from whichever layer happened to load last. The source
    // bounds were measured once and share the same origin; use one fixed frame.
    root.position.set(-CANONICAL_FRAME.center[0],-CANONICAL_FRAME.center[1],-CANONICAL_FRAME.center[2]);
    groupRef.current.scale.setScalar(1);
    groupRef.current.position.set(0,0,0);
    markDirty();return markDirty;
  },[root]);
  const commitSelection=object=>{if(!isPickableAnatomy(object,root,scene))return;onPart({part:meshPart({object}),object});};
  useLayoutEffect(()=>{
    if(!registerApproximatePick)return;
    const pickNearest=(event)=>{
      if(!isVisibleInScene(root,scene))return;
      const rect=gl.domElement.getBoundingClientRect();
      const x=Number(event.clientX);const y=Number(event.clientY);
      if(!Number.isFinite(x)||!Number.isFinite(y)||!rect.width||!rect.height)return;
      const ndc=new THREE.Vector2(((x-rect.left)/rect.width)*2-1,-(((y-rect.top)/rect.height)*2-1));
      const raycaster=new THREE.Raycaster();raycaster.firstHitOnly=true;raycaster.setFromCamera(ndc,camera);
      const rayHit=raycaster.intersectObjects(pickableMeshes.filter(object=>isPickableAnatomy(object,root,scene)),false)[0];
      if(rayHit){commitSelection(rayHit.object);return;}
      let nearest=null;
      root.updateWorldMatrix(true,true);
      root.traverse(object=>{
        if(!object.geometry||!isPickableAnatomy(object,root,scene))return;
        if(!object.geometry.boundingSphere)object.geometry.computeBoundingSphere();
        const sphere=object.geometry.boundingSphere?.clone();if(!sphere)return;
        sphere.applyMatrix4(object.matrixWorld);
        const projected=sphere.center.clone().project(camera);
        const cx=rect.left+(projected.x+1)*rect.width*.5;
        const cy=rect.top+(1-projected.y)*rect.height*.5;
        const distance=Math.hypot(x-cx,y-cy);
        const cameraDistance=camera.position.distanceTo(sphere.center);
        const fov=THREE.MathUtils.degToRad(camera.fov||38);
        const radiusPx=Math.max(8,(sphere.radius/Math.max(.01,cameraDistance))*rect.height/(2*Math.tan(fov/2)));
        const score=distance/(radiusPx+26);
        if(!nearest||score<nearest.score)nearest={object,score};
      });
      if(nearest&&nearest.score<1.15)commitSelection(nearest.object);
    };
    registerApproximatePick.current=pickNearest;
    return()=>{clickRef.current=null;if(registerApproximatePick.current===pickNearest)registerApproximatePick.current=null;};
  },[camera,gl,scene,root,pickableMeshes,registerApproximatePick,onPart]);
  // Prepare shared base materials once per asset, rather than flagging every
  // material for shader updates after each selection.
  useLayoutEffect(()=>{
    const prepared=new Set(),palette=new Map(),restore=[];
    root.traverse(o=>{
      if(o.isLine||o.isLineSegments||o.isPoints){o.visible=false;return}
      if(!o.isMesh)return;
      o.userData.part=semanticPartName(o)||'general';
      o.visible=o.userData.inActiveLayer;
      o.frustumCulled=true;o.castShadow=false;o.receiveShadow=false;
      o.renderOrder=layer==='skeleton'?1:2;
      const color=layer==='organ'?ORGAN_ATLAS[anatomyIdentity(semanticPartName(o)).name.toLowerCase()]?.color:layer==='skeleton'?'#d4c99d':'#c96759';
      if(layer==='organ'){
        const original=o.material;
        const tinted=(Array.isArray(original)?original:[original]).map(material=>{
          const key=`${material.uuid}|${color}`;
          if(!palette.has(key))palette.set(key,material.clone());return palette.get(key);
        });
        restore.push(()=>{o.material=original});o.material=Array.isArray(original)?tinted:tinted[0];
      }
      const materials=Array.isArray(o.material)?o.material:[o.material];
      for(const material of materials){
        if(!material||prepared.has(material))continue;prepared.add(material);
        material.color.set(color);
        if(material.emissive){material.emissive.set('#000000');material.emissiveIntensity=0}
        if('roughness' in material)material.roughness=.72;
        if('metalness' in material)material.metalness=.12;
        material.side=THREE.DoubleSide;material.depthTest=true;material.depthWrite=true;
        material.transparent=false;material.opacity=1;material.alphaTest=0;
        material.blending=THREE.NormalBlending;material.polygonOffset=false;
        if('flatShading' in material)material.flatShading=false;
        material.needsUpdate=true;
      }
    });
    markDirty();return()=>{restore.forEach(fn=>fn());palette.forEach(material=>material.dispose());markDirty();};
  },[root,layer]);
  // Each selected mesh gets a temporary material. Its cleanup restores the
  // original shared material without touching other meshes or their shaders.
  useLayoutEffect(()=>{
    const restore=[];
    for(const object of pickableMeshes.filter(mesh=>(selectedParts||[]).includes(semanticPartName(mesh)))){
      if(!object?.visible||!object.userData.inActiveLayer||!pickableMeshes.includes(object))continue;
      const original=object.material;
      const highlighted=(Array.isArray(original)?original:[original]).map(material=>{
        const clone=material.clone();clone.color.set('#ff6338');
        if(clone.emissive){clone.emissive.set('#ff2e00');clone.emissiveIntensity=.65}return clone;
      });
      const selectionMaterial=Array.isArray(original)?highlighted:highlighted[0];object.material=selectionMaterial;
      restore.push(()=>{if(object.material===selectionMaterial)object.material=original;highlighted.forEach(m=>m.dispose());});
    }
    markDirty();return()=>{restore.forEach(fn=>fn());markDirty();};
  },[root,selectedParts,pickableMeshes]);
  const meshPart=e=>decodeName(e.object?.userData?.part||e.object?.name||'general');
  const onMeshPointerDown=e=>{if(e.button!==0||clickRef.current?.pointerId===e.pointerId)return;const object=e.intersections?.find(hit=>isPickableAnatomy(hit.object,root,scene))?.object;if(!object)return;clickRef.current={pointerId:e.pointerId,part:meshPart({object}),object,x:e.clientX,y:e.clientY,startedAt:performance.now(),moved:false};};
  const onMeshPointerMove=e=>{const candidate=clickRef.current;if(!candidate||candidate.pointerId!==e.pointerId)return;const distance=Math.hypot(e.clientX-candidate.x,e.clientY-candidate.y);if(distance>6)candidate.moved=true;};
  const onMeshPointerUp=e=>{const candidate=clickRef.current;if(!candidate||candidate.pointerId!==e.pointerId){clickRef.current=null;return;}const elapsed=performance.now()-candidate.startedAt;const distance=Math.hypot(e.clientX-candidate.x,e.clientY-candidate.y);if(!candidate.moved&&elapsed<=520&&distance<=14)commitSelection(candidate.object);clickRef.current=null;};
  const onMeshPointerCancel=()=>{clickRef.current=null;};
  return <group ref={groupRef} onPointerDown={onMeshPointerDown} onPointerMove={onMeshPointerMove} onPointerUp={onMeshPointerUp} onPointerCancel={onMeshPointerCancel}><primitive object={root}/></group>;
}
export function clearAnatomyCache(layer){useLoader.clear(GLTFLoader,MODEL_URLS[layer]);}
export default function AnatomyViewer({layer,modelNonce,loading,selectedParts,onPart,approximatePickRef,orbit,lift,elevation,zoom}){
 return <Canvas className="anatomy-canvas" frameloop="demand" onPointerMissed={event=>approximatePickRef.current?.(event)} fallback={<div className="model-error" role="alert"><p>3D preview is unavailable in this browser.</p><button type="button" onClick={()=>window.location.reload()}>RETRY VIEWER</button></div>} camera={{position:[0,0,3.8],fov:38}} gl={{antialias:!quality.light,alpha:false,powerPreference:'high-performance'}} onCreated={({gl})=>{gl.setPixelRatio(Math.min(window.devicePixelRatio||1,quality.maxDpr));gl.outputColorSpace=THREE.SRGBColorSpace;gl.toneMapping=THREE.NoToneMapping;gl.shadowMap.enabled=false;}} dpr={[1,quality.maxDpr]}><color attach="background" args={['#292c29']}/><ambientLight intensity={1.5}/><directionalLight position={[2,3,4]} intensity={2}/><Suspense fallback={<Html center zIndexRange={[4,0]} className="model-loading">{loading}</Html>}><Model layer={layer} onPart={onPart} selectedParts={selectedParts} registerApproximatePick={approximatePickRef}/></Suspense><CameraRig orbit={orbit} lift={lift} elevation={elevation} zoom={zoom}/><SignalDisplay signal={layer} readySignal={modelNonce} idleFps={quality.idleFps}/></Canvas>;
}
