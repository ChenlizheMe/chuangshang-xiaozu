import React from 'react';
const copy={
 zh:{model:'解剖模型加载失败，请重试。',retryModel:'重试模型',unknown:'未提供错误详情',viewer:'此浏览器暂时无法显示3D预览。',retryViewer:'重新加载预览',brand:'创伤小组',app:'页面遇到异常，请重新加载。',details:'技术详情'},
 en:{model:'Unable to load the anatomy model. Please retry.',retryModel:'RETRY MODEL',unknown:'No error details available',viewer:'3D preview is unavailable in this browser.',retryViewer:'RETRY VIEWER',brand:'TRAUMA TEAM',app:'The app encountered an unexpected error. Please reload the page.',details:'Technical details'}
};
const text=lang=>copy[lang==='en'?'en':'zh'];
export class ModelErrorBoundary extends React.Component{
 state={error:null};
 static getDerivedStateFromError(error){return {error};}
 componentDidUpdate(prev){if(prev.resetKey!==this.props.resetKey||prev.layer!==this.props.layer){if(this.state.error)this.setState({error:null});}}
 render(){const c=text(this.props.lang);return this.state.error?<div className="model-error" role="alert"><p>{c.model}</p><small>{this.state.error?.message||c.unknown}</small><button type="button" onClick={this.props.onRetry}>{c.retryModel}</button></div>:this.props.children;}
}
export class AppErrorBoundary extends React.Component{
 state={error:null};
 static getDerivedStateFromError(error){return {error};}
 render(){const c=text(this.props.lang);return this.state.error?<main className="app-error" role="alert"><h1>{c.brand}</h1><p>{c.app}</p><details><summary>{c.details}</summary><pre>{String(this.state.error?.message||this.state.error)}</pre></details></main>:this.props.children;}
}
export function ViewerUnavailable({lang,onRetry}){const c=text(lang);return <div className="model-error" role="alert"><p>{c.viewer}</p><button type="button" onClick={onRetry}>{c.retryViewer}</button></div>;}
