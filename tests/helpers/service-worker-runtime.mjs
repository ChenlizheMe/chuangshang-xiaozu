import vm from 'node:vm';
export const origin = 'https://traumateam.cn';
export const html = body => new Response(body, {headers:{'content-type':'text/html'}});
export const js = body => new Response(body || 'export const ready = true', {headers:{'content-type':'application/javascript'}});
export const css = body => new Response(body || 'body{}', {headers:{'content-type':'text/css'}});
export const deferred = () => { let resolve,reject; const promise=new Promise((yes,no)=>{resolve=yes;reject=no;}); return {promise,resolve,reject}; };
export function browser(source,{scope='/',stores=new Map()}={}){
 const base = new URL(scope, origin).href;
 const normalize = request => new URL(typeof request === 'string' ? request : request.url,base).href;
 const listeners={}, background=[], calls=[], writes=[], deletes=[];
 const state={online:true,unavailable:false,quota:false,responses:new Map(),fetchHook:null,putHook:null,deleteHook:null,defaultResponse:null};
 const fetch = async request => {
  const url=normalize(request); calls.push(url);
  if(!state.online)throw new TypeError('Network unavailable');
  if(state.fetchHook){const result=await state.fetchHook(url);if(result!==undefined)return result;}
  const response=state.responses.get(url)||state.responses.get(new URL(url).pathname);
  if(response){if(response instanceof Error)throw response;return response.clone();}
  if(state.defaultResponse)return state.defaultResponse(url);
  return new Response('not found',{status:404,headers:{'content-type':'text/plain'}});
 };
 const caches={
  async open(name){
   if(state.unavailable)throw new Error('Storage unavailable');
   if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);
   return {
    async match(request){if(state.unavailable)throw new Error('Storage unavailable');return store.get(normalize(request))?.clone();},
    async put(request,response){const url=normalize(request);if(state.putHook)await state.putHook(name,url,response);if(state.unavailable)throw new Error('Storage unavailable');if(state.quota)throw new Error('Quota exceeded');writes.push({name,url});store.set(url,response.clone());},
    async delete(request){return store.delete(normalize(request));},
    async keys(){return [...store.keys()].map(url=>new Request(url));},
    async add(request){const response=await fetch(request);if(!response.ok)throw new TypeError('Cache add failed');await this.put(request,response);},
    async addAll(requests){const responses=await Promise.all(requests.map(request=>fetch(request)));if(responses.some(response=>!response.ok))throw new TypeError('Cache addAll failed');await Promise.all(requests.map((request,i)=>this.put(request,responses[i])));}
   };
  },
  async keys(){if(state.unavailable)throw new Error('Storage unavailable');return [...stores.keys()];},
  async delete(name){if(state.deleteHook)await state.deleteHook(name);deletes.push(name);return stores.delete(name);},
  async match(request){if(state.unavailable)throw new Error('Storage unavailable');for(const store of stores.values()){const response=store.get(normalize(request));if(response)return response.clone();}}
 };
 const workerState={claimed:false,skipWaiting:false};
 const self={location:new URL('sw.js',base),registration:{scope:base},clients:{claim:async()=>{workerState.claimed=true;},matchAll:async()=>[]},skipWaiting:async()=>{workerState.skipWaiting=true;},addEventListener:(type,handler)=>{listeners[type]=handler;}};
 vm.runInNewContext(source,{self,caches,fetch,URL,Request,Response,Map,Set,Promise,console,crypto:globalThis.crypto,setTimeout,clearTimeout});
 const lifecycle=async type=>{const tasks=[];listeners[type]({waitUntil:promise=>tasks.push(promise)});return await Promise.all(tasks);};
 const request=async(path,mode='cors')=>{let pending;listeners.fetch({request:{url:normalize(path),mode,method:'GET',headers:new Headers()},respondWith:promise=>{pending=promise;},waitUntil:promise=>{background.push(Promise.resolve(promise));}});return pending;};
 const flush=async()=>{while(background.length)await Promise.all(background.splice(0));};
 return {state,caches,stores,calls,writes,deletes,workerState,lifecycle,request,flush,base,normalize};
}
