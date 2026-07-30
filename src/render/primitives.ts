import type { EdgeLabel, Island, UnfoldResult, Vec2 } from '../types';
import { add2, midpoint2, rot2, scale2, sub2, v2 } from '../geom/vec2';
import { STYLE } from './style';

export interface PageLine {
  kind: 'cut' | 'mountain' | 'valley' | 'joint';
  a: Vec2; // mm, page coordinates
  b: Vec2;
}

export interface PageText {
  text: string;
  pos: Vec2; // mm, page coordinates (text center)
  angle: number; // radians, CCW
}

export interface PageContent {
  lines: PageLine[];
  texts: PageText[];
}

const nearEq = (a: Vec2, b: Vec2) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;

interface RawLine {
  kind: 'cut' | 'mountain' | 'valley';
  a: Vec2; // island-local units
  b: Vec2;
}

interface RawText {
  text: string;
  pos: Vec2; // island-local units
  angle: number; // radians, in island-local space
}

/**
 * Flatten the unfold result into per-page vector primitives (mm page space).
 * Single source of geometry for both the SVG preview and the PDF export.
 * Poster islands (larger than one page) are clipped cell by cell over their
 * grid of consecutive pages, with grey joint marks on the shared borders.
 */
export function layoutPages(result: UnfoldResult): PageContent[] {
  const pages: PageContent[] = Array.from({ length: Math.max(1, result.pageCount) }, () => ({
    lines: [],
    texts: [],
  }));

  for (const island of result.islands) {
    const { lines, texts } = collectIsland(island, result);
    const toPage = (p: Vec2): Vec2 =>
      add2(
        scale2(rot2(p, island.placement.rotation), result.settings.scaleMmPerUnit),
        v2(island.placement.x, island.placement.y),
      );

    if (!island.poster) {
      const page = pages[island.placement.page];
      if (!page) continue;
      for (const l of lines) page.lines.push({ kind: l.kind, a: toPage(l.a), b: toPage(l.b) });
      for (const t of texts) {
        page.texts.push({ text: t.text, pos: toPage(t.pos), angle: t.angle + island.placement.rotation });
      }
    } else {
      emitPoster(island, lines, texts, toPage, pages, result);
    }
  }
  return pages;
}

/** poster island: clip every primitive to each page cell of its grid */
function emitPoster(
  island: Island,
  lines: RawLine[],
  texts: RawText[],
  toPage: (p: Vec2) => Vec2,
  pages: PageContent[],
  result: UnfoldResult,
): void {
  const { cols, rows } = island.poster!;
  const { pageWidthMm, pageHeightMm, marginMm: m } = result.settings;
  const availW = pageWidthMm - 2 * m;
  const availH = pageHeightMm - 2 * m;
  const first = island.placement.page;

  // poster space: usable-area coordinates starting at 0 (toPage already
  // includes the margin offset of the virtual big page)
  const toPoster = (p: Vec2): Vec2 => {
    const q = toPage(p);
    return v2(q.x - m, q.y - m);
  };
  const cellPage = (cx: number, cy: number) => pages[first + cy * cols + cx];

  for (const l of lines) {
    const A = toPoster(l.a);
    const B = toPoster(l.b);
    const cx0 = Math.max(0, Math.floor(Math.min(A.x, B.x) / availW));
    const cx1 = Math.min(cols - 1, Math.floor(Math.max(A.x, B.x) / availW));
    const cy0 = Math.max(0, Math.floor(Math.min(A.y, B.y) / availH));
    const cy1 = Math.min(rows - 1, Math.floor(Math.max(A.y, B.y) / availH));
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const seg = clipSegment(A, B, cx * availW, cy * availH, (cx + 1) * availW, (cy + 1) * availH);
        if (!seg) continue;
        const page = cellPage(cx, cy);
        if (!page) continue;
        page.lines.push({
          kind: l.kind,
          a: v2(m + seg[0].x - cx * availW, m + seg[0].y - cy * availH),
          b: v2(m + seg[1].x - cx * availW, m + seg[1].y - cy * availH),
        });
      }
    }
  }

  for (const t of texts) {
    const P = toPoster(t.pos);
    const cx = Math.min(cols - 1, Math.max(0, Math.floor(P.x / availW)));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor(P.y / availH)));
    const page = cellPage(cx, cy);
    if (!page) continue;
    page.texts.push({
      text: t.text,
      pos: v2(m + P.x - cx * availW, m + P.y - cy * availH),
      angle: t.angle + island.placement.rotation,
    });
  }

  // grey joint marks on every internal border of the grid
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const page = cellPage(cx, cy);
      if (!page) continue;
      if (cx < cols - 1) page.lines.push({ kind: 'joint', a: v2(m + availW, m), b: v2(m + availW, m + availH) });
      if (cx > 0) page.lines.push({ kind: 'joint', a: v2(m, m), b: v2(m, m + availH) });
      if (cy < rows - 1) page.lines.push({ kind: 'joint', a: v2(m, m + availH), b: v2(m + availW, m + availH) });
      if (cy > 0) page.lines.push({ kind: 'joint', a: v2(m, m), b: v2(m + availW, m) });
    }
  }
}

