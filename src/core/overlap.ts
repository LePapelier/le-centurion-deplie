import type { Vec2 } from '../types';

type Tri = [Vec2, Vec2, Vec2];

/**
 * SAT convex-polygon interior overlap. Contact along a shared edge or
 * vertex is NOT overlap: an axis with penetration depth <= tol separates.
 */
export function convexOverlap(a: Vec2[], b: Vec2[], tol: number): boolean {
  return !hasSeparatingAxis(a, b, tol) && !hasSeparatingAxis(b, a, tol);
}

export function trianglesOverlap(a: Tri, b: Tri, tol: number): boolean {
  return convexOverlap(a, b, tol);
}

function hasSeparatingAxis(a: Vec2[], b: Vec2[], tol: number): boolean {
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    const q = a[(i + 1) % a.length];
    // outward-agnostic edge normal, unit length so tol is metric
    let nx = -(q.y - p.y);
    let ny = q.x - p.x;
    const l = Math.hypot(nx, ny);
    if (l === 0) continue;
    nx /= l;
    ny /= l;
    let minA = Infinity, maxA = -Infinity;
    for (const v of a) {
      const d = v.x * nx + v.y * ny;
      if (d < minA) minA = d;
      if (d > maxA) maxA = d;
    }
    let minB = Infinity, maxB = -Infinity;
    for (const v of b) {
      const d = v.x * nx + v.y * ny;
      if (d < minB) minB = d;
      if (d > maxB) maxB = d;
    }
    const depth = Math.min(maxA, maxB) - Math.max(minA, minB);
    if (depth <= tol) return true;
  }
  return false;
}

/** Uniform grid over already-placed triangles of one island. */
export class TriangleGrid {
  private cells = new Map<string, number[]>();
  private tris: Tri[] = [];

  constructor(private cellSize: number) {}

  private *cellKeys(t: Tri): Generator<string> {
    const xs = [t[0].x, t[1].x, t[2].x];
    const ys = [t[0].y, t[1].y, t[2].y];
    const x0 = Math.floor(Math.min(...xs) / this.cellSize);
    const x1 = Math.floor(Math.max(...xs) / this.cellSize);
    const y0 = Math.floor(Math.min(...ys) / this.cellSize);
    const y1 = Math.floor(Math.max(...ys) / this.cellSize);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) yield `${cx},${cy}`;
    }
  }

  /** true if t overlaps any stored triangle (interior intersection) */
  overlapsAny(t: Tri, tol: number): boolean {
    const seen = new Set<number>();
    for (const key of this.cellKeys(t)) {
      const list = this.cells.get(key);
      if (!list) continue;
      for (const idx of list) {
        if (seen.has(idx)) continue;
        seen.add(idx);
        if (trianglesOverlap(t, this.tris[idx], tol)) return true;
      }
    }
    return false;
  }

  add(t: Tri): void {
    const idx = this.tris.length;
    this.tris.push(t);
    for (const key of this.cellKeys(t)) {
      let list = this.cells.get(key);
      if (!list) {
        list = [];
        this.cells.set(key, list);
      }
      list.push(idx);
    }
  }
}
