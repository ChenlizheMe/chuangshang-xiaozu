import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';import {buildSync} from 'esbuild';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import postcss from 'postcss';
const require=createRequire(import.meta.url);const compiled=buildSync({entryPoints:[new URL('../src/Feedback.jsx',import.meta.url).pathname],bundle:true,platform:'node',format:'cjs',external:['react'],write:false}).outputFiles[0].text;const module={exports:{}};new Function('module','exports','require',compiled)(module,module.exports,require);const {ModelErrorBoundary,AppErrorBoundary,ViewerUnavailable}=module.exports;
test('existing error states use the selected language while preserving escaped technical details',()=>{
 for(const [lang,model,app,viewer,retry] of [['zh','解剖模型加载失败','页面遇到异常','此浏览器暂时无法显示3D预览','重试模型'],['en','Unable to load the anatomy model','unexpected error','3D preview is unavailable','RETRY MODEL']]){
  const error=new Error('<loader failure>');const boundary=new ModelErrorBoundary({lang,onRetry:()=>{}});boundary.state={error};const modelHtml=renderToStaticMarkup(boundary.render());assert.ok(modelHtml.includes(model));assert.ok(modelHtml.includes(retry));assert.match(modelHtml,/&lt;loader failure&gt;/);assert.match(modelHtml,/role="alert"/);
  const top=new AppErrorBoundary({lang});top.state={error};const appHtml=renderToStaticMarkup(top.render());assert.ok(appHtml.includes(app));assert.ok(appHtml.includes(lang==='zh'?'技术详情':'Technical details'));assert.match(appHtml,/&lt;loader failure&gt;/);
  assert.ok(renderToStaticMarkup(React.createElement(ViewerUnavailable,{lang,onRetry:()=>{}})).includes(viewer));
 }
});
test('changing language does not clear the recorded error or disable its existing retry action',()=>{
 let retries=0;const error=new Error('decoder failure'),boundary=new ModelErrorBoundary({lang:'zh',onRetry:()=>{retries++;},layer:'skeleton',resetKey:0});boundary.state={error};const previous=boundary.props;boundary.props={...previous,lang:'en'};boundary.componentDidUpdate(previous);assert.equal(boundary.state.error,error);
 const tree=boundary.render();const button=React.Children.toArray(tree.props.children).find(x=>x.type==='button');button.props.onClick();assert.equal(retries,1);
});
test('viewer module failures explicitly label the existing button as a page reload in both languages',()=>{
 const error=Object.assign(new Error('<chunk failed>'),{code:'ANATOMY_MODULE_LOAD_FAILED'});let retries=0;
 const boundary=new ModelErrorBoundary({lang:'zh',onRetry:()=>retries++,layer:'skeleton',resetKey:0});boundary.state={error};
 for(const [lang,label] of [['zh','重新加载页面'],['en','RELOAD PAGE']]){
  const previous=boundary.props;boundary.props={...previous,lang};boundary.componentDidUpdate(previous);assert.equal(boundary.state.error,error);
  const tree=boundary.render(),html=renderToStaticMarkup(tree);assert.ok(html.includes(label));assert.match(html,/&lt;chunk failed&gt;/);
  React.Children.toArray(tree.props.children).find(x=>x.type==='button').props.onClick();
 }
 assert.equal(retries,2);
});
test('short full-width panels hide only the covered controls, leaving the dock and empty state usable',()=>{
 const root=postcss.parse(fs.readFileSync(new URL('../src/cassette.css',import.meta.url),'utf8')),rules=[];
 root.walkAtRules('media',m=>{if(m.params==='(max-width:1000px) and (max-height:450px)')m.walkRules(r=>{if(r.nodes.some(d=>d.prop==='visibility'&&d.value==='hidden'))rules.push(r);});});
 const selectors=rules.map(rule=>rule.selector).join(',');assert.ok(rules.length);for(const target of ['.scene-controls','.model-layers','.vertical-control','.model-error','.screen-label.about-control'])assert.ok(selectors.includes(target));assert.doesNotMatch(selectors,/sticker-dock|sticker-card/);for(const rule of rules)assert.match(rule.selector,/:not\(\.empty-sheet\)/);
 const loading=[];root.walkRules('.model-loading',r=>loading.push(...r.nodes));assert.ok(loading.some(d=>d.prop==='width'&&d.value==='max-content'));assert.ok(loading.some(d=>d.prop==='max-width'&&d.value.includes('100vw')));
});
