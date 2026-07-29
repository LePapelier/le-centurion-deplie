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
