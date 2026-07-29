import type { Face2D, Mesh, MeshTopology, Vec2 } from '../types';
import { cross2, dist2, sub2, v2 } from '../geom/vec2';
import { cross3, dist3, getVertex, len3, sub3 } from '../geom/vec3';

/**
 * Place the three vertices of a root face in 2D, isometrically to the 3D
 * lengths. The third vertex goes to negative y: in math (y-up) coords the
 * winding becomes CW, so on a y-down page (SVG/PDF) it displays CCW — the
 * printed side the user sees is the mesh OUTSIDE, and dihedral > 0 prints
 * as a mountain fold. Children inherit the mirroring via the opposite-side
 * rule, so the whole island is consistently oriented.
 */
export function placeRootFace(mesh: Mesh, faceId: number): Face2D {
  const a = getVertex(mesh.positions, mesh.faces[3 * faceId]);
  const b = getVertex(mesh.positions, mesh.faces[3 * faceId + 1]);
  const c = getVertex(mesh.positions, mesh.faces[3 * faceId + 2]);
  const ab = dist3(a, b);
  const ac = dist3(a, c);
  const bc = dist3(b, c);
  const x = (ab * ab + ac * ac - bc * bc) / (2 * ab);
  const y = Math.sqrt(Math.max(0, ac * ac - x * x));
  return { faceId, pts: [v2(0, 0), v2(ab, 0), v2(x, -y)] };
}

/**
 * Place a child face across the shared edge with an already-placed parent.
 * pShared/qShared: 2D coords of the two shared vertices (parent side);
 * sharedV0/sharedV1: their mesh vertex ids; opposite2D: parent's third
 * vertex, used to pick the side. All lengths come from 3D — exact isometry
 * per face, no error accumulation.
 */
export function placeChildFace(
  mesh: Mesh,
  faceId: number,
  sharedV0: number,
  sharedV1: number,
  pShared: Vec2,
  qShared: Vec2,
  opposite2D: Vec2,
): Face2D {
  const verts = [mesh.faces[3 * faceId], mesh.faces[3 * faceId + 1], mesh.faces[3 * faceId + 2]];
  const rIdx = verts.findIndex((vv) => vv !== sharedV0 && vv !== sharedV1);
  const R = getVertex(mesh.positions, verts[rIdx]);
  const P = getVertex(mesh.positions, sharedV0);
  const Q = getVertex(mesh.positions, sharedV1);

  const L = dist2(pShared, qShared);
  const aLen = dist3(P, R);
  const bLen = dist3(Q, R);
  const x = (L * L + aLen * aLen - bLen * bLen) / (2 * L);
  const h = Math.sqrt(Math.max(0, aLen * aLen - x * x));

  const d = v2((qShared.x - pShared.x) / L, (qShared.y - pShared.y) / L);
  const n = v2(-d.y, d.x);

  // parent's third vertex side relative to line p→q
  const sideParent = cross2(sub2(qShared, pShared), sub2(opposite2D, pShared));
  const sign = sideParent > 0 ? -1 : 1;

  const r2d = v2(pShared.x + x * d.x + sign * h * n.x, pShared.y + x * d.y + sign * h * n.y);

  const pts: [Vec2, Vec2, Vec2] = [v2(0, 0), v2(0, 0), v2(0, 0)];
  for (let k = 0; k < 3; k++) {
    if (verts[k] === sharedV0) pts[k] = pShared;
    else if (verts[k] === sharedV1) pts[k] = qShared;
    else pts[k] = r2d;
  }
  return { faceId, pts };
}

/** median 3D edge length — used as the overlap-grid cell size */
export function medianEdgeLength(topology: MeshTopology): number {
  const ls = topology.edges.map((e) => e.length).sort((a, b) => a - b);
  return ls.length ? ls[Math.floor(ls.length / 2)] : 1;
}

/** bounding-box diagonal of the mesh (tolerance scale) */
export function meshDiagonal(mesh: Mesh): number {
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const c = mesh.positions[i + k];
      if (c < min[k]) min[k] = c;
      if (c > max[k]) max[k] = c;
    }
  }
  return Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
}

/** 3D area of a face */
export function faceArea3D(mesh: Mesh, faceId: number): number {
  const a = getVertex(mesh.positions, mesh.faces[3 * faceId]);
  const b = getVertex(mesh.positions, mesh.faces[3 * faceId + 1]);
  const c = getVertex(mesh.positions, mesh.faces[3 * faceId + 2]);
  return len3(cross3(sub3(b, a), sub3(c, a))) / 2;
}
