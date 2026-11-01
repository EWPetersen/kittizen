import {test} from 'node:test';
import assert from 'node:assert/strict';
import {upgradePath,tradeMargin} from '../public/v3-math.js';
test('upgrade planner finds a cheaper multi-step chain and ignores cycles',()=>{
 const quotes=[{from:'A',to:'C',cost:80},{from:'A',to:'B',cost:20},{from:'B',to:'C',cost:30},{from:'B',to:'A',cost:0}];
 assert.equal(upgradePath('A','C',quotes).cost,50);assert.equal(upgradePath('A','C',quotes).steps.length,2);
 assert.equal(upgradePath('A','C',quotes,{maxSpend:49}),null);
});
test('unavailable and credit-only quotes obey constraints; zero-price owned upgrades work',()=>{
 const quotes=[{from:'A',to:'B',cost:0,payment:'credit'},{from:'B',to:'C',cost:15},{from:'A',to:'C',cost:4,available:false}];
 assert.equal(upgradePath('A','C',quotes).cost,15);assert.equal(upgradePath('A','C',quotes,{cashOnly:true}),null);
 assert.deepEqual(upgradePath('A','A',quotes),{cost:0,steps:[]});assert.equal(upgradePath('C','A',quotes),null);
});
test('trade calculator includes expenses, round-trip time and losses',()=>{
 assert.deepEqual(tradeMargin({units:32,buy:1000,sell:1300,expenses:1000,minutes:20}),{capital:32000,revenue:41600,profit:8600,perHour:25800,roi:26.875});
 assert.equal(tradeMargin({units:1,buy:100,sell:50,minutes:60}).profit,-50);
 assert.equal(tradeMargin({units:0,buy:0,sell:0,minutes:1}).roi,null);
 for(const minutes of [0,-1,NaN,Infinity])assert.throws(()=>tradeMargin({units:1,buy:1,sell:2,minutes}));
});
