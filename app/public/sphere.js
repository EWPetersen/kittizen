// Map the game's equirectangular starmap texture onto an orthographic globe.
// Work happens only after a texture arrives or the camera rotates. Zoom/pan
// reuse the cached 256px image; there is no idle animation or GPU dependency.
export function inverseRotate(q, v) {
  let [w, x, y, z] = q || [1, 0, 0, 0];
  const length = Math.hypot(w, x, y, z);
  w /= length;
  x /= -length;
  y /= -length;
  z /= -length;
  const [a, b, c] = v, tx = 2 * (y * c - z * b), ty = 2 * (z * a - x * c), tz = 2 * (x * b - y * a);
  return [a + w * tx + y * tz - z * ty, b + w * ty + z * tx - x * tz, c + w * tz + x * ty - y * tx];
}

export function globePixels(texture, rotation, yaw, pitch, size = 256) {
  const pixels = new Uint8ClampedArray(size * size * 4);
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    sp = Math.sin(pitch),
    cp = Math.cos(pitch);
  const right = inverseRotate(rotation, [cy, -sy, 0]);
  const down = inverseRotate(rotation, [sy * sp, cy * sp, -cp]);
  const front = inverseRotate(rotation, [sy * cp, cy * cp, sp]);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = (x + .5) * 2 / size - 1,
        v = (y + .5) * 2 / size - 1,
        r2 = u * u + v * v;
      if (r2 > 1) continue;
      const depth = Math.sqrt(1 - r2);
      const local = [u * right[0] + v * down[0] + depth * front[0], u * right[1] + v * down[1] + depth * front[1], u * right[2] + v * down[2] + depth * front[2]];
      const tx = Math.min(texture.width - 1, Math.floor(((Math.atan2(local[1], local[0]) / (Math.PI * 2) + .5) % 1 + 1) % 1 * texture.width));
      const ty = Math.min(texture.height - 1, Math.max(0, Math.floor((.5 - Math.asin(Math.max(-1, Math.min(1, local[2]))) / Math.PI) * texture.height)));
      const source = (ty * texture.width + tx) * 4,
        target = (y * size + x) * 4;
      const light = .57 + .43 * Math.max(0, -u * .28 - v * .32 + depth * .82);
      for (let channel = 0; channel < 3; channel++) pixels[target + channel] = texture.data[source + channel] * light;
      pixels[target + 3] = Math.min(255, (1 - r2) * size * 150);
    }
  return pixels;
}

export class GlobeTextures {
  constructor(invalidate) {
    this.invalidate = invalidate;
    this.sources = new Map();
    this.cache = new Map();
    this.failures = [];
  }
  get(body, yaw, pitch, size = 256) {
    if (!body.texture) return null;
    if (!this.sources.has(body.texture)) {
      this.sources.set(body.texture, null);
      const image = new Image();
      image.onload = () => {
        const c = document.createElement('canvas');
        c.width = image.width;
        c.height = image.height;
        const ctx = c.getContext('2d', {
          willReadFrequently: true
        });
        ctx.drawImage(image, 0, 0);
        this.sources.set(body.texture, ctx.getImageData(0, 0, c.width, c.height));
        this.invalidate();
      };
      image.onerror = () => {
        this.failures.push(body.name);
        this.invalidate();
      };
      image.src = body.texture;
    }
    const source = this.sources.get(body.texture);
    if (!source) return null;
    const key = body.texture + ':' + yaw.toFixed(2) + ':' + pitch.toFixed(2) + ':' + size,
      old = this.cache.get(body.id);
    if (old?.key === key) return old.canvas;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.getContext('2d').putImageData(new ImageData(globePixels(source, body.rotation, yaw, pitch, size), size, size), 0, 0);
    this.cache.set(body.id, {
      key,
      canvas
    });
    return canvas;
  }
}
