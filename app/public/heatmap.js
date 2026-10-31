// Absolute intensity avoids keeping old activity bright through normalization.
// Confirmations do not extend the two-hour report lifetime.
export const HALF_LIFE = 30 * 60;
export const MAX_AGE = 2 * 60 * 60;
export function activityWeight(report, now = Date.now() / 1000) {
  const age = Math.max(0, now - Number(report.created));
  const severity = {Interdiction: 1, Pirates: 1, Suspicious: .6}[report.kind] || 0;
  return Number.isFinite(age) && age < MAX_AGE ? severity * 2 ** (-age / HALF_LIFE) : 0;
}
export function heatField(points, width, height, cell = 4, radius = 48) {
  const w = Math.max(1, Math.ceil(width / cell)), h = Math.max(1, Math.ceil(height / cell));
  const field = new Float32Array(w * h), sigma = radius / cell / 3, reach = Math.ceil(sigma * 3);
  for (const p of points) {
    if (![p.x,p.y,p.weight].every(Number.isFinite) || p.weight <= 0) continue;
    const x = p.x / cell, y = p.y / cell;
    for (let iy=Math.max(0,Math.floor(y-reach));iy<=Math.min(h-1,Math.ceil(y+reach));iy++)
      for (let ix=Math.max(0,Math.floor(x-reach));ix<=Math.min(w-1,Math.ceil(x+reach));ix++) {
        const distance=(ix-x)**2+(iy-y)**2;
        if(distance<=reach*reach)field[iy*w+ix]+=p.weight*Math.exp(-distance/(2*sigma*sigma));
      }
  }
  return {field,width:w,height:h};
}
export function heatPixels(field) {
  const pixels=new Uint8ClampedArray(field.length*4);
  for(let i=0;i<field.length;i++){
    const intensity=1-Math.exp(-Math.max(0,field[i])*.8);
    pixels[i*4]=255;pixels[i*4+1]=Math.round(210*(1-intensity));pixels[i*4+2]=35;
    pixels[i*4+3]=Math.round(intensity*210);
  }
  return pixels;
}
