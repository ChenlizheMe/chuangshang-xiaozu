// Post-build only: node --experimental-vm-modules --test tests/build/verify-built-assessment.test.mjs
import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {verifyBuiltAssessment} from '../../scripts/verify-built-assessment.mjs';

// The override is only for reviewing a staged gate before copying it into the repository.
const sourceRepo = path.resolve(process.env.BUILT_ASSESSMENT_REPO || fileURLToPath(new URL('../../', import.meta.url)));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'built-assessment-gate-'));
const repo = path.join(scratch, 'repo');
const dist = path.join(repo, 'dist');
let report, entry, source, ast;
after(() => fs.rmSync(scratch, {recursive:true, force:true}));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function snapshot(dir) {
  return Object.fromEntries(fs.readdirSync(dir, {withFileTypes:true}).flatMap(item => {
    if (item.isSymbolicLink()) return []; // node_modules is the sole shared, read-only dependency tree.
    const file = path.join(dir, item.name);
    return item.isDirectory() ? Object.entries(snapshot(file)) : [[file, sha(fs.readFileSync(file))]];
  }));
}

before(async () => {
  assert.ok(fs.existsSync(path.join(sourceRepo, 'dist/index.html')), 'Build first: this suite requires real Vite dist artifacts');
  fs.mkdirSync(repo);
  for (const dir of ['src','data','tests']) fs.cpSync(path.join(sourceRepo, dir), path.join(repo, dir), {recursive:true});
  for (const file of fs.readdirSync(sourceRepo).filter(name => /^(package(-lock)?\.json|vite\.config\.[^/]+)$/.test(name))) {
    fs.copyFileSync(path.join(sourceRepo, file), path.join(repo, file));
  }
  fs.mkdirSync(path.join(repo, 'scripts'));
  fs.copyFileSync(new URL('../../scripts/verify-built-assessment.mjs', import.meta.url), path.join(repo, 'scripts/verify-built-assessment.mjs'));
  fs.symlinkSync(path.join(sourceRepo, 'node_modules'), path.join(repo, 'node_modules'), 'dir');
  fs.mkdirSync(dist);
  for (const file of ['index.html','sw.js','assets']) fs.cpSync(path.join(sourceRepo, 'dist', file), path.join(dist, file), {recursive:true});
  assert.ok(!fs.existsSync(path.join(repo, '.git')), 'Verification must work without git history');
  const before = snapshot(repo);
  report = await verifyBuiltAssessment({repo, reportDir:path.join(scratch, 'report')});
  assert.deepEqual(snapshot(repo), before, 'Even optional reports must leave the repo and dist untouched');
  entry = path.join(repo, report.entry);
  source = fs.readFileSync(entry, 'utf8');
  const require = createRequire(path.join(sourceRepo, 'package.json'));
  const {parseAst} = await import(pathToFileURL(require.resolve('rollup/parseAst')));
  ast = parseAst(source);
});

test('real built modules pass all retained inputs and optional reports contain verifiable hashes', () => {
  assert.equal(report.status, 'PASS');
  assert.equal(report.coverage.uniqueInputs, 7647);
  assert.equal(report.coverage.rawEntries, 9686);
  assert.equal(report.coverage.existingFixtureExpectationsChecked, 153);
  assert.deepEqual(report.coverage.groups['reported observation boundaries'], {raw:14,newUnique:14});
  assert.equal(report.sourceSHA, sha(JSON.stringify(report.stability.sourceHashes)));
  for (const module of report.actualCompiledModules) assert.equal(module.sha256, sha(fs.readFileSync(path.join(repo, module.file))));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(scratch, 'report/report.json'), 'utf8')), report);
  assert.equal(JSON.parse(fs.readFileSync(path.join(scratch, 'report/case-manifest.json'), 'utf8')).length, 7647);
});

test('the default CLI resolves the repo from its own path and writes no files', () => {
  const before = snapshot(repo);
  const output = execFileSync(process.execPath, ['--experimental-vm-modules', path.join(repo, 'scripts/verify-built-assessment.mjs')],
    {cwd:os.tmpdir(), encoding:'utf8', stdio:['ignore','pipe','pipe'], timeout:60000});
  assert.match(output, /^Built assessment parity PASS: 7,647 unique inputs, 153 fixture expectations, \d+ actual modules;/);
  assert.equal(output.trim().split('\n').length, 1);
  assert.deepEqual(snapshot(repo), before);
});

