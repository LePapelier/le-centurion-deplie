import type { Mesh, ProjectFile, Settings, UnfoldResult } from '../types';

/** Serialize the session: welded mesh + settings + pinned edge kinds. */
export function saveProject(result: UnfoldResult, sourceName: string): string {
  const file: ProjectFile = {
    format: 'papier-project',
    version: 1,
    sourceName,
    mesh: {
      positions: Array.from(result.mesh.positions),
      faces: Array.from(result.mesh.faces),
    },
    settings: result.settings,
    edgeKinds: result.topology.edges.map((e) => e.kind),
  };
  return JSON.stringify(file);
}

export function loadProject(json: string): { mesh: Mesh; settings: Settings; edgeKinds: ProjectFile['edgeKinds']; sourceName: string } {
  const file = JSON.parse(json) as ProjectFile;
  if (file.format !== 'papier-project') throw new Error('Fichier projet non reconnu.');
  if (file.version !== 1) throw new Error(`Version de projet non gérée (${file.version}).`);

  const positions = new Float64Array(file.mesh.positions);
  const faces = new Uint32Array(file.mesh.faces);
  const faceCount = faces.length / 3;
  const faceNormals = new Float64Array(3 * faceCount);
  for (let f = 0; f < faceCount; f++) {
    const ax = positions[3 * faces[3 * f]], ay = positions[3 * faces[3 * f] + 1], az = positions[3 * faces[3 * f] + 2];
    const bx = positions[3 * faces[3 * f + 1]], by = positions[3 * faces[3 * f + 1] + 1], bz = positions[3 * faces[3 * f + 1] + 2];
    const cx = positions[3 * faces[3 * f + 2]], cy = positions[3 * faces[3 * f + 2] + 1], cz = positions[3 * faces[3 * f + 2] + 2];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    faceNormals[3 * f] = nx / l;
    faceNormals[3 * f + 1] = ny / l;
    faceNormals[3 * f + 2] = nz / l;
  }
  return {
    mesh: { positions, faces, faceNormals },
    settings: file.settings,
    edgeKinds: file.edgeKinds,
    sourceName: file.sourceName,
  };
}
