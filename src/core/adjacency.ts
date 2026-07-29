import type { Edge, Mesh, MeshTopology } from '../types';
import { cross3, dot3, dist3, getVertex, norm3, sub3 } from '../geom/vec3';

/**
 * Build the edge table and face-adjacency structure.
 * - 1 incident face → boundary edge
 * - 2 incident faces → interior edge with signed dihedral
 * - >2 incident faces (non-manifold): the two faces with the flattest mutual
 *   dihedral stay paired, every other incidence becomes its own boundary edge.
 * Signed dihedral convention: positive = mountain (fold away from the viewer
 * when the printed side is the mesh outside), sign of dot(n0 × n1, edgeDir)
 * with edgeDir the edge as wound in f0.
 */
export function buildTopology(mesh: Mesh): MeshTopology {
  const faceCount = mesh.faces.length / 3;
  const warnings: string[] = [];

  const incidences = new Map<string, { face: number; corner: number }[]>();
  for (let f = 0; f < faceCount; f++) {
    for (let k = 0; k < 3; k++) {
      const a = mesh.faces[3 * f + k];
      const b = mesh.faces[3 * f + ((k + 1) % 3)];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      let list = incidences.get(key);
      if (!list) {
        list = [];
        incidences.set(key, list);
      }
      list.push({ face: f, corner: k });
    }
  }

  const normal = (f: number) =>
    ({ x: mesh.faceNormals[3 * f], y: mesh.faceNormals[3 * f + 1], z: mesh.faceNormals[3 * f + 2] });

  const edges: Edge[] = [];
  const faceEdges = new Int32Array(3 * faceCount).fill(-1);
  let nonManifoldCount = 0;

  const addEdge = (v0: number, v1: number, f0: number, c0: number, f1: number, c1: number) => {
    const id = edges.length;
    const p0 = getVertex(mesh.positions, v0);
    const p1 = getVertex(mesh.positions, v1);
    let dihedral = 0;
    if (f1 !== -1) {
      const n0 = normal(f0);
      const n1 = normal(f1);
      const cosA = Math.min(1, Math.max(-1, dot3(n0, n1)));
      // edge direction as wound in f0
      const a = mesh.faces[3 * f0 + c0];
      const b = mesh.faces[3 * f0 + ((c0 + 1) % 3)];
      const dir = norm3(sub3(getVertex(mesh.positions, b), getVertex(mesh.positions, a)));
      const s = dot3(cross3(n0, n1), dir);
      dihedral = Math.acos(cosA) * (s >= 0 ? 1 : -1);
    }
    edges.push({
      id,
      v0: Math.min(v0, v1),
      v1: Math.max(v0, v1),
      f0,
      f1,
      length: dist3(p0, p1),
      dihedral,
      kind: f1 === -1 ? 'boundary' : 'fold',
    });
    faceEdges[3 * f0 + c0] = id;
    if (f1 !== -1) faceEdges[3 * f1 + c1] = id;
  };

  for (const [key, list] of incidences) {
    const [v0s, v1s] = key.split(',');
    const v0 = Number(v0s);
    const v1 = Number(v1s);
    if (list.length === 1) {
      addEdge(v0, v1, list[0].face, list[0].corner, -1, -1);
    } else if (list.length === 2) {
      addEdge(v0, v1, list[0].face, list[0].corner, list[1].face, list[1].corner);
    } else {
      nonManifoldCount++;
      // pick the pair with the flattest dihedral (max cos between normals)
      let bi = 0, bj = 1, best = -Infinity;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const c = dot3(normal(list[i].face), normal(list[j].face));
          if (c > best) {
            best = c;
            bi = i;
            bj = j;
          }
        }
      }
      addEdge(v0, v1, list[bi].face, list[bi].corner, list[bj].face, list[bj].corner);
      for (let i = 0; i < list.length; i++) {
        if (i !== bi && i !== bj) addEdge(v0, v1, list[i].face, list[i].corner, -1, -1);
      }
    }
  }

  if (nonManifoldCount > 0) {
    warnings.push(
      `Maillage non-manifold : ${nonManifoldCount} arête(s) partagée(s) par plus de 2 faces — certaines pièces devront être collées bord à bord.`,
    );
  }

  return { edges, faceEdges, warnings };
}
