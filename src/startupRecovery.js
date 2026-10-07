// Inlined into HTML so a missing entry module cannot also hide its recovery UI.
// No automatic reload or cache changes: the user controls a normal retry.
export function installStartupRecovery(host,doc,timeoutMs=15000){
 const root=doc.getElementById('root');
 if(!root||root.childElementCount)return ()=>{};
 let card=null,timer=null,finished=false;
 const observer=new host.MutationObserver(()=>{if(root.childElementCount)finish();});
 const finish=()=>{
  if(finished)return;finished=true;
  host.clearTimeout(timer);observer.disconnect();
  host.removeEventListener('error',onError,true);
  host.removeEventListener('unhandledrejection',onRejection);
  card?.remove();card=null;
 };
 const show=()=>{
  if(root.childElementCount){finish();return;}
  if(finished||card)return;
  const english=doc.documentElement.lang.toLowerCase().startsWith('en');
  card=doc.createElement('section');card.id='startup-recovery-message';card.setAttribute('role','status');
  card.style.cssText='position:fixed;z-index:10000;top:12vh;left:12px;right:12px;box-sizing:border-box;max-width:32rem;max-height:76vh;overflow:auto;margin:0 auto;padding:24px;background:#24271f;color:#f2eadb;border:1px solid #69705b;border-radius:10px;font:16px/1.6 Arial,sans-serif';
  const title=doc.createElement('h1');title.textContent=english?'TRAUMA TEAM':'创伤小组';title.style.cssText='font-size:20px;margin:0 0 12px';
  const message=doc.createElement('p');message.textContent=english?'The interface has not finished loading. You can retry loading the page.':'界面尚未完成加载，可以重试加载页面。';
  const retry=doc.createElement('button');retry.type='button';retry.textContent=english?'RETRY LOADING':'重试加载';
  retry.style.cssText='min-height:44px;padding:10px 18px;background:#d98735;color:#191b16;border:1px solid #edb26a;border-radius:8px;font:700 14px Arial,sans-serif;cursor:pointer';
  retry.addEventListener('click',()=>host.location.reload());
  card.append(title,message,retry);doc.body.append(card);
 };
 const onError=event=>{if(event.target?.tagName==='SCRIPT'||event.error)show();};
 const onRejection=()=>show();
 observer.observe(root,{childList:true});
 host.addEventListener('error',onError,true);
 host.addEventListener('unhandledrejection',onRejection);
 timer=host.setTimeout(show,timeoutMs);
 return finish;
}
