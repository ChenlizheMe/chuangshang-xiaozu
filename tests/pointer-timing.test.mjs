// Controlled native/processing timestamps; not a real device latency benchmark.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPointerSelection} from '../src/pointerSelection.js';
const event=timeStamp=>({pointerId:1,clientX:10,clientY:20,button:0,timeStamp});
const tap=(stamps,processed)=>{
 let time=processed[0],samples=0;
 const selection=createPointerSelection({now:()=>{samples++;return time;}});
 const down=typeof stamps[0]==='object'&&stamps[0]!==null?stamps[0]:event(stamps[0]);
 const up=typeof stamps[1]==='object'&&stamps[1]!==null?stamps[1]:event(stamps[1]);
 selection.down(down);selection.begin(down,'part');time=processed[1];
 const selected=selection.end(up)==='part';
 assert.equal(samples,2,'one processing sample per endpoint, including suppression and acceptance');
 assert.equal(selection.canApproximate({type:'click',button:0,detail:1}),selected,'near-miss fallback obeys the same duration');
 return selected;
};

test('queued short taps and compressed long-press callbacks use native duration',()=>{
 assert.equal(tap([1000,1120],[1002,1850]),true);
 assert.equal(tap([1000,1600],[1800,1802]),false);
 assert.equal(tap([1000,1120],[1800,1802]),true);
 assert.equal(tap([1000,1600],[1002,1602]),false);
});
test('the inclusive 520ms boundary and repeated positive coarse timestamps stay stable',()=>{
 for(const duration of [519.9,520,520.001])assert.equal(tap([1000,1000+duration],[1002,1900]),duration<=520);
 assert.equal(tap([1000,1000],[1001,1700]),true);
 assert.equal(tap([1000.1,1120.1],[1002,1850]),true);
});
test('missing, zero, invalid and epoch timestamps fall back as a complete pair',()=>{
 for(const invalid of [undefined,0,null,NaN,Infinity,-Infinity,-1,'1000',1770000000000]){
  assert.equal(tap([invalid,1120],[1002,1850]),false,`invalid down: ${String(invalid)}`);
  assert.equal(tap([1000,invalid],[1002,1120]),true,`invalid up: ${String(invalid)}`);
 }
 assert.equal(tap([0,0],[1000,1700]),false);
 assert.equal(tap([undefined,undefined],[0,120]),true);
 assert.equal(tap([1770000000000,1770000000120],[1002,1850]),false);
 assert.equal(tap([1120,1000],[1200,1900]),false,'backward native pair');
 assert.equal(tap([1000.1,1120],[1000,1850]),false,'future-looking value conservatively falls back');
});
test('R3F uses the original native event and does not rescue an invalid native timestamp from its wrapper',()=>{
 assert.equal(tap([{...event(999999),nativeEvent:event(1000)},{...event(999999),nativeEvent:event(1120)}],[1002,1850]),true);
 assert.equal(tap([{...event(1000),nativeEvent:event(undefined)},{...event(1120),nativeEvent:event(1120)}],[1002,1850]),false);
});
test('invalid or backward processing fallback cannot become a short tap',()=>{
 for(const processed of [[200,100],[100,NaN],[100,Infinity]])assert.equal(tap([undefined,undefined],processed),false);
});
test('deferred outside cleanup measures the original release and keeps the next gesture',()=>{
 let time=1002;const p=createPointerSelection({now:()=>time});p.down(event(1000));p.begin(event(1000),'old');const token=p.token(1);
 time=2300;p.finishOutside(event(1120),token);
 assert.ok(p.canApproximate({type:'click',button:0,detail:1}),'cleanup delay is not a long press');
 p.down(event(2250));p.begin(event(2250),'new');p.finishOutside(event(1120),token);
 time=2350;assert.equal(p.end(event(2330)),'new');
});
test('native release rejects a long near-miss before deferred cleanup or click routing',()=>{
 let time=1002;const p=createPointerSelection({now:()=>time});p.down(event(1000));const token=p.token(1);
 time=1950;p.release(event(1900));assert.equal(p.token(1),token,'release leaves cleanup ownership intact');
 assert.equal(p.canApproximate({type:'click',button:0,detail:1}),false);
 p.finishOutside(event(1900),token);assert.equal(p.canApproximate({type:'click',button:0,detail:1}),false);
 time=2002;p.down(event(2000));time=2150;p.release(event(2120));assert.equal(p.canApproximate({type:'click',button:0,detail:1}),true);
});
test('native release preserves an exact tap and samples the endpoint only once',()=>{
 let time=1002,samples=0;const p=createPointerSelection({now:()=>{samples++;return time;}});
 p.down(event(1000));p.begin(event(1000),'part');time=1850;p.release(event(1120));
 time=2200;assert.equal(p.end({...event(99999),nativeEvent:event(1120)}),'part');assert.equal(samples,2);
 assert.equal(p.end(event(1120)),null,'one physical tap cannot be consumed twice');
});
