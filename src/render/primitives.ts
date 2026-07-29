import type { EdgeLabel, Island, UnfoldResult, Vec2 } from '../types';
import { add2, midpoint2, rot2, scale2, sub2, v2 } from '../geom/vec2';
import { STYLE } from './style';

export interface PageLine {
  kind: 'cut' | 'mountain' | 'valley';
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

/**
 * Flatten the unfold result into per-page vector primitives (mm page space).
 * Single source of geometry for both the SVG preview and the PDF export.
 */
export function layoutPages(result: UnfoldResult): PageContent[] {
  const pages: PageContent[] = Array.from({ length: Math.max(1, result.pageCount) }, () => ({
    lines: [],
    texts: [],
  }));

  for (const island of result.islands) {
    const page = pages[island.placement.page];
    if (!page) continue;
    const toPage = (p: Vec2): Vec2 =>
      add2(
        scale2(rot2(p, island.placement.rotation), result.settings.scaleMmPerUnit),
        v2(island.placement.x, island.placement.y),
      );

    for (const de of island.drawnEdges) {
      // a cut side covered by a tab base folds instead of being cut
      const tab = island.tabs.find((t) => t.edgeId === de.edgeId && sameSeg(t.base, de.a, de.b));
      if (de.kind === 'cut' && tab) {
        page.lines.push({
          kind: tab.foldKind,
          a: toPage(de.a),
          b: toPage(de.b),
        });
      } else {
        page.lines.push({ kind: de.kind, a: toPage(de.a), b: toPage(de.b) });
      }
    }

    for (const tab of island.tabs) {
      for (let i = 0; i < tab.quad.length; i++) {
        const a = tab.quad[i];
        const b = tab.quad[(i + 1) % tab.quad.length];
        // skip the base segment (already emitted as a fold line)
        if ((nearEq(a, tab.base[0]) &&nearEq(b, tab.base[1])) || (nearEq(a, tab.base[1]) &&nearEq(b, tab.base[0]))) continue;
        page.lines.push({ kind: 'cut', a: toPage(a), b: toPage(b) });
      }
    }

    for (const lbl of island.labels) {
      const pos = labelAnchor(island, lbl, result.settings.scaleMmPerUnit);
      const dir = sub2(lbl.seg[1], lbl.seg[0]);
      let angle = Math.atan2(dir.y, dir.x);
      // island rotation happens on the page; add it, then keep text upright
      angle += island.placement.rotation;
      if (angle > Math.PI / 2) angle -= Math.PI;
      if (angle < -Math.PI / 2) angle += Math.PI;
      page.texts.push({ text: String(lbl.label), pos: toPage(pos), angle });
    }
  }
  return pages;
}

function sameSeg(base: [Vec2, Vec2], a: Vec2, b: Vec2): boolean {
  return (nearEq(base[0], a) &&nearEq(base[1], b)) || (nearEq(base[0], b) &&nearEq(base[1], a));
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
