import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {reconstructSignedApk} from './reconstruct-signed-apk.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
// A small structural ZIP fixture exercises reconstruction, not cryptographic
// signature validity. The publication job separately runs official apksigner.
function fixture(){
 const data=Buffer.from('unchanged local bytes'),directory=Buffer.alloc(46),end=Buffer.alloc(22);
 directory.writeUInt32LE(0x02014b50);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(data.length,16);
 const unsigned=Buffer.concat([data,directory,end]);
 const block=Buffer.alloc(40);block.writeBigUInt64LE(32n);block.writeBigUInt64LE(32n,16);block.write('APK Sig Block 42',24);
 const insertion=Buffer.concat([Buffer.alloc(4),block]),signedEnd=Buffer.from(end);signedEnd.writeUInt32LE(data.length+insertion.length,16);
 const expected=Buffer.concat([data,insertion,directory,signedEnd]);
 const descriptor={schema:1,unsigned:{size:unsigned.length,sha256:hash(unsigned),centralDirectoryOffset:data.length,eocdOffset:data.length+directory.length},signed:{file:'trauma-team-1.0.0.apk',size:expected.length,sha256:hash(expected),certificateSha256:'a'.repeat(64)},publicSignature:{insertionBase64:insertion.toString('base64'),eocdBase64:signedEnd.toString('base64'),alignmentPaddingBytes:4}};
 return {unsigned,expected,descriptor};
}
test('public data reconstructs only the exact declared bytes without a signing key',()=>{
 const {unsigned,expected,descriptor}=fixture();assert.deepEqual(reconstructSignedApk(unsigned,descriptor),expected);
});
test('a changed unsigned APK, layout or declared signed identity is rejected',()=>{
 const f=fixture(),changed=Buffer.from(f.unsigned);changed[0]^=1;assert.throws(()=>reconstructSignedApk(changed,f.descriptor));
 for(const mutate of [m=>m.unsigned.size++,m=>m.unsigned.centralDirectoryOffset++,m=>m.unsigned.eocdOffset--,m=>m.signed.sha256='b'.repeat(64),m=>m.signed.file='../other.apk',m=>m.signed.certificateSha256='wrong']){
  const descriptor=structuredClone(f.descriptor);mutate(descriptor);assert.throws(()=>reconstructSignedApk(f.unsigned,descriptor));
 }
});
test('signature layout, zero padding and the sole permitted ZIP end-record change are checked',()=>{
 for(const index of [0,4,39]){
  const f=fixture(),bytes=Buffer.from(f.descriptor.publicSignature.insertionBase64,'base64');bytes[Math.min(index,bytes.length-1)]^=1;f.descriptor.publicSignature.insertionBase64=bytes.toString('base64');assert.throws(()=>reconstructSignedApk(f.unsigned,f.descriptor));
 }
 const f=fixture(),end=Buffer.from(f.descriptor.publicSignature.eocdBase64,'base64');end[4]=1;f.descriptor.publicSignature.eocdBase64=end.toString('base64');assert.throws(()=>reconstructSignedApk(f.unsigned,f.descriptor));
});
