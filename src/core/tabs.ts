import type { Island, Mesh, MeshTopology, Vec2 } from '../types';
import { convexOverlap } from './overlap';
import { meshDiagonal } from './unfold';
import { polygonArea, v2 } from '../geom/vec2';

/**
 * Generate glue tabs and matching numbered labels on cut edges.
 * Each interior cut edge appears on exactly two face sides; the side living
 * in the smaller island id (or the f0 side within one island) carries the
 * trapezoid tab, the mate side only prints the shared number.
 * A tab colliding with the island's own faces or a previously accepted tab
 * is retried steeper/shallower, then dropped (number kept: butt-glue).
 */
export function generateTabs(
  mesh: Mesh,
  topology: MeshTopology,
  islands: Island[],
  faceIsland: Int32Array,
  tabDepthUnits: number,
): void {
  const tol = 1e-7 * meshDiagonal(mesh);
  const { edges, faceEdges } = topology;

  // per island: face2d lookup + corner of each (face, edge)
  const face2dOf = new Map<number, { island: Island; pts: [Vec2, Vec2, Vec2] }>();
  for (const island of islands) {
    for (const f2d of island.faces) face2dOf.set(f2d.faceId, { island, pts: f2d.pts });
  }
  const cornerOfEdge = (f: number, edgeId: number): number => {
    for (let k = 0; k < 3; k++) if (faceEdges[3 * f + k] === edgeId) return k;
    return -1;
  };

  const cutEdges = edges.filter((e) => e.kind === 'cut' && e.f1 !== -1).sort((a, b) => a.id - b.id);

  let label = 0;
  for (const e of cutEdges) {
    label++;
    const i0 = faceIsland[e.f0];
    const i1 = faceIsland[e.f1];
    const ownerFace = i0 === i1 ? e.f0 : i0 < i1 ? e.f0 : e.f1;
    const mateFace = ownerFace === e.f0 ? e.f1 : e.f0;

    for (const [face, ownsTab] of [
      [ownerFace, true],
      [mateFace, false],
    ] as const) {
      const entry = face2dOf.get(face)!;
      const k = cornerOfEdge(face, e.id);
      const p = entry.pts[k];
      const q = entry.pts[(k + 1) % 3];
      entry.island.labels.push({ edgeId: e.id, label, faceId: face, seg: [p, q], ownsTab });
      if (!ownsTab) continue;

      const face2d = entry.island.faces.find((f2) => f2.faceId === face)!;
      const quad = fitTab(entry.island, p, q, face2d.pts, tabDepthUnits, tol);
      if (quad) {
        entry.island.tabs.push({
          edgeId: e.id,
          label,
          quad,
          base: [p, q],
          foldKind: e.dihedral >= 0 ? 'mountain' : 'valley',
        });
      }
    }
  }
}

/**
 * Trapezoid on the outside of the face across segment p→q. The outward
 * normal is chosen geometrically — away from the face centroid — so a face
 * whose winding survived un-oriented (open non-orientable patches) still
 * gets its tab on the correct side.
 * Tries 45° base angles at full depth, then 60°, then half depth; null if
 * every attempt collides.
 */
function fitTab(
  island: Island,
  p: Vec2,
  q: Vec2,
  facePts: [Vec2, Vec2, Vec2],
  depth: number,
  tol: number,
): Vec2[] | null {
  const L = Math.hypot(q.x - p.x, q.y - p.y);
  if (L < tol * 10) return null;
  const d = v2((q.x - p.x) / L, (q.y - p.y) / L);
  let n = v2(-d.y, d.x);
  // point away from the face centroid = outside
  const cx = (facePts[0].x + facePts[1].x + facePts[2].x) / 3 - (p.x + q.x) / 2;
  const cy = (facePts[0].y + facePts[1].y + facePts[2].y) / 3 - (p.y + q.y) / 2;
  if (n.x * cx + n.y * cy > 0) n = v2(d.y, -d.x);

  const attempts: [number, number][] = [
    [Math.min(depth, 0.4 * L), 1], // 45°: inset = h
    [Math.min(depth, 0.4 * L), 0.577], // 60°: inset = h / tan(60°)
    [Math.min(depth / 2, 0.25 * L), 1],
  ];

  for (const [h, insetRatio] of attempts) {
    const inset = h * insetRatio;
    if (2 * inset >= L) continue;
    const quad = [
      v2(p.x, p.y),
      v2(p.x + inset * d.x + h * n.x, p.y + inset * d.y + h * n.y),
      v2(q.x - inset * d.x + h * n.x, q.y - inset * d.y + h * n.y),
      v2(q.x, q.y),
    ];
    if (Math.abs(polygonArea(quad)) < tol * tol) continue;
    if (!collides(island, quad, tol)) return quad;
  }
  return null;
}

function collides(island: Island, quad: Vec2[], tol: number): boolean {
  for (const f2d of island.faces) {
    if (convexOverlap(quad, f2d.pts, tol)) return true;
  }
  for (const tab of island.tabs) {
    if (convexOverlap(quad, tab.quad, tol)) return true;
  }
  return false;
}
