// React.lazy retains a rejected module promise. Resetting the GLB cache or
// error boundary cannot repair that same lazy object in the current document.
export function createViewerModule(load){
 let loaded=null;
 return {
  async load(){
   try {loaded=await load();return loaded;}
   catch(cause){const error=new Error(typeof cause?.message==='string'?cause.message:String(cause));error.code='ANATOMY_MODULE_LOAD_FAILED';error.cause=cause;throw error;}
  },
  retry(layer,reset,reload){
   if(!loaded){reload();return;}
   // The module is already available; retry only the selected model resource.
   loaded.clearAnatomyCache(layer);reset();
  }
 };
}
