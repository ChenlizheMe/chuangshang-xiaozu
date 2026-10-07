import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ANATOMY_MODELS} from '../src/anatomyModels.js';

const publicDirectory=fileURLToPath(new URL('../public/',import.meta.url));
export function createAnatomyAssetManifest(directory=publicDirectory){
 const models=Object.values(ANATOMY_MODELS).flatMap(model=>[model.file,model.mobileFile]).map(file=>`./anatomy/${file}`);
 const decoders=['draco_decoder.js','draco_wasm_wrapper.js','draco_decoder.wasm'].map(file=>`./draco/${file}`);
 const assets={};
 for(const resource of [...models,...decoders].sort()){
  const bytes=fs.readFileSync(path.join(directory,resource));
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const model=resource.endsWith('.glb');
  const extension=path.posix.extname(resource),versionedPath=resource.slice(0,-extension.length)+'.'+sha256+extension;
  assets[resource]={versionedPath,url:`${versionedPath}?${model?'v=5&':''}sha256=${sha256}`,sha256,size:bytes.length,
   contentType:model?'model/gltf-binary':resource.endsWith('.wasm')?'application/wasm':'application/javascript'};
 }
 return {schema:1,assets};
}
export function anatomyAssetManifestPlugin(manifest,directory=publicDirectory){
 return {name:'trauma-anatomy-assets',apply:'build',generateBundle(){
  for(const [resource,asset] of Object.entries(manifest.assets)){
   const bytes=fs.readFileSync(path.join(directory,resource));
   if(bytes.length!==asset.size||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw new Error('Anatomy asset changed during build');
   this.emitFile({type:'asset',fileName:asset.versionedPath.slice(2),source:bytes});
  }
  this.emitFile({type:'asset',fileName:'native-assets.json',source:JSON.stringify(manifest,null,2)+'\n'});
 }};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 process.stdout.write(JSON.stringify(createAnatomyAssetManifest(),null,2)+'\n');
}
