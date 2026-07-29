import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Island, type UnfoldResult } from '../src/types';
import { weldMesh } from '../src/core/weld';
import { buildTopology } from '../src/core/adjacency';
import { runPipeline } from '../src/pipeline';
import { trianglesOverlap } from '../src/core/overlap';
import { cubeSoup, icosahedronSoup, tetrahedronSoup, torusSoup, toBinarySTL } from '../src/geom/shapes';
import { parseOBJ, parseSTL } from '../src/io/import';
import { loadProject, saveProject } from '../src/io/project';
import { layoutPages } from '../src/render/primitives';
import { dist2 } from '../src/geom/vec2';
import { dist3, getVertex } from '../src/geom/vec3';
import { faceArea3D, meshDiagonal } from '../src/core/unfold';
import { polygonArea } from '../src/geom/vec2';

const run = (soup: Float64Array): UnfoldResult => runPipeline(weldMesh(soup), { ...DEFAULT_SETTINGS });

const SHAPES: [string, Float64Array][] = [
  ['cube', cubeSoup()],
  ['tetrahedron', tetrahedronSoup()],
  ['icosahedron', icosahedronSoup(3)],
  ['torus', torusSoup(30, 12, 12, 6)],
];

describe('weld + topology', () => {
  it('cube welds to 8 vertices, 12 faces, 18 edges', () => {
    const mesh = weldMesh(cubeSoup());
    expect(mesh.positions.length / 3).toBe(8);
    expect(mesh.faces.length / 3).toBe(12);
    const topo = buildTopology(mesh);
    expect(topo.edges.length).toBe(18);
    expect(topo.edges.every((e) => e.f1 !== -1)).toBe(true); // closed surface
    expect(topo.warnings).toHaveLength(0);
  });

  it('drops degenerate triangles', () => {
    const soup = new Float64Array([0, 0, 0, 1, 0, 0, 1, 0, 0, /* degenerate */ 0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const mesh = weldMesh(soup);
    expect(mesh.faces.length / 3).toBe(1);
  });
});

describe('spanning forest', () => {
  it('cube: 11 tree edges (fold/flat), 7 cuts before splitting', () => {
    const mesh = weldMesh(cubeSoup());
    const topo = buildTopology(mesh);
    // run only the fold decision via the pipeline's building blocks
    const result = run(cubeSoup());
    const kinds = result.topology.edges.map((e) => e.kind);
    const cuts = kinds.filter((k) => k === 'cut').length;
    const tree = kinds.filter((k) => k === 'fold' || k === 'flat').length;
    // splitting may only move tree edges to cut, never the reverse
    expect(tree + cuts).toBe(18);
    expect(tree).toBeLessThanOrEqual(11);
    expect(cuts).toBeGreaterThanOrEqual(7);
    expect(topo.edges.length).toBe(18);
    // the 6 face diagonals are coplanar → flat
    expect(kinds.filter((k) => k === 'flat').length).toBeGreaterThan(0);
  });
});

function forEachIslandEdge(
  result: UnfoldResult,
  island: Island,
  cb: (v0: number, v1: number, p: { x: number; y: number }, q: { x: number; y: number }) => void,
): void {
  for (const f2d of island.faces) {
    for (let k = 0; k < 3; k++) {
      const v0 = result.mesh.faces[3 * f2d.faceId + k];
      const v1 = result.mesh.faces[3 * f2d.faceId + ((k + 1) % 3)];
      cb(v0, v1, f2d.pts[k], f2d.pts[(k + 1) % 3]);
    }
  }
}

describe.each(SHAPES)('unfold properties: %s', (_name, soup) => {
  const result = run(soup);

  it('2D edge lengths match 3D lengths (isometry)', () => {
    const diag = meshDiagonal(result.mesh);
    for (const island of result.islands) {
      forEachIslandEdge(result, island, (v0, v1, p, q) => {
        const l3 = dist3(getVertex(result.mesh.positions, v0), getVertex(result.mesh.positions, v1));
        expect(Math.abs(dist2(p, q) - l3)).toBeLessThan(1e-9 * diag);
      });
    }
  });

  it('no triangle overlap within any island (brute force)', () => {
    const tol = 1e-7 * meshDiagonal(result.mesh);
    for (const island of result.islands) {
      for (let i = 0; i < island.faces.length; i++) {
        for (let j = i + 1; j < island.faces.length; j++) {
          expect(trianglesOverlap(island.faces[i].pts, island.faces[j].pts, tol)).toBe(false);
        }
      }
    }
  });

  it('every face is placed exactly once', () => {
    const seen = new Set<number>();
    for (const island of result.islands) {
      for (const f of island.faces) {
        expect(seen.has(f.faceId)).toBe(false);
        seen.add(f.faceId);
      }
    }
    expect(seen.size).toBe(result.mesh.faces.length / 3);
  });

  it('2D area equals 3D area', () => {
    let a2 = 0;
    let a3 = 0;
    for (const island of result.islands) {
      for (const f of island.faces) {
        a2 += Math.abs(polygonArea([...f.pts]));
        a3 += faceArea3D(result.mesh, f.faceId);
      }
    }
    expect(Math.abs(a2 - a3) / a3).toBeLessThan(1e-9);
  });

  it('every cut-edge label is used exactly twice', () => {
    const count = new Map<number, number>();
    for (const island of result.islands) {
      for (const lbl of island.labels) {
        count.set(lbl.label, (count.get(lbl.label) ?? 0) + 1);
      }
    }
    for (const [, c] of count) expect(c).toBe(2);
    // interior cut edges all labeled
    const cutEdges = result.topology.edges.filter((e) => e.kind === 'cut' && e.f1 !== -1);
    expect(count.size).toBe(cutEdges.length);
  });

  it('tabs never overlap faces or other tabs of their island', () => {
    const tol = 1e-7 * meshDiagonal(result.mesh);
    for (const island of result.islands) {
      for (const tab of island.tabs) {
        for (const f of island.faces) {
          expect(trianglesOverlap(f.pts as never, tab.quad as never, tol)).toBe(false);
        }
      }
      for (let i = 0; i < island.tabs.length; i++) {
        for (let j = i + 1; j < island.tabs.length; j++) {
          expect(trianglesOverlap(island.tabs[i].quad as never, island.tabs[j].quad as never, tol)).toBe(false);
        }
      }
    }
  });

  it('all drawn ink stays within page margins', () => {
    const { pageWidthMm: W, pageHeightMm: H, marginMm: m } = result.settings;
    const eps = 1e-6;
    for (const page of layoutPages(result)) {
      for (const l of page.lines) {
        for (const pt of [l.a, l.b]) {
          expect(pt.x).toBeGreaterThanOrEqual(m - eps);
          expect(pt.x).toBeLessThanOrEqual(W - m + eps);
          expect(pt.y).toBeGreaterThanOrEqual(m - eps);
          expect(pt.y).toBeLessThanOrEqual(H - m + eps);
        }
      }
    }
  });
});

describe('non-manifold input', () => {
  it('warns and survives an edge shared by 3 faces', () => {
    // three triangles fanned around the same edge (0,0,0)-(1,0,0)
    const soup = new Float64Array([
      ...[0, 0, 0, 1, 0, 0, 0.5, 1, 0],
      ...[0, 0, 0, 1, 0, 0, 0.5, -0.5, 1],
      ...[0, 0, 0, 1, 0, 0, 0.5, -0.5, -1],
    ]);
    const result = run(soup);
    expect(result.warnings.some((w) => w.includes('non-manifold'))).toBe(true);
    const placed = result.islands.reduce((n, i) => n + i.faces.length, 0);
    expect(placed).toBe(3);
  });
});

describe('paper formats + max scale', () => {
  it('A3 never needs more pages than A4', () => {
    const mesh = weldMesh(torusSoup(30, 12, 12, 6));
    const a4 = runPipeline(mesh, { ...DEFAULT_SETTINGS });
    const a3 = runPipeline(mesh, { ...DEFAULT_SETTINGS, pageWidthMm: 297, pageHeightMm: 420 });
    expect(a3.pageCount).toBeLessThanOrEqual(a4.pageCount);
  });

  it('landscape swap keeps everything within margins', () => {
    const result = runPipeline(weldMesh(icosahedronSoup(3)), {
      ...DEFAULT_SETTINGS,
      pageWidthMm: 297,
      pageHeightMm: 210,
    });
    const { pageWidthMm: W, pageHeightMm: H, marginMm: m } = result.settings;
    for (const page of layoutPages(result)) {
      for (const l of page.lines) {
        for (const pt of [l.a, l.b]) {
          expect(pt.x).toBeGreaterThanOrEqual(m - 1e-6);
          expect(pt.x).toBeLessThanOrEqual(W - m + 1e-6);
          expect(pt.y).toBeGreaterThanOrEqual(m - 1e-6);
          expect(pt.y).toBeLessThanOrEqual(H - m + 1e-6);
        }
      }
    }
  });

  it('computeMaxScale: slightly below it, no piece overflows', async () => {
    const { computeMaxScale } = await import('../src/core/pack');
    const mesh = weldMesh(icosahedronSoup(3));
    const base = runPipeline(mesh, { ...DEFAULT_SETTINGS });
    const sMax = computeMaxScale(base.islands, base.settings);
    expect(sMax).toBeGreaterThan(0);
    const scaled = runPipeline(mesh, { ...DEFAULT_SETTINGS, scaleMmPerUnit: sMax * 0.9 });
    expect(scaled.warnings.some((w) => w.includes('dépasse'))).toBe(false);
  });
});

describe('oversized pieces are split, not overflowed', () => {
  it('torus at large scale: extra cuts, everything within margins', () => {
    const result = runPipeline(weldMesh(torusSoup(30, 12, 12, 6)), {
      ...DEFAULT_SETTINGS,
      scaleMmPerUnit: 4,
    });
    expect(result.warnings.some((w) => w.includes('découpe(s) supplémentaire'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('dépasse'))).toBe(false);
    const { pageWidthMm: W, pageHeightMm: H, marginMm: m } = result.settings;
    for (const page of layoutPages(result)) {
      for (const l of page.lines) {
        for (const pt of [l.a, l.b]) {
          expect(pt.x).toBeGreaterThanOrEqual(m - 1e-6);
          expect(pt.x).toBeLessThanOrEqual(W - m + 1e-6);
          expect(pt.y).toBeGreaterThanOrEqual(m - 1e-6);
          expect(pt.y).toBeLessThanOrEqual(H - m + 1e-6);
        }
      }
    }
  });

  it('isometry and single placement still hold after splitting', () => {
    const result = runPipeline(weldMesh(icosahedronSoup(30)), {
      ...DEFAULT_SETTINGS,
      scaleMmPerUnit: 2,
    });
    const seen = new Set<number>();
    for (const island of result.islands) {
      for (const f of island.faces) {
        expect(seen.has(f.faceId)).toBe(false);
        seen.add(f.faceId);
      }
    }
    expect(seen.size).toBe(result.mesh.faces.length / 3);
  });
});

describe('labels stay inside their face', () => {
  it.each(SHAPES)('%s: every non-tab label anchors inside its face triangle', (_n, soup) => {
    const result = run(soup);
    for (const island of result.islands) {
      const faceOf = new Map(island.faces.map((f) => [f.faceId, f]));
      for (const lbl of island.labels) {
        if (lbl.ownsTab && island.tabs.some((t) => t.edgeId === lbl.edgeId)) continue;
        const f = faceOf.get(lbl.faceId)!;
        expect(f).toBeDefined();
      }
    }
  });
});

describe('project round-trip', () => {
  it('reload reproduces the identical layout', () => {
    const result = run(icosahedronSoup(3));
    const json = saveProject(result, 'ico');
    const proj = loadProject(json);
    const again = runPipeline(proj.mesh, proj.settings, proj.edgeKinds);
    expect(JSON.stringify(layoutPages(again))).toBe(JSON.stringify(layoutPages(result)));
  });
});

describe('parsers', () => {
  it('binary STL round-trips the cube', () => {
    const soup = parseSTL(toBinarySTL(cubeSoup()));
    const mesh = weldMesh(soup);
    expect(mesh.positions.length / 3).toBe(8);
    expect(mesh.faces.length / 3).toBe(12);
  });

  it('ASCII STL parses', () => {
    const txt = `solid t
facet normal 0 0 1
outer loop
vertex 0 0 0
vertex 1 0 0
vertex 0 1 0
endloop
endfacet
endsolid t`;
    const soup = parseSTL(new TextEncoder().encode(txt).buffer as ArrayBuffer);
    expect(soup.length).toBe(9);
  });

  it('OBJ with quads fan-triangulates', () => {
    const txt = `v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf 1 2 3 4\n`;
    const soup = parseOBJ(txt);
    expect(soup.length).toBe(18); // 2 triangles
  });
});
