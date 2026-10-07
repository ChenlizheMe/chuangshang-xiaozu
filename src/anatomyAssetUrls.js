// Vite injects the manifest calculated from the same files copied to dist.
// Standalone source-level render probes retain their existing local URLs.
const builtManifest=typeof __ANATOMY_ASSET_MANIFEST__==='undefined'?null:__ANATOMY_ASSET_MANIFEST__;
export function anatomyAssetUrl(resource,manifest=builtManifest){
 if(!manifest)return resource.endsWith('.glb')?`${resource}?v=5`:resource;
 const asset=manifest.assets?.[resource];
 if(manifest.schema!==1||!asset||!/^[a-f0-9]{64}$/.test(asset.sha256)||!Number.isSafeInteger(asset.size)||asset.size<=0)throw new Error('Missing anatomy asset version');
 const extension=resource.slice(resource.lastIndexOf('.')),versionedPath=resource.slice(0,-extension.length)+'.'+asset.sha256+extension;
 const expected=`${versionedPath}?${resource.endsWith('.glb')?'v=5&':''}sha256=${asset.sha256}`;
 if(asset.versionedPath!==versionedPath||asset.url!==expected)throw new Error('Invalid anatomy asset URL');
 return asset.url;
}
