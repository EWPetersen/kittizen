import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activityWeight,heatField,heatPixels,HALF_LIFE,MAX_AGE} from '../public/heatmap.js';
const now=100000,report={kind:'Pirates',created:now};
test('fresh heat halves every thirty minutes',()=>{assert.equal(activityWeight(report,now),1);assert.equal(activityWeight(report,now+HALF_LIFE),.5);assert.equal(activityWeight(report,now+2*HALF_LIFE),.25);});
test('two-hour expiration is absolute even after a new verification',()=>{assert.ok(activityWeight(report,now+MAX_AGE-1)>0);assert.equal(activityWeight({...report,lastVerified:now+MAX_AGE},now+MAX_AGE),0);});
test('Clear, unknown and malformed reports cannot create danger heat',()=>{for(const kind of ['Clear','unknown'])assert.equal(activityWeight({...report,kind},now),0);assert.equal(activityWeight({...report,created:'bad'},now),0);assert.equal(activityWeight({...report,created:now+60},now),1);});
test('overlapping independent reports add intensity',()=>{const a={x:40,y:40,weight:1},single=heatField([a],80,80),double=heatField([a,a],80,80);const index=10*single.width+10;assert.ok(double.field[index]>single.field[index]);assert.ok(heatPixels(double.field)[index*4+3]>heatPixels(single.field)[index*4+3]);});
test('old heat fades on an absolute scale without peak normalization',()=>{const fresh=heatField([{x:40,y:40,weight:1}],80,80),old=heatField([{x:40,y:40,weight:.125}],80,80),index=10*fresh.width+10;assert.ok(heatPixels(old.field)[index*4+3]<heatPixels(fresh.field)[index*4+3]);});
test('invalid and offscreen points remain bounded and empty areas transparent',()=>{const result=heatField([{x:NaN,y:5,weight:1},{x:-10000,y:-10000,weight:2}],390,844);assert.equal(result.field.length,Math.ceil(390/4)*Math.ceil(844/4));assert.ok(heatPixels(result.field).every((v,i)=>i%4!==3||v===0));});

test('same-location report counts strengthen rendered heat until color saturation',()=>{
 const samples=[1,2,3,5,10,50,200].map(count=>{
  const points=Array.from({length:count},()=>({x:40,y:40,weight:activityWeight(report,now)}));
  const heat=heatField(points,80,80),index=10*heat.width+10,pixels=heatPixels(heat.field);
  assert.equal(heat.field[index],count);
  return {count,alpha:pixels[index*4+3],green:pixels[index*4+1]};
 });
 for(let i=1;i<samples.length;i++){
  assert.ok(samples[i].alpha>=samples[i-1].alpha);
  assert.ok(samples[i].green<=samples[i-1].green);
  if(samples[i].count<=5)assert.ok(samples[i].alpha>samples[i-1].alpha);
 }
 assert.equal(samples.at(-1).alpha,210);
});
test('expired and clear reports at a hotspot add no heat',()=>{
 const reports=[report,{...report,kind:'Clear'},{...report,created:now-MAX_AGE}];
 const points=reports.map(r=>({x:40,y:40,weight:activityWeight(r,now)}));
 const heat=heatField(points,80,80);
 assert.equal(heat.field[10*heat.width+10],1);
});
