import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
test('published attribution carries the existing modification record and unaltered upstream appendix',()=>{
 const notice=read('public/anatomy/NOTICE');
 assert.ok(notice.includes(read('NOTICE')),'the already documented model changes accompany the distributed assets');
 const marker='\nUnmodified upstream NOTICE\n==========================\n\n';
 const parts=notice.split(marker);assert.equal(parts.length,2);
 const appendix=Buffer.from(parts[1]);
 const blob=createHash('sha1').update(`blob ${appendix.length}\0`).update(appendix).digest('hex');
 assert.equal(blob,'4342888f77e4339864c49762ebce9c2c25fec6d2','upstream NOTICE at the recorded revision remains byte-identical');
 assert.match(parts[0],/No female-atlas files or manifests are included/);
});
test('the nearby licence reference resolves to a shipped file with the original asset terms',()=>{
 const licence=read('public/anatomy/LICENSE');
 assert.match(licence,/https:\/\/creativecommons\.org\/licenses\/by-sa\/4\.0\/legalcode/);
 assert.match(licence,/6f464dfec563352ea4eebd1219f4866a14e7dbf8\/public\/anatomy\/LICENSE/);
 assert.match(licence,/does not replace or change those terms/);
 assert.ok(!fs.readdirSync(new URL('../public/anatomy/',import.meta.url)).some(name=>/_female\.glb$|manifest_female/.test(name)));
 assert.match(read('LICENSE'),/^MIT License/,'the application licence stays separate');
});
