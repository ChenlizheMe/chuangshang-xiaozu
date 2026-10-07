import {createHash} from 'node:crypto';
import {readFile, mkdir, writeFile, copyFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const target = path.resolve(process.argv[2] || path.join(root, 'android/app/build/generated/bundled-assets'));
if (!target.startsWith(path.join(root, 'android/app/build') + path.sep)) throw Error('Output must be inside android/app/build');
const files = [
 ['anatomy/skeleton-mobile.glb', 'model/gltf-binary'],
 ['anatomy/muscle-mobile.glb', 'model/gltf-binary'],
 ['anatomy/organs-mobile.glb', 'model/gltf-binary'],
 ['draco/draco_decoder.js', 'text/javascript'],
 ['draco/draco_wasm_wrapper.js', 'text/javascript'],
 ['draco/draco_decoder.wasm', 'application/wasm'],
];
await rm(target, {recursive:true, force:true});
await mkdir(target, {recursive:true});
const properties = [], assets = {};
for (const [relative, mime] of files) {
 const source = path.join(root, 'public', relative);
 const bytes = await readFile(source);
 const sha256 = createHash('sha256').update(bytes).digest('hex');
 await mkdir(path.dirname(path.join(target, relative)), {recursive:true});
 await copyFile(source, path.join(target, relative));
 const extension=path.extname(relative);
 const versionedPath=`/${relative.slice(0,-extension.length)}.${sha256}${extension}`;
 const url=versionedPath+`?${extension === '.glb' ? 'v=5&' : ''}sha256=${sha256}`;
 properties.push(`${versionedPath}=${sha256}|${mime}|${bytes.length}|${relative}`);
 assets[`/${relative}`] = {sha256, size:bytes.length, mime, versionedPath, url};
}
for (const name of ['LICENSE','NOTICE']) {
 await copyFile(path.join(root,'public/anatomy',name), path.join(target,'anatomy',name));
}
await mkdir(path.join(target,'licenses'), {recursive:true});
for (const name of ['DRACO-LICENSE.txt','DRACO-NOTICE.txt']) await copyFile(path.join(root,'android/licenses',name),path.join(target,'licenses',name));
await writeFile(path.join(target, 'packaged-assets.properties'), properties.sort().join('\n') + '\n');
await writeFile(path.join(target, 'packaged-assets.json'), JSON.stringify({schema:1,assets},null,2) + '\n');
console.log(`Bundled ${files.length} content-addressed assets, ${Object.values(assets).reduce((sum,item)=>sum+item.size,0)} bytes; no HTML or app JavaScript.`);
