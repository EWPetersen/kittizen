export function positionOnRoute(plan, fraction) {
  if (!plan || !Number.isFinite(fraction) || fraction < 0 || fraction > 1) return null;
  const legs = plan.legs.filter(l => l.kind !== 'jump' && l.distance > 0);
  if (!legs.length) return null;
  const distance = fraction * plan.totalDistance,
    leg = legs.find(l => distance <= l.offset + l.distance) || legs.at(-1);
  const t = Math.max(0, Math.min(1, (distance - leg.offset) / leg.distance));
  return {
    position: leg.start.map((v, i) => v + (leg.end[i] - v) * t),
    system: leg.system,
    leg
  };
}
