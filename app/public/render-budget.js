// Explicit decoded-image/raster budgets; network files remain browser-cached.
export const SOURCE_BYTES=24*1024*1024,RASTER_BYTES=8*1024*1024;
export function touch(cache,key){const value=cache.get(key);if(value){cache.delete(key);cache.set(key,value);}return value;}
export function trimCache(cache,budget,bytes){
  let total=0;for(const value of cache.values())total+=bytes(value);
  for(const [key,value] of cache){if(total<=budget)break;const size=bytes(value);if(size){cache.delete(key);total-=size;}}
  return total;
}
export function globeResolution(radius,moving,viewportWidth,viewport=false){
  if(viewport)return moving?112:viewportWidth<600?256:384;
  if(radius<20)return 48;if(radius<60)return 96;
  return moving?144:radius>150?(viewportWidth<600?384:512):192;
}
export function modelResolution(projectedSize,moving,viewportWidth){return projectedSize<30?128:moving?160:projectedSize<180?256:projectedSize<360?384:viewportWidth<600?384:768;}
