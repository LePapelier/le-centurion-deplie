import type { Mesh, Notice, Settings, UnfoldResult } from './types';
import { buildTopology } from './core/adjacency';
import { decideFolds } from './core/spanning';
import { buildIslands } from './core/islands';
import { generateTabs } from './core/tabs';
import { islandFitsPage, packIslands } from './core/pack';
import { chooseSplitEdge } from './core/split';
import { NoticeError } from './notice';

export const MAX_FACES = 100_000;
export const WARN_FACES = 20_000;

/** Full pipeline from a welded mesh to placed, tabbed islands. */
export function runPipeline(mesh: Mesh, settings: Settings): UnfoldResult {
  const faceCount = mesh.faces.length / 3;
  if (faceCount > MAX_FACES) {
    throw new NoticeError({ key: 'warn.tooBig', params: { n: faceCount, max: MAX_FACES } });
  }

  const warnings: Notice[] = [];
  if (faceCount > WARN_FACES) {
    warnings.push({ key: 'warn.heavy', params: { n: faceCount } });
  }

  const topology = buildTopology(mesh);
  warnings.push(...topology.warnings);

  decideFolds(topology, faceCount);

  let { islands, faceIsland } = buildIslands(mesh, topology);

  // pieces larger than a page at the requested scale are split in half
  // (most balanced fold edge becomes a cut) until everything fits; the
  // allowance keeps room for the tabs generated afterwards
  const tabAllowance = 2 * settings.tabDepthMm;
  let split = 0;
  for (let guard = 0; guard < 64; guard++) {
    const oversized = islands.filter((i) => !islandFitsPage(i, settings, tabAllowance));
    if (oversized.length === 0) break;
    let cutAny = false;
    for (const island of oversized) {
      const edgeId = chooseSplitEdge(mesh, topology, island);
      if (edgeId !== -1) {
        topology.edges[edgeId].kind = 'cut';
        cutAny = true;
        split++;
      }
    }
    if (!cutAny) break; // single faces bigger than the page: packing will warn
    ({ islands, faceIsland } = buildIslands(mesh, topology));
  }
  if (split > 0) {
    warnings.push({ key: 'warn.split', params: { n: split } });
  }

  const tabDepthUnits = settings.tabDepthMm / settings.scaleMmPerUnit;
  generateTabs(mesh, topology, islands, faceIsland, tabDepthUnits);

  const packed = packIslands(islands, settings);
  warnings.push(...packed.warnings);

  return { mesh, topology, islands, pageCount: packed.pageCount, settings, warnings };
}
