import React,{useEffect,useRef} from 'react';
const copy={
 zh:{title:'关于创伤小组',back:'返回排查',intro:'最初只是为了测试 dot。长期工作和学习时，我发现自己的身体总会出一些毛病，于是就做了创伤小组，试着把这些不舒服整理得具体一点。',body:'我把它做成了一个简单的 demo：先在 3D 人体上选出不舒服的位置，再记录感觉、持续时间和可能的诱因，把这些线索放在一起看。目前的参考分析基于本地规则，功能也还在慢慢尝试。',limitTitle:'使用边界',limit:'当前 demo 仅用于整理不适线索，不能替代医生的诊断或治疗建议。',home:'我的主页',author:'Lizhe Chen',language:'切换语言'},
 en:{title:'About Trauma Team International',back:'BACK TO ASSESSMENT',intro:'This started as a way to test dot. I’d noticed that physical discomfort kept coming up during long stretches of work and study, so I made Trauma Team International to help describe it more clearly.',body:'I built a simple demo: select an area on the 3D body, then record what you feel, how long it has lasted, and what might trigger it. It brings those clues together, with reference analysis based on local rules. I’m still trying things out.',limitTitle:'Limits',limit:'This demo only helps organize information about physical discomfort. It cannot replace a doctor’s diagnosis or treatment advice.',home:'My homepage',author:'Lizhe Chen',language:'Switch language'}
};
export default function AboutPage({lang,setLang}){
 const c=copy[lang],heading=useRef(null);
 useEffect(()=>{heading.current?.focus({preventScroll:true});},[]);
 return <main className="about-page" data-lang={lang}>
  <div className="about-shell">
   <nav className="about-navigation" aria-label={lang==='zh'?'关于页导航':'About navigation'}><a href="#/" className="about-back">← {c.back}</a><button onClick={()=>setLang(lang==='zh'?'en':'zh')} aria-label={c.language}>{lang==='zh'?'EN':'中'}</button></nav>
   <header className="about-heading"><span className="about-kicker">TRAUMA TEAM INTERNATIONAL / ABOUT</span><h1 ref={heading} tabIndex={-1}>{c.title}</h1></header>
   <div className="about-story"><p className="about-intro">{c.intro}</p><p>{c.body}</p></div>
   <aside className="about-limits"><h2>{c.limitTitle}</h2><p>{c.limit}</p></aside>
   <footer className="about-footer"><span>{c.author}</span><a href="https://www.chenlizhe.cn" target="_blank" rel="noopener noreferrer">{c.home} <span aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" focusable="false" style={{display:'block'}}><path d="M5 19 19 5M6 5h13v13" stroke="currentColor" strokeWidth="2" strokeLinecap="square"/></svg></span><small>www.chenlizhe.cn</small></a></footer>
  </div>
 </main>;
}
