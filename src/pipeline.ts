import type { EdgeKind, Mesh, Settings, UnfoldResult } from './types';
import { buildTopology } from './core/adjacency';
import { decideFolds } from './core/spanning';
import { buildIslands } from './core/islands';
import { generateTabs } from './core/tabs';
import { islandFitsPage, packIslands } from './core/pack';
import { chooseSplitEdge } from './core/split';

export const MAX_FACES = 100_000;
export const WARN_FACES = 20_000;

/**
 * Full pipeline from a welded mesh to placed, tabbed islands.
 * When edgeKinds is given (project reload), the stored fold/cut decision is
 * pinned instead of re-running the spanning heuristic — the unfolding is
 * deterministic from there.
 */
export function runPipeline(mesh: Mesh, settings: Settings, edgeKinds?: EdgeKind[]): UnfoldResult {
  const faceCount = mesh.faces.length / 3;
  if (faceCount > MAX_FACES) {
    throw new Error(`Maillage trop gros (${faceCount} faces, maximum ${MAX_FACES}).`);
  }

  const warnings: string[] = [];
  if (faceCount > WARN_FACES) {
    warnings.push(`Maillage lourd (${faceCount} faces) — le calcul peut prendre du temps.`);
  }

  const topology = buildTopology(mesh);
  warnings.push(...topology.warnings);

  if (edgeKinds && edgeKinds.length === topology.edges.length) {
    for (let i = 0; i < edgeKinds.length; i++) topology.edges[i].kind = edgeKinds[i];
  } else {
    decideFolds(topology, faceCount);
  }

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
    warnings.push(`Pièces trop grandes pour la page : ${split} découpe(s) supplémentaire(s) ajoutée(s).`);
  }

  const tabDepthUnits = settings.tabDepthMm / settings.scaleMmPerUnit;
  generateTabs(mesh, topology, islands, faceIsland, tabDepthUnits);

  const packed = packIslands(islands, settings);
  warnings.push(...packed.warnings);

  return { mesh, topology, islands, pageCount: packed.pageCount, settings, warnings };
}
