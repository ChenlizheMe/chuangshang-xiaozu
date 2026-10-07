#!/usr/bin/env node
// Run after Vite: node --experimental-vm-modules scripts/verify-built-assessment.mjs
// Test-side only: evaluate real dist modules; do not rewrite source or built files.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL, fileURLToPath} from 'node:url';

const defaultRepo = fileURLToPath(new URL('../', import.meta.url));
const inside = (file, dir) => file === dir || file.startsWith(dir + path.sep);
function futureRealPath(file) {
  return fs.existsSync(file) ? fs.realpathSync(file) : path.join(futureRealPath(path.dirname(file)), path.basename(file));
}

// Overrides support isolated negative tests and explicit external reports. Default execution writes nothing.
export async function verifyBuiltAssessment({repo: repoOption = defaultRepo, dist: distOption, reportDir} = {}) {
  assert.equal(typeof vm.SourceTextModule, 'function', 'Run Node with --experimental-vm-modules');
  const repo = fs.realpathSync(path.resolve(repoOption));
  const dist = fs.realpathSync(path.resolve(distOption || path.join(repo, 'dist')));
  function resolveDistFile(file) {
    const lexical = path.resolve(file);
    assert.ok(lexical.startsWith(dist + path.sep), 'Production modules must stay inside dist');
    const real = fs.realpathSync(lexical);
    assert.ok(real.startsWith(dist + path.sep), 'Production modules must stay inside dist after resolving symlinks');
    return real;
  }
  const out = reportDir ? futureRealPath(path.resolve(reportDir)) : null;
  if (out) {
    assert.ok(!inside(out, repo) && !inside(out, dist), 'Report directory must remain outside the repo and audited dist');
    fs.mkdirSync(out, {recursive:true});
  }
  const require = createRequire(path.join(repo, 'package.json'));
  const {parseAst} = await import(pathToFileURL(require.resolve('rollup/parseAst')));
  const read = name => fs.readFileSync(path.join(repo, name), 'utf8');
  const json = name => JSON.parse(read(name));
  const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  const relative = name => path.relative(repo, name).split(path.sep).join('/');
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const entryRef = html.match(/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/g);
  assert.equal(entryRef?.length, 1, 'Exactly one production module entry required');
  const entry = resolveDistFile(path.resolve(dist, entryRef[0].match(/\bsrc="([^"]+)"/)[1]));
  const release = JSON.parse(html.match(/<script\b[^>]*\bid="offline-release"[^>]*>([\s\S]*?)<\/script>/)?.[1] || 'null');
  assert.ok(release?.id, 'Built page must carry an offline release manifest');
  const source = fs.readFileSync(entry, 'utf8');
  const ast = parseAst(source);
  const propertyName = p => p.key?.name ?? p.key?.value;
  function walk(node, visit, ancestors=[]) {
    if (!node || typeof node !== 'object') return;
    if (node.type) visit(node, ancestors);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) for (const child of value) walk(child,visit,[...ancestors,node]);
      else if (value && typeof value === 'object') walk(value,visit,[...ancestors,node]);
    }
  }
  const expectedReturnKeys = ['profiles','items','reportedSymptoms','urgent','triageLevel','suggestions','needsLocation','needsSymptoms','needsPart','needsEvidence'];
  const assessors = ast.body.filter(n => n.type === 'FunctionDeclaration' && n.body.body.some(s =>
    s.type === 'ReturnStatement' && s.argument?.type === 'ObjectExpression' &&
    expectedReturnKeys.every(k => s.argument.properties.some(p => propertyName(p) === k))));
  assert.equal(assessors.length, 1, 'Assessor must be uniquely identified by complete return shape');
  const assessor = assessors[0];
  assert.equal(assessor.params.length, 2);
  const sourceKnowledge = json('data/knowledge.json');
  const knowledgeDeclarations = ast.body.flatMap(n => n.type === 'VariableDeclaration' ? n.declarations : [])
    .filter(n => n.init?.type === 'ObjectExpression' &&
      Object.keys(sourceKnowledge).every(k => n.init.properties.some(p => propertyName(p) === k)));
  assert.equal(knowledgeDeclarations.length, 1, 'Compiled knowledge must be uniquely identified by data fields');
  const knowledge = knowledgeDeclarations[0];
  assert.deepEqual(knowledge.init.properties.map(propertyName).sort(),Object.keys(sourceKnowledge).sort());
  const calls = [];
  walk(ast,n => {
    if (n.type === 'CallExpression' && n.callee?.name === assessor.id.name && n.arguments[0]?.name === knowledge.id.name) calls.push(n);
  });
  assert.equal(calls.length, 1, 'The actual UI must pass this compiled knowledge into this assessor');
  const mounts = ast.body.filter(n => {
    const e=n.expression;
    return n.type === 'ExpressionStatement' && e?.type === 'CallExpression' &&
      e.callee?.type === 'MemberExpression' && propertyName({key:e.callee.property}) === 'render' &&
      e.callee.object?.type === 'CallExpression' && e.callee.object.callee?.property?.name === 'createRoot';
  });
  assert.equal(mounts.length, 1, 'Exactly one createRoot(...).render(...) bootstrap statement required');
  const mount = mounts[0];
  const instrumented = source.slice(0,mount.start) + source.slice(mount.start,mount.end).replace(/[^\r\n]/g,' ') + source.slice(mount.end) +
    `\nexport { ${assessor.id.name} as __audit_assess, ${knowledge.id.name} as __audit_knowledge };\n`;
  const span = n => ({utf16Range:[n.start,n.end], byteRange:[Buffer.byteLength(source.slice(0,n.start)),Buffer.byteLength(source.slice(0,n.end))], sha256:sha(source.slice(n.start,n.end))});
  const declarations = new Map(ast.body.flatMap(n => n.type === 'VariableDeclaration' ? n.declarations : []).map(n => [n.id.name,n]));
  const knowledgeFields = knowledge.init.properties.map(p => {
    assert.equal(p.value.type,'Identifier','Knowledge fields must reference compiled bindings');
    const node = declarations.get(p.value.name);
    assert.ok(node,'Compiled field binding exists');
    assert.ok(node.init.type === 'ArrayExpression' || (node.init.type === 'CallExpression' && node.init.callee.object?.name === 'JSON' && node.init.callee.property?.name === 'parse' && typeof node.init.arguments[0]?.value === 'string'), 'Only the observed actual compiled literals or JSON.parse allowed');
    return {field:propertyName(p), binding:p.value.name, form:node.init.type, ...span(node)};
  });
  const staticFiles = new Set();
  function collect(file) {
    file=resolveDistFile(file);
    if (staticFiles.has(file)) return;
    staticFiles.add(file);
    for(const node of parseAst(fs.readFileSync(file,'utf8')).body) if(node.type==='ImportDeclaration') {
      assert.ok(node.source.value.startsWith('.'),'Only relative static modules allowed');
      collect(path.resolve(path.dirname(file),node.source.value));
    }
  }
  collect(entry);
  function filesUnder(dir) {
    return fs.readdirSync(dir,{withFileTypes:true}).flatMap(d => d.isDirectory()?filesUnder(path.join(dir,d.name)):[path.join(dir,d.name)]);
  }
  // Filesystem hashes work in source archives and CI checkouts without .git or git installed.
  const sourceFiles = [...['src','data','tests'].flatMap(dir=>filesUnder(path.join(repo,dir))),
    ...fs.readdirSync(repo).filter(n=>/^(package(-lock)?\.json|vite\.config\.[^/]+)$/.test(n)).map(n=>path.join(repo,n))].sort();
  const auditedFiles = [...new Set([...sourceFiles,...filesUnder(path.join(dist,'assets')),path.join(dist,'index.html'),path.join(dist,'sw.js')])].sort();
  const label = file => inside(file, dist) ? `dist/${path.relative(dist,file).split(path.sep).join('/')}` : relative(file);
  const snapshot = () => Object.fromEntries(auditedFiles.map(f=>[label(f),sha(fs.readFileSync(f))]));
  const before = snapshot();
  const sourceHashes = Object.fromEntries(sourceFiles.map(f=>[relative(f),before[relative(f)]]));
  const effects=[];
  const windowStub={addEventListener:(type)=>effects.push({kind:'window.addEventListener',type})};
  const documentStub={createElement:(tag)=>{
    effects.push({kind:'document.createElement',tag});
    assert.equal(tag,'link','Only the initial modulepreload feature probe is permitted');
    return {relList:{supports:rel=>{effects.push({kind:'relList.supports',rel});assert.equal(rel,'modulepreload');return true;}}};
  }};
  const context=vm.createContext({console,URL,performance,
    setTimeout:()=>{throw Error('Unexpected timer during isolated assessment audit');},
    clearTimeout:()=>{throw Error('Unexpected timer cancellation during isolated assessment audit');},
    navigator:{},window:windowStub,document:documentStub});
  const modules=new Map();
  async function load(file) {
    file=resolveDistFile(file);
    if(modules.has(file))return modules.get(file);
    assert.ok(staticFiles.has(file),'Only discovered production static closure may load');
    const mod=new vm.SourceTextModule(file===entry?instrumented:fs.readFileSync(file,'utf8'),{
      context,identifier:file,initializeImportMeta(meta){meta.url=pathToFileURL(file).href;},
      importModuleDynamically(){throw Error('Unexpected lazy import: this audit never renders UI');}
    });
    modules.set(file,mod);
    await mod.link((specifier,ref)=>load(path.resolve(path.dirname(ref.identifier),specifier)));
    return mod;
  }
  const main=await load(entry);
  await main.evaluate({timeout:10000});
  assert.equal(modules.size,staticFiles.size);
  const compiledAssess=main.namespace.__audit_assess;
  const compiledKnowledge=main.namespace.__audit_knowledge;
  assert.equal(typeof compiledAssess,'function');
  assert.deepEqual(structuredClone(compiledKnowledge),sourceKnowledge,'Actual compiled knowledge equals source knowledge');
  const knowledgeBefore=structuredClone(compiledKnowledge);
  // Source imports are comparison oracle and existing-corpus selector only. They do not execute inside the production VM.
  const {assessSymptoms}=await import(pathToFileURL(path.join(repo,'src/clinicalEngine.js')));
  const {visibleSymptoms}=await import(pathToFileURL(path.join(repo,'src/symptomFilters.js')));
  const cross=json('tests/fixtures/cross-specialty-inputs.json');
  const reachable=json('tests/fixtures/ui-rule-reachability.json');
  const visceral=json('tests/fixtures/visceral-source-cases.json');
  const flank=json('tests/fixtures/confirmed-flank-cases.json');
  const llq=json('tests/fixtures/confirmed-llq-cases.json');
  const observations=json('tests/fixtures/reported-observation-facts.json');
  const regionalNight=json('tests/fixtures/regional-night-pain.json');
  const crossTestAst=parseAst(read('tests/cross-specialty-invariants.test.mjs'));
  const dangerDeclarations=crossTestAst.body.flatMap(n=>n.type==='VariableDeclaration'?n.declarations:[]).filter(n=>n.id.name==='danger');
  assert.equal(dangerDeclarations.length,1);
  const danger= dangerDeclarations[0].init.elements.map(n=>{assert.equal(n.type,'Literal');assert.equal(typeof n.value,'string');return n.value;});
  const fields=['feelings','signs','timing','triggers'];
  const byTag=new Map(fields.flatMap(f=>sourceKnowledge[f].map(t=>[t.id,f])));
  const tags=r=>fields.flatMap(f=>r[f]||[]);
  // Object property ordering is irrelevant to input identity; array ordering and missing-vs-empty fields remain distinct.
  const canonical = v => Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  const cases=new Map(),groups={};
  function add(group,name,report,expectation) {
    const input={reports:[report]},key=JSON.stringify(canonical(input));
    groups[group] ||= {raw:0,newUnique:0};groups[group].raw++;
    if(!cases.has(key)){cases.set(key,{input,origins:[],expected:[]});groups[group].newUnique++;}
    const c=cases.get(key);c.origins.push({group,name});if(expectation)c.expected.push(expectation);
  }
  for(const c of cross.seeds)add('cross-specialty seeds',c.name,c.report);
  for(const c of reachable.cases)add('UI rule reachability',c.id,c.report,{kind:'condition',id:c.id,match:true});
  for(const c of visceral.cases)add('visceral reference boundaries',c.name,c.report,{kind:'condition',id:c.conditionId,match:c.shouldMatch});
  for(const c of flank.cases)add('confirmed flank boundaries',c.name,c.input,{kind:'triage',level:c.wantLevel});
  for(const c of llq.cases)add('confirmed LLQ boundaries',c.name,c.input,{kind:'llq',level:c.wantLevel,referenceIds:c.referenceIds});
  for(const c of observations.cases)add('reported observation boundaries',c.name,c.report,{kind:'observation',...c.expected});
  for(const c of regionalNight.cases.filter(c=>c.builtParity))add('regional night-pain boundaries',c.name,c.report,{kind:'triage',level:c.wantLevel});
  for(const c of cross.crossLayerCases)for(const [i,r]of c.reports.entries())add('cross-layer equivalent areas',`${c.name} #${i+1}`,r);
  for(const {name,report:r}of cross.seeds) {
    add('reversed input arrays',name,{...r,...Object.fromEntries(fields.map(f=>[f,[...(r[f]||[])].reverse()]))});
    add('repeated input arrays',name,{...r,...Object.fromEntries(fields.map(f=>[f,[...(r[f]||[]),...(r[f]||[])]]))});
    add('unknown API tokens',name,{...r,feelings:[...(r.feelings||[]),'unknown-token','confirmed-diagnosis']});
    const visible=new Set(fields.flatMap(kind=>visibleSymptoms(sourceKnowledge,{parts:[r.part],layer:r.layer,kind}).map(t=>t.id)));
    for(const d of danger.filter(t=>visible.has(t)&&!tags(r).includes(t))) {
      const field=byTag.get(d);assert.ok(field);
      add('selectable danger additions',`${name} + ${d}`,{...r,[field]:[...(r[field]||[]),d]});
    }
  }
  let compared=0,expectationChecks=0;
  const triageCounts={},layers={},conditionIds=new Set(),warningHashes=new Set(),outputDigest=crypto.createHash('sha256');
  const results=out ? [] : null;
  const start=performance.now();
  for(const [key,c]of cases) {
    const sourceInput=structuredClone(c.input),compiledInput=structuredClone(c.input);
    const expected=assessSymptoms(sourceKnowledge,sourceInput);
    const actual=structuredClone(compiledAssess(compiledKnowledge,compiledInput));
    try {
      assert.deepEqual(actual,expected,'Complete output parity: profiles, grades, ordered cards/scores/evidence, bilingual warnings and all other fields');
      assert.deepEqual(sourceInput,c.input,'Source input immutable');
      assert.deepEqual(compiledInput,c.input,'Built input immutable');
      for(const exp of c.expected) {
        if(exp.kind==='condition')assert.equal(actual.items.some(i=>i.id===exp.id),exp.match);
        if(exp.kind==='triage'||exp.kind==='llq')assert.equal(actual.triageLevel,exp.level);
        if(exp.kind==='llq')assert.deepEqual(actual.items.map(i=>i.id).filter(id=>!id.startsWith('basic-')),exp.referenceIds.filter(id=>!id.startsWith('basic-')));
        if(exp.kind==='observation'){
          assert.equal(actual.triageLevel,exp.triageLevel);
          assert.deepEqual(actual.items.map(i=>i.id),exp.itemIds);
          assert.deepEqual(actual.urgent.map(w=>w.id),exp.warningIds);
        }
        expectationChecks++;
      }
    } catch(error) {
      error.message = `${error.message.split('\n')[0]} (${c.origins[0].group}: ${c.origins[0].name})`;
      if(out)fs.writeFileSync(path.join(out,'mismatch.json'),JSON.stringify({input:c.input,origins:c.origins,expected,actual,error:error.message},null,2)+'\n');
      throw error;
    }
    compared++;
    const grade=actual.triageLevel??'none';triageCounts[grade]=(triageCounts[grade]||0)+1;
    const layer=c.input.reports[0].layer;layers[layer]=(layers[layer]||0)+1;
    for(const item of actual.items)conditionIds.add(item.id);
    for(const w of actual.urgent)warningHashes.add(sha(JSON.stringify(w)));
    outputDigest.update(key+'\n'+JSON.stringify(actual)+'\n');
    if(results)results.push({input:c.input,inputSha256:sha(key),outputSha256:sha(JSON.stringify(actual)),origins:c.origins,triageLevel:actual.triageLevel,itemIds:actual.items.map(i=>i.id)});
  }
  assert.deepEqual(structuredClone(compiledKnowledge),knowledgeBefore,'Compiled knowledge remains unchanged');
  assert.deepEqual(sourceKnowledge,json('data/knowledge.json'),'Source oracle knowledge remains unchanged');
  const after=snapshot();
  assert.deepEqual(after,before,'All audited source/test/data/package and built asset hashes remain unchanged');
  const gitSHA = process.env.GITHUB_SHA || process.env.GIT_SHA;
  const report={status:'PASS',createdAt:new Date().toISOString(),node:process.version,sourceSHA:sha(JSON.stringify(sourceHashes)),
    ...(gitSHA ? {gitSHA} : {}),releaseId:release.id,entry:label(entry),
    actualCompiledModules:[...modules.keys()].map(f=>({file:label(f),bytes:fs.statSync(f).size,sha256:sha(fs.readFileSync(f))})),
    instrumentation:{assessor:{binding:assessor.id.name,...span(assessor)},knowledge:{binding:knowledge.id.name,...span(knowledge)},knowledgeFields,
      actualUICall:{text:source.slice(calls[0].start,calls[0].end),...span(calls[0])},removedMount:{text:source.slice(mount.start,mount.end),...span(mount)},
      appendedExports:`${assessor.id.name} as __audit_assess, ${knowledge.id.name} as __audit_knowledge`,instrumentedEntrySha256:sha(instrumented)},
    method:'Node vm.SourceTextModule evaluates real production main and its static module closure. Only UI createRoot.render statement is blanked with equal UTF-16 length; audit exports appended in memory. Source engine is imported solely as comparison oracle. No build, source replacement, browser execution or production write.',
    stubs:{window:'addEventListener records only; window.document absent, so ReactDOM detects no usable DOM',document:'createElement permits only link and relList.supports(modulepreload) returns true',navigator:'empty object; service worker is unavailable and its registration branch is not executed',timers:'setTimeout and clearTimeout throw if invoked',lazyImports:'throw if invoked',effects},
    coverage:{rawEntries:Object.values(groups).reduce((n,g)=>n+g.raw,0),uniqueInputs:compared,deduplicatedEntries:Object.values(groups).reduce((n,g)=>n+g.raw,0)-compared,groups,
      existingFixtureExpectationsChecked:expectationChecks,triageCounts,layers,distinctOutputConditionIds:[...conditionIds].sort(),distinctOrderedWarningObjects:warningHashes.size,
      comparison:'deepStrictEqual on complete structuredClone-normalized output; preserves array order, undefined fields and all bilingual text. Includes each card ID/score/why/matchedSymptoms/evidenceFamilies/advice and every warning/triage field.',
      inactiveRule:'autonomic-assessment is unavailable in existing selectable anatomy, not covered as a reachable rule',
      limits:'Synthetic software parity, not medical validation. VM stubs do not exercise DOM, event handlers, network, service worker, rendering, or lazy 3D viewer. This does not execute all existing regression test files.'},
    stability:{auditedFiles:Object.keys(before).length,sourceAndAssetsUnchanged:true,sourceHashes,sha256Before:before,sha256After:after},
    orderedInputAndOutputSha256:outputDigest.digest('hex'),elapsedAssessmentMs:Math.round(performance.now()-start)};
  if(out) {
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
    fs.writeFileSync(path.join(out,'case-manifest.json'),JSON.stringify(results,null,2)+'\n');
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = {};
    const names = {'--repo':'repo','--dist':'dist','--report-dir':'reportDir'};
    for (let i=2; i<process.argv.length; i+=2) {
      const key = names[process.argv[i]];
      assert.ok(key && process.argv[i+1] && !process.argv[i+1].startsWith('--') && !(key in options),
        'Usage: node --experimental-vm-modules scripts/verify-built-assessment.mjs [--repo DIR] [--dist DIR] [--report-dir EXTERNAL_DIR]');
      options[key] = process.argv[i+1];
    }
    const report = await verifyBuiltAssessment(options);
    console.log(`Built assessment parity PASS: ${report.coverage.uniqueInputs.toLocaleString('en-US')} unique inputs, ${report.coverage.existingFixtureExpectationsChecked} fixture expectations, ${report.actualCompiledModules.length} actual modules; release ${report.releaseId}.`);
    if(options.reportDir)console.log(`Report: ${path.resolve(options.reportDir,'report.json')}`);
  } catch(error) {
    console.error(`Built assessment parity FAIL: ${error.message.split('\n')[0]}`);
    process.exitCode = 1;
  }
}
