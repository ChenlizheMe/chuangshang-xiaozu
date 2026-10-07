import fs from 'node:fs';
import assert from 'node:assert/strict';

// This job is deliberately limited to this reviewed first preview release.
const repository='ChenlizheMe/trauma-team-international',tag='android-v1.0.0';
const source='b317f650dd5aae8fa2d1c3d1ad1b9c49a2acb9dc';
assert.equal(process.env.GITHUB_REPOSITORY,repository);assert.ok(process.env.GH_TOKEN);
const descriptor=JSON.parse(fs.readFileSync('android/releases/1.0.0/public-signature.json','utf8'));
assert.equal(descriptor.tag,tag);assert.equal(descriptor.sourceCommit,source);
assert.equal(descriptor.unsigned.runId,37659426133);
assert.equal(descriptor.unsigned.sha256,'f7e9b9c2e877130ce9a80d5cb2ae2b0c325ac61623bb07cc6a29961d5cfd128c');
assert.equal(descriptor.signed.sha256,'25397d9a71f7ee49ef628073f2eef68c084ffa896f63320bfeddcac86140d2f8');
assert.equal(descriptor.signed.certificateSha256,'6fa0cf306e3aa8662678f0d217845b97df449204493c5850ccf9b34cebd55a50');
async function get(resource){
 const response=await fetch(`https://api.github.com/repos/${repository}/${resource}`,{headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
 if(response.status===404)return null;
 if(!response.ok)throw Error(`GitHub metadata request failed with status ${response.status}`);
 return await response.json();
}
const release=await get(`releases/tags/${tag}`),ref=await get(`git/ref/tags/${tag}`);
if(ref){assert.equal(ref.object.type,'commit','Unexpected pre-existing annotated tag');assert.equal(ref.object.sha,source,'Existing tag targets different source');}
if(release){
 assert.ok(ref,'Existing release tag is missing');assert.equal(release.prerelease,true);assert.equal(release.target_commitish,source);
 for(const name of [descriptor.signed.file,'SHA256SUMS','certificate-sha256.txt'])assert.ok(release.assets.some(asset=>asset.name===name&&asset.state==='uploaded'),`Existing release lacks completed asset ${name}`);
 if(release.draft)assert.equal((release.body||'').trim(),fs.readFileSync('android/releases/1.0.0/notes.md','utf8').trim(),'Existing draft has different notes');
}
fs.appendFileSync(process.env.GITHUB_OUTPUT,`present=${release?'true':'false'}\ndraft=${release?.draft?'true':'false'}\n`);
console.log(release?'Existing preview will be downloaded and verified without changes.':'No preview exists; publication may proceed after all APK checks.');
