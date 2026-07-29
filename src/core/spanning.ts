import type { MeshTopology } from '../types';

const FLAT_THRESHOLD = (2 * Math.PI) / 180;

/**
 * Decide fold vs cut per interior edge: maximum spanning forest (Kruskal)
 * over the face-adjacency graph. Weight favors long edges and flat dihedrals;
 * near-coplanar edges get a strong bonus and print as no line at all ('flat').
 * Mutates edge.kind in place: tree edges → fold/flat, the rest → cut.
 */
export function decideFolds(topology: MeshTopology, faceCount: number): void {
  const interior = topology.edges.filter((e) => e.f1 !== -1);

  const weight = (e: (typeof interior)[number]): number => {
    let w = (e.length * (1 + Math.cos(e.dihedral))) / 2;
    if (Math.abs(e.dihedral) < FLAT_THRESHOLD) w *= 10;
    return w;
  };

  const sorted = [...interior].sort((a, b) => weight(b) - weight(a));

  const parent = new Int32Array(faceCount);
  for (let i = 0; i < faceCount; i++) parent[i] = i;
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    while (parent[x] !== r) {
      const next = parent[x];
      parent[x] = r;
      x = next;
    }
    return r;
  };

  for (const e of sorted) {
    const ra = find(e.f0);
    const rb = find(e.f1);
    if (ra !== rb) {
      parent[ra] = rb;
      e.kind = Math.abs(e.dihedral) < FLAT_THRESHOLD ? 'flat' : 'fold';
    } else {
      e.kind = 'cut';
    }
  }
}
