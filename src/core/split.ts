import type { Island, Mesh, MeshTopology } from '../types';
import { faceArea3D } from './unfold';

/**
 * Pick the fold/flat edge of the island whose removal splits its spanning
 * subtree into the two most balanced halves (by 3D face area). Returns the
 * edge id, or -1 if the island cannot be split (single face).
 */
export function chooseSplitEdge(mesh: Mesh, topology: MeshTopology, island: Island): number {
  const { edges, faceEdges } = topology;
  const inIsland = new Set(island.faces.map((f) => f.faceId));
  if (inIsland.size < 2) return -1;

  // BFS tree over fold/flat edges, rooted at the island root
  const parentEdge = new Map<number, number>(); // face -> edge id toward parent
  const children = new Map<number, number[]>(); // face -> child faces
  const order: number[] = [island.rootFace];
  const seen = new Set([island.rootFace]);
  for (let i = 0; i < order.length; i++) {
    const f = order[i];
    for (let k = 0; k < 3; k++) {
      const e = edges[faceEdges[3 * f + k]];
      if (e.kind !== 'fold' && e.kind !== 'flat') continue;
      const other = e.f0 === f ? e.f1 : e.f0;
      if (other === -1 || seen.has(other) || !inIsland.has(other)) continue;
      seen.add(other);
      parentEdge.set(other, e.id);
      let list = children.get(f);
      if (!list) {
        list = [];
        children.set(f, list);
      }
      list.push(other);
      order.push(other);
    }
  }

  // subtree areas bottom-up
  const subArea = new Map<number, number>();
  for (let i = order.length - 1; i >= 0; i--) {
    const f = order[i];
    let a = faceArea3D(mesh, f);
    for (const c of children.get(f) ?? []) a += subArea.get(c)!;
    subArea.set(f, a);
  }

  const total = subArea.get(island.rootFace)!;
  let bestEdge = -1;
  let bestDiff = Infinity;
  for (const [face, edgeId] of parentEdge) {
    const diff = Math.abs(subArea.get(face)! - total / 2);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestEdge = edgeId;
    }
  }
  return bestEdge;
}
