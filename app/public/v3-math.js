// Pure, bounded planning functions. No store-price or game-runtime assumptions.
export function tradeMargin({units,buy,sell,expenses=0,minutes}){
 if(![units,buy,sell,expenses,minutes].every(Number.isFinite)||units<0||buy<0||sell<0||expenses<0||minutes<=0)throw Error('Use non-negative values and a positive trip duration');
 const capital=units*buy,profit=units*(sell-buy)-expenses;
 return {capital,revenue:units*sell,profit,perHour:profit*60/minutes,roi:capital?profit/capital*100:null};
}
export function upgradePath(start,target,quotes,{cashOnly=false,maxSpend=Infinity}={}){
 if(!start||!target||!Array.isArray(quotes)||quotes.length>200)throw Error('Invalid upgrade graph');
 if(start===target)return {cost:0,steps:[]};
 const edges=quotes.filter(q=>q&&q.from&&q.to&&q.from!==q.to&&Number.isFinite(q.cost)&&q.cost>=0&&q.available!==false&&(!cashOnly||q.payment!=='credit'));
 const distances=new Map([[start,0]]),previous=new Map(),visited=new Set();
 for(let n=0;n<=edges.length+1;n++){
  const next=[...distances].filter(([id])=>!visited.has(id)).sort((a,b)=>a[1]-b[1])[0];if(!next)break;const [id,cost]=next;if(id===target)break;visited.add(id);
  for(const edge of edges.filter(e=>e.from===id)){const total=cost+edge.cost;if(total<=maxSpend&&total<(distances.get(edge.to)??Infinity)){distances.set(edge.to,total);previous.set(edge.to,edge);}}
 }
 if(!distances.has(target))return null;const steps=[];let id=target;while(id!==start){const edge=previous.get(id);if(!edge||steps.length>edges.length)throw Error('Invalid chain');steps.unshift(edge);id=edge.from;}
 return {cost:distances.get(target),steps};
}