/** Liang-Barsky segment clip against an axis-aligned rectangle */
function clipSegment(a: Vec2, b: Vec2, x0: number, y0: number, x1: number, y1: number): [Vec2, Vec2] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const checks: [number, number][] = [
    [-dx, a.x - x0],
    [dx, x1 - a.x],
    [-dy, a.y - y0],
    [dy, y1 - a.y],
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  if (t1 - t0 < 1e-12) return null;
  return [v2(a.x + t0 * dx, a.y + t0 * dy), v2(a.x + t1 * dx, a.y + t1 * dy)];
}

/** island-local lines and texts (units), before placement transform */
function collectIsland(island: Island, result: UnfoldResult): { lines: RawLine[]; texts: RawText[] } {
  const lines: RawLine[] = [];
  const texts: RawText[] = [];

  for (const de of island.drawnEdges) {
    // a cut side covered by a tab base folds instead of being cut
    const tab = island.tabs.find((t) => t.edgeId === de.edgeId && sameSeg(t.base, de.a, de.b));
    if (de.kind === 'cut' && tab) {
      lines.push({ kind: tab.foldKind, a: de.a, b: de.b });
    } else {
      lines.push({ kind: de.kind, a: de.a, b: de.b });
    }
  }

  for (const tab of island.tabs) {
    for (let i = 0; i < tab.quad.length; i++) {
      const a = tab.quad[i];
      const b = tab.quad[(i + 1) % tab.quad.length];
      // skip the base segment (already emitted as a fold line)
      if ((nearEq(a, tab.base[0]) && nearEq(b, tab.base[1])) || (nearEq(a, tab.base[1]) && nearEq(b, tab.base[0]))) continue;
      lines.push({ kind: 'cut', a, b });
    }
  }

  for (const lbl of island.labels) {
    const pos = labelAnchor(island, lbl, result.settings.scaleMmPerUnit);
    const dir = sub2(lbl.seg[1], lbl.seg[0]);
    let angle = Math.atan2(dir.y, dir.x);
    texts.push({ text: String(lbl.label), pos, angle });
  }

  // keep text upright once the island rotation is applied
  for (const t of texts) {
    let a = t.angle + island.placement.rotation;
    while (a > Math.PI / 2) a -= Math.PI;
    while (a < -Math.PI / 2) a += Math.PI;
    t.angle = a - island.placement.rotation;
  }

  return { lines, texts };
}

function sameSeg(base: [Vec2, Vec2], a: Vec2, b: Vec2): boolean {
  return (nearEq(base[0], a) && nearEq(base[1], b)) || (nearEq(base[0], b) && nearEq(base[1], a));
}

/** label position in island-local units */
function labelAnchor(island: Island, lbl: EdgeLabel, scale: number): Vec2 {
  if (lbl.ownsTab) {
    const tab = island.tabs.find((t) => t.edgeId === lbl.edgeId && sameSeg(t.base, lbl.seg[0], lbl.seg[1]));
    if (tab) {
      // centroid of the tab quad
      let cx = 0, cy = 0;
      for (const p of tab.quad) {
        cx += p.x;
        cy += p.y;
      }
      return v2(cx / tab.quad.length, cy / tab.quad.length);
    }
  }
  // inside the owning face: move from the edge midpoint toward the face
  // centroid, capped so thin faces never push the label outside
  const mid = midpoint2(lbl.seg[0], lbl.seg[1]);
  const face = island.faces.find((f) => f.faceId === lbl.faceId);
  if (!face) return mid;
  const centroid = v2(
    (face.pts[0].x + face.pts[1].x + face.pts[2].x) / 3,
    (face.pts[0].y + face.pts[1].y + face.pts[2].y) / 3,
  );
  const toC = sub2(centroid, mid);
  const dist = Math.hypot(toC.x, toC.y);
  if (dist === 0) return mid;
  const inset = Math.min(STYLE.labelInsetMm / scale, 0.8 * dist);
  return add2(mid, scale2(toC, inset / dist));
}