async function rejectsCorruption(t, corrupt, message) {
  const corrupted = fs.mkdtempSync(path.join(scratch, 'dist-'));
  t.after(() => fs.rmSync(corrupted, {recursive:true, force:true}));
  fs.cpSync(dist, corrupted, {recursive:true});
  const target = path.join(corrupted, path.relative(dist, entry));
  const changed = corrupt(source);
  assert.notEqual(changed, source, 'The negative test must actually change the built copy');
  fs.writeFileSync(target, changed);
  await assert.rejects(verifyBuiltAssessment({repo, dist:corrupted}), message);
  assert.equal(fs.readFileSync(entry, 'utf8'), source, 'The baseline build must remain intact');
}
const functionNode = () => ast.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === report.instrumentation.assessor.binding);
const replace = (text, node, value) => text.slice(0,node.start) + value + text.slice(node.end);

test('rejects modified compiled knowledge before comparing assessments', t => rejectsCorruption(t,
  text => text + `\n${report.instrumentation.knowledge.binding}.feelings[0].en += ' CORRUPTED';\n`,
  /Actual compiled knowledge equals source knowledge/));

test('rejects a changed assessor result while preserving its detectable shape', t => rejectsCorruption(t, text => {
  const result = functionNode().body.body.find(node => node.type === 'ReturnStatement' && node.argument?.type === 'ObjectExpression');
  const property = result.argument.properties.find(node => (node.key.name || node.key.value) === 'triageLevel');
  return replace(text, property.value, JSON.stringify('CORRUPTED'));
}, /Complete output parity/));

test('new facial-onset fixtures detect corruption isolated to that branch', t => rejectsCorruption(t, text => {
  const node=functionNode(),parameter=node.params[1].left || node.params[1];
  assert.equal(parameter.type,'Identifier');
  const result=node.body.body.find(n=>n.type==='ReturnStatement'&&n.argument?.type==='ObjectExpression');
  const property=result.argument.properties.find(n=>(n.key.name||n.key.value)==='triageLevel');
  const original=text.slice(property.value.start,property.value.end);
  const applies=`(${parameter.name}.reports||[]).some(r=>(r.feelings||[]).includes('面部麻木')&&(r.timing||[]).includes('突然起病'))`;
  return replace(text,property.value,`(${applies}?'prompt':(${original}))`);
}, /Complete output parity.*reported observation boundaries: sudden-facial-numbness/));

test('rejects input mutation even when the full result remains equal', t => rejectsCorruption(t, text => {
  const node = functionNode(), offset = node.body.start + 1;
  const parameter = node.params[1].left || node.params[1];
  assert.equal(parameter.type, 'Identifier');
  return text.slice(0,offset) + `${parameter.name}.__gateMutation = true;` + text.slice(offset);
}, /Built input immutable/));

test('rejects compiled knowledge mutation even when every result remains equal', t => rejectsCorruption(t, text => {
  const node = functionNode(), offset = node.body.start + 1;
  assert.equal(node.params[0].type, 'Identifier');
  return text.slice(0,offset) + `${node.params[0].name}.__gateMutation = true;` + text.slice(offset);
}, /Compiled knowledge remains unchanged/));

test('rejects ambiguous assessor declarations', t => rejectsCorruption(t, text => {
  const node = functionNode();
  const duplicate = replace(text.slice(node.start,node.end), {start:node.id.start-node.start,end:node.id.end-node.start}, '__duplicateAssessor');
  return text + '\n' + duplicate;
}, /Assessor must be uniquely identified/));

test('rejects ambiguous compiled knowledge declarations', t => rejectsCorruption(t, text => {
  const binding = report.instrumentation.knowledge.binding;
  const node = ast.body.flatMap(n => n.type === 'VariableDeclaration' ? n.declarations : []).find(n => n.id.name === binding);
  return text + `\nconst __duplicateKnowledge = ${text.slice(node.init.start,node.init.end)};\n`;
}, /Compiled knowledge must be uniquely identified/));

test('rejects an ambiguous UI assessment call', t => rejectsCorruption(t,
  text => text + `\n${report.instrumentation.actualUICall.text};\n`,
  /The actual UI must pass this compiled knowledge into this assessor/));

test('rejects an ambiguous bootstrap instead of removing multiple mounts', t => rejectsCorruption(t,
  text => text + '\n' + report.instrumentation.removedMount.text,
  /Exactly one createRoot\(\.\.\.\)\.render\(\.\.\.\) bootstrap statement required/));
