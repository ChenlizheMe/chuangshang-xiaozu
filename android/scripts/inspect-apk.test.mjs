import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyApkBadging} from './inspect-apk.mjs';

// Metadata spelling produced by the actual Build Tools 35 CI APK inspection.
const badging=`package: name='cn.traumateam.app' versionCode='1' versionName='1.0.0' platformBuildVersionName='15' platformBuildVersionCode='35' compileSdkVersion='35' compileSdkVersionCodename='15'
minSdkVersion:'26'
targetSdkVersion:'35'
uses-permission: name='android.permission.INTERNET'
application-label:'创伤小组'
`;
test('release metadata accepts the actual aapt2 minSdkVersion field',()=>{
 assert.doesNotThrow(()=>verifyApkBadging(badging));
});
test('the metadata gate still rejects wrong APIs, identity, permissions and debug builds',()=>{
 for(const invalid of [badging.replace("minSdkVersion:'26'","minSdkVersion:'25'"),badging.replace("minSdkVersion:'26'",''),badging+"minSdkVersion:'27'\n",badging.replace("targetSdkVersion:'35'","targetSdkVersion:'34'"),badging.replace('cn.traumateam.app','cn.traumateam.app.debug'),badging+"uses-permission: name='android.permission.CAMERA'\n",badging+'application-debuggable\n'])assert.throws(()=>verifyApkBadging(invalid));
});
