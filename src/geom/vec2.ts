import type { Vec2 } from '../types';

export const v2 = (x: number, y: number): Vec2 => ({ x, y });

export const sub2 = (a: Vec2, b: Vec2): Vec2 => v2(a.x - b.x, a.y - b.y);
export const add2 = (a: Vec2, b: Vec2): Vec2 => v2(a.x + b.x, a.y + b.y);
export const scale2 = (a: Vec2, s: number): Vec2 => v2(a.x * s, a.y * s);
export const dot2 = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const cross2 = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
export const len2 = (a: Vec2): number => Math.hypot(a.x, a.y);
export const dist2 = (a: Vec2, b: Vec2): number => len2(sub2(a, b));
export const norm2 = (a: Vec2): Vec2 => {
  const l = len2(a);
  return l > 0 ? scale2(a, 1 / l) : v2(0, 0);
};
/** rotate +90° (counterclockwise) */
export const perp2 = (a: Vec2): Vec2 => v2(-a.y, a.x);
export const rot2 = (a: Vec2, angle: number): Vec2 => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return v2(c * a.x - s * a.y, s * a.x + c * a.y);
};
export const midpoint2 = (a: Vec2, b: Vec2): Vec2 => v2((a.x + b.x) / 2, (a.y + b.y) / 2);

/** signed area of a polygon (positive = CCW) */
export const polygonArea = (pts: Vec2[]): number => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += cross2(a, b);
  }
  return s / 2;
};
