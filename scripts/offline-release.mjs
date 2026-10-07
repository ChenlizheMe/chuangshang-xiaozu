import fs from 'node:fs';
import {createHash} from 'node:crypto';

// The HTML and worker receive one deterministic list, including lazy chunks.
// Model/decoder downloads remain in the independent, on-demand model cache.
export function offlineReleasePlugin(){
 const template=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
 let release;
 return {
  name:'trauma-offline-release',apply:'build',enforce:'post',
  transformIndexHtml:{order:'post',handler(html,context){
   const assets=Object.keys(context.bundle||{}).filter(file=>/^assets\/[^?#]+\.(?:js|mjs|css)$/.test(file)).sort().map(file=>'./'+file);
   if(!assets.length)throw new Error('Offline release requires the built runtime assets');
   const id=createHash('sha256').update(template).update(JSON.stringify(assets)).digest('hex').slice(0,16);
   release={id,assets};
   return [{tag:'script',attrs:{id:'offline-release',type:'application/json'},children:JSON.stringify(release),injectTo:'head'}];
  }},
  generateBundle(){
   if(!release)throw new Error('Offline HTML manifest was not generated');
   const source=template.replace("const RELEASE = {id:'development',assets:[]};",`const RELEASE = ${JSON.stringify(release)};`);
   if(source===template)throw new Error('Offline worker release marker is missing');
   this.emitFile({type:'asset',fileName:'sw.js',source});
  }
 };
}
