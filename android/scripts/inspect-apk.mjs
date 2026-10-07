import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const [apk,badgingFile]=process.argv.slice(2);
const badging=await readFile(badgingFile,'utf8');
assert.match(badging,/package: name='cn\.traumateam\.app' versionCode='1' versionName='1\.0\.0'/);
assert.match(badging,/sdkVersion:'26'/);
assert.match(badging,/targetSdkVersion:'35'/);
assert.deepEqual([...badging.matchAll(/uses-permission: name='([^']+)'/g)].map(x=>x[1]),['android.permission.INTERNET']);
assert.ok(!badging.includes('application-debuggable'));
const files=execFileSync('unzip',['-Z1',apk],{encoding:'utf8'}).trim().split('\n');
assert.ok(files.includes('assets/packaged-assets.properties'));
assert.equal(files.filter(x=>/^assets\/anatomy\/.*\.glb$/.test(x)).length,3);
assert.equal(files.filter(x=>/^assets\/draco\//.test(x)).length,3);
assert.ok(!files.some(x=>/^assets\/.*(?:\.html$|\/sw\.js$|\/dist\/)/.test(x)));
assert.ok(!files.some(x=>/\.(?:jks|keystore|p12|pem|key)$/.test(x)));
const inventory=JSON.parse(execFileSync('unzip',['-p',apk,'assets/packaged-assets.json'],{encoding:'utf8'}));
assert.equal(inventory.schema,1);
assert.equal(Object.keys(inventory.assets).length,6);
for(const [logical,entry] of Object.entries(inventory.assets)){
 const bytes=execFileSync('unzip',['-p',apk,`assets${logical}`],{maxBuffer:16*1024*1024});
 assert.equal(bytes.length,entry.size);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
}
for(const notice of ['assets/anatomy/LICENSE','assets/anatomy/NOTICE','assets/licenses/DRACO-LICENSE.txt','assets/licenses/DRACO-NOTICE.txt'])assert.ok(files.includes(notice));
console.log('APK checked: cn.traumateam.app 1.0.0 (1), API 26–35 target, INTERNET only, not debuggable; content-addressed assets only.');
