import type { Mesh } from '../types';
import { cross3, getVertex, len3, norm3, sub3 } from '../geom/vec3';

/**
 * Weld a raw triangle soup (positions only, 9 floats per triangle) into an
 * indexed mesh: grid-quantized vertex merge, degenerate-triangle removal,
 * face normals recomputed from welded coordinates.
 */
export function weldMesh(soup: ArrayLike<number>): Mesh {
  const triCount = Math.floor(soup.length / 9);

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < triCount * 9; i += 3) {
    const x = soup[i], y = soup[i + 1], z = soup[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  const diag = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const eps = 1e-4 * diag;

  const key2id = new Map<string, number>();
  const welded: number[] = [];
  const vertexId = (x: number, y: number, z: number): number => {
    const key = `${Math.round(x / eps)},${Math.round(y / eps)},${Math.round(z / eps)}`;
    let id = key2id.get(key);
    if (id === undefined) {
      id = welded.length / 3;
      key2id.set(key, id);
      welded.push(x, y, z);
    }
    return id;
  };

  const faces: number[] = [];
  for (let t = 0; t < triCount; t++) {
    const a = vertexId(soup[9 * t], soup[9 * t + 1], soup[9 * t + 2]);
    const b = vertexId(soup[9 * t + 3], soup[9 * t + 4], soup[9 * t + 5]);
    const c = vertexId(soup[9 * t + 6], soup[9 * t + 7], soup[9 * t + 8]);
    if (a === b || b === c || a === c) continue;
    faces.push(a, b, c);
  }

  const positions = new Float64Array(welded);
  const kept: number[] = [];
  const areaEps = eps * eps;
  for (let f = 0; f < faces.length / 3; f++) {
    const pa = getVertex(positions, faces[3 * f]);
    const pb = getVertex(positions, faces[3 * f + 1]);
    const pc = getVertex(positions, faces[3 * f + 2]);
    const area = len3(cross3(sub3(pb, pa), sub3(pc, pa))) / 2;
    if (area > areaEps) kept.push(faces[3 * f], faces[3 * f + 1], faces[3 * f + 2]);
  }

  const faceArr = new Uint32Array(kept);
  orientConsistently(positions, faceArr);
  const faceCount = faceArr.length / 3;
  const faceNormals = new Float64Array(3 * faceCount);
  for (let f = 0; f < faceCount; f++) {
    const pa = getVertex(positions, faceArr[3 * f]);
    const pb = getVertex(positions, faceArr[3 * f + 1]);
    const pc = getVertex(positions, faceArr[3 * f + 2]);
    const n = norm3(cross3(sub3(pb, pa), sub3(pc, pa)));
    faceNormals[3 * f] = n.x;
    faceNormals[3 * f + 1] = n.y;
    faceNormals[3 * f + 2] = n.z;
  }

  return { positions, faces: faceArr, faceNormals };
}

/**
 * Make the winding consistent across each connected component (many exported
 * meshes mix CW and CCW faces, which silently breaks tab sides, dihedral
 * signs and mountain/valley classification). Two faces sharing a manifold
 * edge are consistent iff they traverse it in opposite directions; a BFS
 * propagates flips. Each closed component is then globally oriented outward
 * (signed volume > 0); open components keep their propagated orientation.
 */
function orientConsistently(positions: Float64Array, faces: Uint32Array): void {
  const faceCount = faces.length / 3;

  // manifold edges only (exactly 2 incidences), with traversal direction
  const incid = new Map<string, { face: number; forward: boolean }[]>();
  for (let f = 0; f < faceCount; f++) {
    for (let k = 0; k < 3; k++) {
      const a = faces[3 * f + k];
      const b = faces[3 * f + ((k + 1) % 3)];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      let list = incid.get(key);
      if (!list) {
        list = [];
        incid.set(key, list);
      }
      list.push({ face: f, forward: a < b });
    }
  }
  const neighbors: number[][] = Array.from({ length: faceCount }, () => []);
  const sameDir: boolean[][] = Array.from({ length: faceCount }, () => []);
  for (const list of incid.values()) {
    if (list.length !== 2) continue;
    const [x, y] = list;
    neighbors[x.face].push(y.face);
    sameDir[x.face].push(x.forward === y.forward);
    neighbors[y.face].push(x.face);
    sameDir[y.face].push(x.forward === y.forward);
  }

  const flip = new Uint8Array(faceCount);
  const visited = new Uint8Array(faceCount);
  const component = new Int32Array(faceCount).fill(-1);
  let compCount = 0;

  for (let seed = 0; seed < faceCount; seed++) {
    if (visited[seed]) continue;
    const comp = compCount++;
    const queue = [seed];
    visited[seed] = 1;
    component[seed] = comp;
    for (let qi = 0; qi < queue.length; qi++) {
      const f = queue[qi];
      for (let i = 0; i < neighbors[f].length; i++) {
        const g = neighbors[f][i];
        // consistent orientation = opposite traversal; same raw direction
        // means exactly one of the two must flip
        const needed = sameDir[f][i] ? flip[f] ^ 1 : flip[f];
        if (!visited[g]) {
          visited[g] = 1;
          component[g] = comp;
          flip[g] = needed;
          queue.push(g);
        }
        // contradictions (non-orientable surface) are ignored: best effort
      }
    }
  }

  // apply propagated flips
  for (let f = 0; f < faceCount; f++) {
    if (flip[f]) {
      const tmp = faces[3 * f + 1];
      faces[3 * f + 1] = faces[3 * f + 2];
      faces[3 * f + 2] = tmp;
    }
  }

  // orient each closed component outward: signed volume must be positive
  const volume = new Float64Array(compCount);
  for (let f = 0; f < faceCount; f++) {
    const a = 3 * faces[3 * f];
    const b = 3 * faces[3 * f + 1];
    const c = 3 * faces[3 * f + 2];
    volume[component[f]] +=
      (positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1]) -
        positions[a + 1] * (positions[b] * positions[c + 2] - positions[b + 2] * positions[c]) +
        positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c])) /
      6;
  }
  for (let f = 0; f < faceCount; f++) {
    if (volume[component[f]] < 0) {
      const tmp = faces[3 * f + 1];
      faces[3 * f + 1] = faces[3 * f + 2];
      faces[3 * f + 2] = tmp;
    }
  }
}
