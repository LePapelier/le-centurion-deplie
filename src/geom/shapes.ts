/** Procedural triangle soups (9 floats per triangle), outward winding. Used by tests and sample generation. */

type Tri = number[]; // 9 numbers

function quad(soup: Tri[], a: number[], b: number[], c: number[], d: number[]): void {
  soup.push([...a, ...b, ...c]);
  soup.push([...a, ...c, ...d]);
}

export function cubeSoup(s = 30): Float64Array {
  const p = (x: number, y: number, z: number) => [x * s, y * s, z * s];
  const soup: Tri[] = [];
  // 8 corners
  const v000 = p(0, 0, 0), v100 = p(1, 0, 0), v110 = p(1, 1, 0), v010 = p(0, 1, 0);
  const v001 = p(0, 0, 1), v101 = p(1, 0, 1), v111 = p(1, 1, 1), v011 = p(0, 1, 1);
  quad(soup, v000, v010, v110, v100); // bottom (z=0), normal -z
  quad(soup, v001, v101, v111, v011); // top (z=1), normal +z
  quad(soup, v000, v100, v101, v001); // y=0, normal -y
  quad(soup, v010, v011, v111, v110); // y=1, normal +y
  quad(soup, v000, v001, v011, v010); // x=0, normal -x
  quad(soup, v100, v110, v111, v101); // x=1, normal +x
  return new Float64Array(soup.flat());
}

export function tetrahedronSoup(s = 30): Float64Array {
  const a = [s, s, s], b = [s, -s, -s], c = [-s, s, -s], d = [-s, -s, s];
  const soup: Tri[] = [
    [...a, ...b, ...c],
    [...a, ...c, ...d],
    [...a, ...d, ...b],
    [...b, ...d, ...c],
  ];
  return orientOutward(new Float64Array(soup.flat()));
}

export function icosahedronSoup(s = 30): Float64Array {
  const t = (1 + Math.sqrt(5)) / 2;
  const V = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map((v) => v.map((c) => c * s));
  const F = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const soup = F.flatMap(([a, b, c]) => [...V[a], ...V[b], ...V[c]]);
  return orientOutward(new Float64Array(soup));
}

export function torusSoup(R = 30, r = 12, nu = 16, nv = 8): Float64Array {
  const pt = (iu: number, iv: number): number[] => {
    const u = (2 * Math.PI * iu) / nu;
    const v = (2 * Math.PI * iv) / nv;
    return [
      (R + r * Math.cos(v)) * Math.cos(u),
      (R + r * Math.cos(v)) * Math.sin(u),
      r * Math.sin(v),
    ];
  };
  const soup: Tri[] = [];
  for (let iu = 0; iu < nu; iu++) {
    for (let iv = 0; iv < nv; iv++) {
      const a = pt(iu, iv), b = pt(iu + 1, iv), c = pt(iu + 1, iv + 1), d = pt(iu, iv + 1);
      quad(soup, a, b, c, d);
    }
  }
  return orientOutward(new Float64Array(soup.flat()));
}

/** flip triangles whose normal points toward the centroid of the shape (works for star-shaped solids) */
function orientOutward(soup: Float64Array): Float64Array {
  const triCount = soup.length / 9;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < soup.length; i += 3) {
    cx += soup[i];
    cy += soup[i + 1];
    cz += soup[i + 2];
  }
  const n = soup.length / 3;
  cx /= n; cy /= n; cz /= n;
  for (let t = 0; t < triCount; t++) {
    const o = 9 * t;
    const ux = soup[o + 3] - soup[o], uy = soup[o + 4] - soup[o + 1], uz = soup[o + 5] - soup[o + 2];
    const vx = soup[o + 6] - soup[o], vy = soup[o + 7] - soup[o + 1], vz = soup[o + 8] - soup[o + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = (soup[o] + soup[o + 3] + soup[o + 6]) / 3 - cx;
    const my = (soup[o + 1] + soup[o + 4] + soup[o + 7]) / 3 - cy;
    const mz = (soup[o + 2] + soup[o + 5] + soup[o + 8]) / 3 - cz;
    if (nx * mx + ny * my + nz * mz < 0) {
      for (let k = 0; k < 3; k++) {
        const tmp = soup[o + 3 + k];
        soup[o + 3 + k] = soup[o + 6 + k];
        soup[o + 6 + k] = tmp;
      }
    }
  }
  return soup;
}

/** binary STL encoder */
export function toBinarySTL(soup: Float64Array): ArrayBuffer {
  const triCount = soup.length / 9;
  const buf = new ArrayBuffer(84 + 50 * triCount);
  const view = new DataView(buf);
  view.setUint32(80, triCount, true);
  for (let t = 0; t < triCount; t++) {
    const base = 84 + 50 * t;
    for (let k = 0; k < 9; k++) {
      view.setFloat32(base + 12 + 4 * k, soup[9 * t + k], true);
    }
  }
  return buf;
}
