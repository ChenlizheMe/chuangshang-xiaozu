import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createAnatomyAssetManifest} from './anatomy-asset-manifest.mjs';

export function verifyAnatomyAssets(directory=fileURLToPath(new URL('../dist/',import.meta.url))){
 const published=JSON.parse(fs.readFileSync(path.join(directory,'native-assets.json'),'utf8'));
 assert.deepEqual(published,createAnatomyAssetManifest(directory),'Published anatomy versions differ from actual dist bytes');
 assert.deepEqual(published,createAnatomyAssetManifest(),'Published anatomy versions differ from source assets');
 for(const asset of Object.values(published.assets)){
  const bytes=fs.readFileSync(path.join(directory,asset.versionedPath));
  assert.equal(bytes.length,asset.size,'Published versioned anatomy size differs');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,'Published versioned anatomy hash differs');
 }
 return published;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const manifest=verifyAnatomyAssets();
 console.log(`Anatomy asset manifest: ${Object.keys(manifest.assets).length} content versions verified.`);
}
