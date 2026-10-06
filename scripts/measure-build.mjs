import fs from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
const root=process.argv[2]||'dist';
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const paths=[...new Set([...html.matchAll(/(?:src|href)="\.\/(assets\/[^\"]+\.js)"/g)].map(match=>match[1]))];
if(!paths.length)throw new Error('No initial JavaScript assets found; build before measuring.');
const assets=paths.map(file=>{const source=fs.readFileSync(path.join(root,file));return {file,bytes:source.length,gzipBytes:gzipSync(source,{level:9}).length};});
console.log(JSON.stringify({method:'UTF-8 bytes; deterministic gzip level 9; HTML script and modulepreload assets only',assets,initialJsGzipBytes:assets.reduce((sum,asset)=>sum+asset.gzipBytes,0)},null,2));
