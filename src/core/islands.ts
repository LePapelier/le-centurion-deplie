import type { DrawnEdge, Island, Mesh, MeshTopology } from '../types';
import { TriangleGrid } from './overlap';
import { faceArea3D, medianEdgeLength, meshDiagonal, placeChildFace, placeRootFace } from './unfold';

/**
 * Unfold the spanning forest into 2D islands. Overlap is tested incrementally
 * while placing each face; on overlap the connecting tree edge is reclassified
 * as 'cut' and the child face seeds a new island (its subtree follows).
 */
export function buildIslands(
  mesh: Mesh,
  topology: MeshTopology,
): { islands: Island[]; faceIsland: Int32Array } {
  const faceCount = mesh.faces.length / 3;
  const { edges, faceEdges } = topology;
  const tol = 1e-7 * meshDiagonal(mesh);
  const cellSize = medianEdgeLength(topology);

  const placed = new Uint8Array(faceCount);
  const faceIsland = new Int32Array(faceCount).fill(-1);
  const islands: Island[] = [];

  const byAreaDesc = Array.from({ length: faceCount }, (_, f) => f).sort(
    (a, b) => faceArea3D(mesh, b) - faceArea3D(mesh, a),
  );
  let seedPtr = 0;
  const rootQueue: number[] = [];

  const nextRoot = (): number => {
    while (rootQueue.length > 0) {
      const f = rootQueue.shift()!;
      if (!placed[f]) return f;
    }
    while (seedPtr < byAreaDesc.length) {
      const f = byAreaDesc[seedPtr++];
      if (!placed[f]) return f;
    }
    return -1;
  };

  for (let root = nextRoot(); root !== -1; root = nextRoot()) {
    const island: Island = {
      id: islands.length,
      rootFace: root,
      faces: [placeRootFace(mesh, root)],
      drawnEdges: [],
      tabs: [],
      labels: [],
      placement: { page: 0, x: 0, y: 0, rotation: 0 },
    };
    placed[root] = 1;
    faceIsland[root] = island.id;
    const grid = new TriangleGrid(cellSize);
    grid.add(island.faces[0].pts);

    const queue: number[] = [0]; // indices into island.faces
    for (let qi = 0; qi < queue.length; qi++) {
      const face2d = island.faces[queue[qi]];
      const f = face2d.faceId;
      for (let k = 0; k < 3; k++) {
        const e = edges[faceEdges[3 * f + k]];
        if (e.kind !== 'fold' && e.kind !== 'flat') continue;
        const child = e.f0 === f ? e.f1 : e.f0;
        if (child === -1 || placed[child]) continue;

        const sharedV0 = mesh.faces[3 * f + k];
        const sharedV1 = mesh.faces[3 * f + ((k + 1) % 3)];
        const child2d = placeChildFace(
          mesh,
          child,
          sharedV0,
          sharedV1,
          face2d.pts[k],
          face2d.pts[(k + 1) % 3],
          face2d.pts[(k + 2) % 3],
        );

        if (grid.overlapsAny(child2d.pts, tol)) {
          e.kind = 'cut';
          rootQueue.push(child);
        } else {
          placed[child] = 1;
          faceIsland[child] = island.id;
          grid.add(child2d.pts);
          queue.push(island.faces.length);
          island.faces.push(child2d);
        }
      }
    }
    islands.push(island);
  }

  for (const island of islands) {
    island.drawnEdges = collectDrawnEdges(topology, island);
  }

  return { islands, faceIsland };
}

function collectDrawnEdges(topology: MeshTopology, island: Island): DrawnEdge[] {
  const { edges, faceEdges } = topology;
  const out: DrawnEdge[] = [];
  for (const face2d of island.faces) {
    const f = face2d.faceId;
    for (let k = 0; k < 3; k++) {
      const e = edges[faceEdges[3 * f + k]];
      if (e.kind === 'flat') continue;
      if (e.kind === 'fold') {
        if (e.f0 !== f) continue; // draw fold lines once
        out.push({
          edgeId: e.id,
          kind: e.dihedral >= 0 ? 'mountain' : 'valley',
          a: face2d.pts[k],
          b: face2d.pts[(k + 1) % 3],
        });
      } else {
        // cut or boundary: each face incidence draws its own side
        out.push({ edgeId: e.id, kind: 'cut', a: face2d.pts[k], b: face2d.pts[(k + 1) % 3] });
      }
    }
  }
  return out;
}
