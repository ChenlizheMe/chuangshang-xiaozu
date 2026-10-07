import {useEffect, useMemo, useRef} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import * as THREE from 'three';

// One scene render plus one fullscreen pass. UI stays outside this pipeline so
// scanlines and switching distortion never affect text or hit targets.
const fragmentShader = /* glsl */`
  uniform sampler2D sceneTexture;
  uniform vec2 resolution;
  uniform float time;
  uniform float burst;
  uniform float motion;
  uniform float treatment;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  void main() {
    vec2 uv = vUv;
    float row = floor(vUv.y * resolution.y / 3.0);
    // Smooth horizontal synchronisation drift, instead of frame-stepped tearing.
    float drift = sin(time * 7.0 + row * .17) * .5 + sin(time * 2.1 + row * .047) * .5;
    float band = smoothstep(.35,.9,sin(time * 1.8 + row * .035) * .5 + .5);
    uv.x = clamp(uv.x + drift * band * burst * .018, .001, .999);
    vec2 pixel = 1.0 / resolution;
    vec4 sample0 = texture2D(sceneTexture, uv);
    float split = burst * (.008 + .003 * sin(time * 5.0));
    vec3 phosphor = vec3(
      texture2D(sceneTexture,uv + vec2(split,0.)).r,
      sample0.g,
      texture2D(sceneTexture,uv - vec2(split,0.)).b);
    float mask = max(sample0.a, max(texture2D(sceneTexture,uv + vec2(split,0.)).a,
      texture2D(sceneTexture,uv - vec2(split,0.)).a));
    float halo = exp(-dot((vUv - vec2(.50,.53))*vec2(1.3,1.),
      (vUv - vec2(.50,.53))*vec2(1.3,1.)) * 5.0);
    vec3 background = mix(vec3(.055,.061,.056),vec3(.135,.145,.128),halo);
    // Fine oscilloscope graticule and phosphor scanlines.
    vec2 cell = vUv * resolution / 64.;
    vec2 gridEdge = abs(fract(cell - .5) - .5) / max(fwidth(cell),vec2(.001));
    float grid = 1. - min(min(gridEdge.x,gridEdge.y),1.);
    background += vec3(.017,.026,.025) * grid;
    vec3 color = mix(background,phosphor,mask);
    float scan = .965 + .035 * sin(vUv.y * resolution.y * 3.14159);
    float aperture = .992 + .008 * sin(vUv.x * resolution.x * 1.5708);
    color *= mix(1.,scan * aperture,treatment);
    // A quiet rolling sync line gives the set a television feel without a bright sweep.
    float syncY = fract(time * .055);
    float sync = exp(-pow((vUv.y-syncY)/.006,2.));
    color += vec3(.010,.018,.014) * sync * motion * treatment;
    color += (hash(gl_FragCoord.xy + floor(time*12.0))-.5) * .004 * treatment;
    color += (hash(vec2(row, floor(time*8.0)))-.5) * burst * .025;
    float vignette = 1.-.24*pow(length((vUv-.5)*1.45),2.);
    color *= vignette;
    gl_FragColor = vec4(max(color,vec3(0.)),1.);
    #include <colorspace_fragment>
  }
`;

export default function SignalDisplay({signal, readySignal, enabled=true, idleFps=24}) {
  const {gl,size,viewport,scene,camera,invalidate} = useThree();
  const switchedAt = useRef(-10);
  const reducedMotion = useRef(false);
  const timer = useRef();
  const contextLost = useRef(false);
  const cached = useRef({dirty:true,revision:-1,view:new THREE.Matrix4(),projection:new THREE.Matrix4()});
  const pipeline = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1,1,{depthBuffer:true});
    const material = new THREE.ShaderMaterial({
      uniforms:{sceneTexture:{value:target.texture},resolution:{value:new THREE.Vector2(1,1)},
        time:{value:0},burst:{value:0},motion:{value:1},treatment:{value:1}},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader, depthTest:false,depthWrite:false,toneMapped:false
    });
    const geometry = new THREE.PlaneGeometry(2,2);
    const output = new THREE.Scene();
    output.add(new THREE.Mesh(geometry,material));
    return {target,material,geometry,output,camera:new THREE.Camera()};
  },[]);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {reducedMotion.current=preference.matches;invalidate();};
    update(); preference.addEventListener('change',update);
    return () => preference.removeEventListener('change',update);
  },[invalidate]);
  useEffect(() => {
    const visibility=()=>{clearTimeout(timer.current);if(!document.hidden)invalidate();};
    document.addEventListener('visibilitychange',visibility);
    return()=>{document.removeEventListener('visibilitychange',visibility);clearTimeout(timer.current);};
  },[invalidate]);
  useEffect(() => {switchedAt.current=performance.now()/1000;cached.current.dirty=true;invalidate();},[signal,readySignal,invalidate]);
  useEffect(() => {
    const canvas=gl.domElement;
    contextLost.current=Boolean(gl.getContext?.().isContextLost?.());
    const lost=()=>{contextLost.current=true;cached.current.dirty=true;clearTimeout(timer.current);};
    const restored=()=>{contextLost.current=false;cached.current.dirty=true;invalidate();};
    canvas.addEventListener('webglcontextlost',lost);
    canvas.addEventListener('webglcontextrestored',restored);
    return()=>{canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);clearTimeout(timer.current);};
  },[gl,invalidate]);
  useEffect(() => {
    const ratio=Math.min(viewport.dpr,1.5);
    pipeline.target.setSize(Math.max(1,Math.floor(size.width*ratio)),Math.max(1,Math.floor(size.height*ratio)));
    pipeline.material.uniforms.resolution.value.set(size.width*ratio,size.height*ratio);
    cached.current.dirty=true;invalidate();
  },[viewport.dpr,size,pipeline,invalidate]);
  useEffect(() => () => {
    pipeline.target.dispose(); pipeline.geometry.dispose(); pipeline.material.dispose();
  },[pipeline]);
  useFrame(() => {
    if(contextLost.current){clearTimeout(timer.current);return;}
    const now=performance.now()/1000;
    const uniforms=pipeline.material.uniforms;
    uniforms.time.value=now;
    uniforms.motion.value=reducedMotion.current?0:1;
    uniforms.treatment.value=enabled?1:0;
    uniforms.burst.value=enabled&&!reducedMotion.current?Math.pow(Math.max(0,1-(now-switchedAt.current)/.65),2):0;
    camera.updateMatrixWorld();
    const cache=cached.current,revision=scene.userData.anatomyRevision||0;
    // CRT noise/sync animate over the cached image. Hundreds of anatomical
    // meshes only render when the camera, model, highlight or viewport changes.
    if(cache.dirty||cache.revision!==revision||!cache.view.equals(camera.matrixWorldInverse)||!cache.projection.equals(camera.projectionMatrix)){
      gl.setRenderTarget(pipeline.target);gl.setClearColor(0x000000,0);gl.clear();gl.render(scene,camera);
      cache.dirty=false;cache.revision=revision;cache.view.copy(camera.matrixWorldInverse);cache.projection.copy(camera.projectionMatrix);
    }
    gl.setRenderTarget(null);
    gl.render(pipeline.output,pipeline.camera);
    clearTimeout(timer.current);
    if(!document.hidden&&enabled&&!reducedMotion.current){
      const fps=now-switchedAt.current<.65?60:idleFps;
      timer.current=setTimeout(invalidate,1000/fps);
    }
  },1);
  return null;
}
