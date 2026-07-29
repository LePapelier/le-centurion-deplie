import type { EdgeKind, Mesh, Settings, UnfoldResult } from './types';
import { buildTopology } from './core/adjacency';
import { decideFolds } from './core/spanning';
import { buildIslands } from './core/islands';
import { generateTabs } from './core/tabs';
import { packIslands } from './core/pack';

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

  const { islands, faceIsland } = buildIslands(mesh, topology);

  const tabDepthUnits = settings.tabDepthMm / settings.scaleMmPerUnit;
  generateTabs(mesh, topology, islands, faceIsland, tabDepthUnits);

  const packed = packIslands(islands, settings);
  warnings.push(...packed.warnings);

  return { mesh, topology, islands, pageCount: packed.pageCount, settings, warnings };
}
