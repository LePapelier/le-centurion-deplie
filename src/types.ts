export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Welded indexed triangle mesh. Winding CCW seen from outside. */
export interface Mesh {
  positions: Float64Array; // 3 * vertexCount
  faces: Uint32Array; // 3 * faceCount
  faceNormals: Float64Array; // 3 * faceCount
}

export type EdgeKind = 'fold' | 'cut' | 'boundary' | 'flat';

export interface Edge {
  id: number;
  v0: number; // v0 < v1
  v1: number;
  f0: number;
  f1: number; // -1 for boundary
  length: number; // 3D length
  dihedral: number; // signed, >0 mountain, <0 valley
  kind: EdgeKind;
}

/** A message emitted by the core: translation key + substitution params.
 *  Core modules stay language-free; the UI renders them via i18n. */
export interface Notice {
  key: string;
  params?: Record<string, string | number>;
}

export interface MeshTopology {
  edges: Edge[];
  /** edge ids of the 3 edges of each face, aligned with face vertex order:
   *  faceEdges[3f+k] = edge between vertices faces[3f+k] and faces[3f+(k+1)%3] */
  faceEdges: Int32Array;
  warnings: Notice[];
}

export interface Face2D {
  faceId: number;
  pts: [Vec2, Vec2, Vec2]; // island-local, model units; pts[k] ↔ mesh vertex faces[3*faceId+k]
}

export interface Tab {
  edgeId: number;
  label: number;
  quad: Vec2[]; // island-local polygon (trapezoid, possibly clipped)
  base: [Vec2, Vec2]; // the cut edge segment the tab folds on
  foldKind: 'mountain' | 'valley';
}

export interface EdgeLabel {
  edgeId: number;
  label: number;
  /** face this side of the edge belongs to (label anchors inside it) */
  faceId: number;
  /** segment along which the label is printed (island-local) */
  seg: [Vec2, Vec2];
  /** true if this side carries the physical tab */
  ownsTab: boolean;
}

export interface Placement {
  page: number;
  x: number; // mm offset of island origin on page
  y: number;
  rotation: number; // radians
}

export interface DrawnEdge {
  edgeId: number;
  kind: 'cut' | 'mountain' | 'valley';
  a: Vec2;
  b: Vec2;
}

export interface Island {
  id: number;
  rootFace: number;
  faces: Face2D[];
  drawnEdges: DrawnEdge[];
  tabs: Tab[];
  labels: EdgeLabel[];
  placement: Placement;
}

export interface Settings {
  scaleMmPerUnit: number;
  tabDepthMm: number;
  pageWidthMm: number;
  pageHeightMm: number;
  marginMm: number;
}

/** paper formats, portrait dimensions in mm */
export const PAGE_FORMATS = {
  A5: { width: 148, height: 210 },
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
} as const;

export type PageFormat = keyof typeof PAGE_FORMATS;

export const DEFAULT_SETTINGS: Settings = {
  scaleMmPerUnit: 1,
  tabDepthMm: 6,
  pageWidthMm: 210,
  pageHeightMm: 297,
  marginMm: 10,
};

export interface UnfoldResult {
  mesh: Mesh;
  topology: MeshTopology;
  islands: Island[];
  pageCount: number;
  settings: Settings;
  warnings: Notice[];
}
