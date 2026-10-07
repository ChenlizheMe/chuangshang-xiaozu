export const routeFromHash=hash=>hash==='#/about'?'about':'assessment';
export function bindRouteChanges(host,onRoute){
 const update=()=>onRoute(routeFromHash(host.location.hash));
 host.addEventListener('hashchange',update);
 return()=>host.removeEventListener('hashchange',update);
}
