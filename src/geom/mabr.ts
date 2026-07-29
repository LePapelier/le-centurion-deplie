import type { Vec2 } from '../types';
import { cross2, sub2 } from './vec2';

/** Andrew monotone chain convex hull, CCW, no duplicate endpoint. */
export function convexHull(pts: Vec2[]): Vec2[] {
  const s = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  if (s.length <= 2) return s;
  const lower: Vec2[] = [];
  for (const p of s) {
    while (lower.length >= 2 && cross2(sub2(lower[lower.length - 1], lower[lower.length - 2]), sub2(p, lower[lower.length - 2])) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (let i = s.length - 1; i >= 0; i--) {
    const p = s[i];
    while (upper.length >= 2 && cross2(sub2(upper[upper.length - 1], upper[upper.length - 2]), sub2(p, upper[upper.length - 2])) <= 0)
      upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Minimum-area bounding rectangle via edge-aligned sweep over the hull.
 * Returns the rotation angle to apply to the points so the MABR becomes
 * axis-aligned, plus its dimensions at that angle.
 */
export function minAreaRect(pts: Vec2[]): { angle: number; width: number; height: number } {
  const hull = convexHull(pts);
  if (hull.length === 0) return { angle: 0, width: 0, height: 0 };
  if (hull.length === 1) return { angle: 0, width: 0, height: 0 };

  let best = { angle: 0, width: Infinity, height: Infinity };
  let bestArea = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const edgeAngle = Math.atan2(b.y - a.y, b.x - a.x);
    const c = Math.cos(-edgeAngle);
    const s = Math.sin(-edgeAngle);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of hull) {
      const x = c * p.x - s * p.y;
      const y = s * p.x + c * p.y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const w = maxX - minX;
    const h = maxY - minY;
    if (w * h < bestArea) {
      bestArea = w * h;
      best = { angle: -edgeAngle, width: w, height: h };
    }
  }
  return best;
}
