import type { Island, Notice, Settings, Vec2 } from '../types';
import { minAreaRect } from '../geom/mabr';
import { rot2, scale2 } from '../geom/vec2';

const GAP_MM = 2; // clearance between islands on a page

interface Box {
  island: Island;
  rotation: number;
  wMm: number;
  hMm: number;
  minMm: Vec2; // bbox min of rotated+scaled points
}

/**
 * Does the island fit on one page at the current scale? Measured on the
 * MABR of its points; `allowanceMm` shrinks the usable area (e.g. room for
 * tabs when they are not generated yet).
 */
export function islandFitsPage(island: Island, settings: Settings, allowanceMm = 0): boolean {
  const { scaleMmPerUnit: scale, pageWidthMm, pageHeightMm, marginMm } = settings;
  const availW = pageWidthMm - 2 * marginMm - allowanceMm;
  const availH = pageHeightMm - 2 * marginMm - allowanceMm;
  const { angle, width, height } = minAreaRect(islandPoints(island));
  const rotation = width > height ? angle + Math.PI / 2 : angle;
  const b = measure(island, rotation, scale);
  return (
    (b.wMm <= availW && b.hMm <= availH) ||
    (b.hMm <= availW && b.wMm <= availH)
  );
}

/** all points that ink can touch: face vertices and tab corners */
function islandPoints(island: Island): Vec2[] {
  const pts: Vec2[] = [];
  for (const f of island.faces) pts.push(...f.pts);
  for (const t of island.tabs) pts.push(...t.quad);
  return pts;
}

function measure(island: Island, rotation: number, scale: number): Box {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of islandPoints(island)) {
    const r = scale2(rot2(p, rotation), scale);
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x > maxX) maxX = r.x;
    if (r.y > maxY) maxY = r.y;
  }
  return { island, rotation, wMm: maxX - minX, hMm: maxY - minY, minMm: { x: minX, y: minY } };
}

/**
 * Orient each island along its minimum-area bounding rectangle (long side
 * vertical), then shelf-pack (FFDH) onto pages. Oversized islands get a page
 * of their own plus a warning with the maximum scale that would fit.
 */
export function packIslands(islands: Island[], settings: Settings): { pageCount: number; warnings: Notice[] } {
  const { scaleMmPerUnit: scale, pageWidthMm, pageHeightMm, marginMm } = settings;
  const availW = pageWidthMm - 2 * marginMm;
  const availH = pageHeightMm - 2 * marginMm;
  const warnings: Notice[] = [];

  const boxes: Box[] = islands.map((island) => {
    const { angle, width, height } = minAreaRect(islandPoints(island));
    const rotation = width > height ? angle + Math.PI / 2 : angle;
    return measure(island, rotation, scale);
  });

  boxes.sort((a, b) => b.hMm - a.hMm);

  let posterPieces = 0;
  let page = 0;
  let shelfY = 0;
  let shelfH = 0;
  let cursorX = 0;

  const place = (b: Box, px: number, py: number, pg: number) => {
    b.island.placement = {
      page: pg,
      x: marginMm + px - b.minMm.x,
      y: marginMm + py - b.minMm.y,
      rotation: b.rotation,
    };
  };

  for (let b of boxes) {
    // orientation fallback: if too wide for the page, try the other way
    if (b.wMm > availW && b.hMm <= availW) {
      b = measure(b.island, b.rotation + Math.PI / 2, scale);
    }
    if (b.wMm > availW || b.hMm > availH) {
      // poster mode: the piece spans a grid of consecutive pages; the
      // renderer clips it per cell and draws grey joint marks
      const cols = Math.max(1, Math.ceil(b.wMm / availW));
      const rows = Math.max(1, Math.ceil(b.hMm / availH));
      if (cursorX > 0 || shelfY > 0) page++;
      place(b, 0, 0, page);
      b.island.poster = { cols, rows };
      posterPieces++;
      page += cols * rows;
      shelfY = 0;
      shelfH = 0;
      cursorX = 0;
      continue;
    }
    if (cursorX > 0 && cursorX + b.wMm > availW) {
      cursorX = 0;
      shelfY += shelfH + GAP_MM;
      shelfH = 0;
    }
    if (shelfY + b.hMm > availH) {
      page++;
      shelfY = 0;
      shelfH = 0;
      cursorX = 0;
    }
    place(b, cursorX, shelfY, page);
    cursorX += b.wMm + GAP_MM;
    if (b.hMm > shelfH) shelfH = b.hMm;
  }

  if (posterPieces > 0) warnings.push({ key: 'warn.poster', params: { n: posterPieces } });

  const used =
    islands.length > 0
      ? Math.max(
          ...islands.map(
            (i) => i.placement.page + (i.poster ? i.poster.cols * i.poster.rows : 1),
          ),
        )
      : 0;
  return { pageCount: used, warnings };
}

/**
 * Largest scale (mm/unit) at which every island fits on one page, measured
 * from the current layout. Tab geometry depends on scale (fixed mm depth),
 * so callers should re-run the pipeline at the returned scale and iterate
 * once or twice if an oversize warning persists.
 */
export function computeMaxScale(islands: Island[], settings: Settings): number {
  const { scaleMmPerUnit: scale, pageWidthMm, pageHeightMm, marginMm } = settings;
  const availW = pageWidthMm - 2 * marginMm;
  const availH = pageHeightMm - 2 * marginMm;
  let sMax = Infinity;
  for (const island of islands) {
    const { angle, width, height } = minAreaRect(islandPoints(island));
    const rotation = width > height ? angle + Math.PI / 2 : angle;
    const b = measure(island, rotation, scale);
    const fit = Math.max(
      Math.min(availW / b.wMm, availH / b.hMm),
      Math.min(availW / b.hMm, availH / b.wMm),
    );
    if (fit * scale < sMax) sMax = fit * scale;
  }
  return Number.isFinite(sMax) ? sMax : scale;
}
