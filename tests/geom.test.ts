import { describe, expect, it } from 'vitest';
import { convexHull, minAreaRect } from '../src/geom/mabr';
import { trianglesOverlap } from '../src/core/overlap';
import { v2 } from '../src/geom/vec2';

describe('convex hull + MABR', () => {
  it('hull of a square with interior points', () => {
    const pts = [v2(0, 0), v2(2, 0), v2(2, 2), v2(0, 2), v2(1, 1), v2(0.5, 1.2)];
    expect(convexHull(pts)).toHaveLength(4);
  });

  it('MABR of a rotated rectangle recovers its dimensions', () => {
    const a = Math.PI / 6;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const rect = [v2(0, 0), v2(4, 0), v2(4, 2), v2(0, 2)].map((p) => v2(c * p.x - s * p.y, s * p.x + c * p.y));
    const r = minAreaRect(rect);
    const dims = [r.width, r.height].sort((x, y) => x - y);
    expect(dims[0]).toBeCloseTo(2, 9);
    expect(dims[1]).toBeCloseTo(4, 9);
  });
});

describe('SAT triangle overlap', () => {
  const t1: [never, never, never] = [v2(0, 0), v2(2, 0), v2(0, 2)] as never;

  it('detects interior overlap', () => {
    const t2 = [v2(0.5, 0.5), v2(2.5, 0.5), v2(0.5, 2.5)] as never;
    expect(trianglesOverlap(t1, t2, 1e-9)).toBe(true);
  });

  it('ignores shared-edge contact', () => {
    const t2 = [v2(2, 0), v2(0, 2), v2(2.5, 2.5)] as never;
    expect(trianglesOverlap(t1, t2, 1e-9)).toBe(false);
  });

  it('ignores shared-vertex contact', () => {
    const t2 = [v2(2, 0), v2(3, 0), v2(2, 1)] as never;
    expect(trianglesOverlap(t1, t2, 1e-9)).toBe(false);
  });

  it('separated triangles do not overlap', () => {
    const t2 = [v2(5, 5), v2(6, 5), v2(5, 6)] as never;
    expect(trianglesOverlap(t1, t2, 1e-9)).toBe(false);
  });
});
