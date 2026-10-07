import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function readDirectory(bytes){
 for(let offset=bytes.length-22;offset>=Math.max(0,bytes.length-65557);offset--){
  if(bytes.readUInt32LE(offset)!==0x06054b50)continue;
  if(offset+22+bytes.readUInt16LE(offset+20)!==bytes.length)continue;
  assert.equal(bytes.readUInt16LE(offset+4),0);assert.equal(bytes.readUInt16LE(offset+6),0);
  assert.equal(bytes.readUInt16LE(offset+8),bytes.readUInt16LE(offset+10));
  const directory=bytes.readUInt32LE(offset+16),size=bytes.readUInt32LE(offset+12);
  assert.equal(directory+size,offset,'Unexpected ZIP directory layout');
  return {offset,directory};
 }
 throw Error('ZIP end record not found');
}
export function reconstructSignedApk(unsigned,descriptor){
 assert.equal(descriptor.schema,1);
 const base=descriptor.unsigned,signed=descriptor.signed,patch=descriptor.publicSignature;
 assert.equal(unsigned.length,base.size);assert.equal(digest(unsigned),base.sha256,'Wrong unsigned APK');
 assert.match(signed.file,/^trauma-team-\d+\.\d+\.\d+\.apk$/);assert.match(signed.certificateSha256,/^[a-f0-9]{64}$/);
 const location=readDirectory(unsigned);
 assert.equal(location.directory,base.centralDirectoryOffset);assert.equal(location.offset,base.eocdOffset);
 const insertion=Buffer.from(patch.insertionBase64,'base64'),eocd=Buffer.from(patch.eocdBase64,'base64'),padding=patch.alignmentPaddingBytes;
 assert.ok(Number.isSafeInteger(padding)&&padding>=0&&padding<insertion.length-32);
 assert.ok(insertion.length<1024*1024,'Unexpected public signature size');
 assert.ok(insertion.subarray(0,padding).every(value=>value===0));
 const block=insertion.subarray(padding);
 assert.equal(block.subarray(-16).toString(),'APK Sig Block 42');
 assert.equal(block.readBigUInt64LE(0),BigInt(block.length-8));assert.equal(block.readBigUInt64LE(block.length-24),BigInt(block.length-8));
 const expectedEnd=Buffer.from(unsigned.subarray(location.offset));
 expectedEnd.writeUInt32LE(location.directory+insertion.length,16);
 assert.deepEqual(eocd,expectedEnd,'Only the ZIP directory offset may change');
 const output=Buffer.concat([unsigned.subarray(0,location.directory),insertion,unsigned.subarray(location.directory,location.offset),eocd]);
 assert.equal(output.length,signed.size);assert.equal(digest(output),signed.sha256,'Wrong signed APK');
 assert.equal(readDirectory(output).directory,location.directory+insertion.length);
 return output;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [input,manifest,directory]=process.argv.slice(2);
 assert.ok(input&&manifest&&directory,'Provide unsigned APK, public manifest and output directory');
 const descriptor=JSON.parse(fs.readFileSync(manifest,'utf8'));
 const output=reconstructSignedApk(fs.readFileSync(input),descriptor);
 fs.mkdirSync(directory,{recursive:true});
 fs.writeFileSync(path.join(directory,descriptor.signed.file),output,{flag:'wx'});
 fs.writeFileSync(path.join(directory,'SHA256SUMS'),`${descriptor.signed.sha256}  ${descriptor.signed.file}\n`);
 fs.writeFileSync(path.join(directory,'certificate-sha256.txt'),descriptor.signed.certificateSha256+'\n');
 console.log('Reconstructed the exact previously signed APK using public signature data; no signing key is accessed.');
}
