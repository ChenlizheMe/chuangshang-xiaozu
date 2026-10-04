// Choose once at startup. Mobile browsers without capability APIs also get
// the light atlas, without first downloading the heavy one.
export function renderProfile({mobile=false,memory=8,cores=8,saveData=false}={}){
 const light=mobile||saveData||memory<=4||cores<=4;
 return {light,maxDpr:light?1:1.5,idleFps:light?12:24,workers:light?1:2};
}
