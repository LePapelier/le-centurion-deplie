import { DEFAULT_SETTINGS, type EdgeKind, type Mesh, type Settings, type UnfoldResult } from './types';
import { weldMesh } from './core/weld';
import { parseModel } from './io/import';
import { runPipeline } from './pipeline';
import { renderPages } from './render/viewer2d';
import { Viewer3D } from './render/viewer3d';
import { exportPDF } from './io/pdf';
import { loadProject, saveProject } from './io/project';

const viewer = new Viewer3D(document.getElementById('view3d')!);
const pagesEl = document.getElementById('pages')!;
const warningsEl = document.getElementById('warnings')!;
const statsEl = document.getElementById('stats')!;
const dropzone = document.getElementById('dropzone')!;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const scaleInput = document.getElementById('scale') as HTMLInputElement;
const tabDepthInput = document.getElementById('tabDepth') as HTMLInputElement;
const savBtn = document.getElementById('saveProject') as HTMLButtonElement;
const pdfBtn = document.getElementById('exportPdf') as HTMLButtonElement;

let currentMesh: Mesh | null = null;
let currentResult: UnfoldResult | null = null;
let sourceName = 'modele';
let pinnedEdgeKinds: EdgeKind[] | undefined;

function currentSettings(): Settings {
  return {
    ...DEFAULT_SETTINGS,
    scaleMmPerUnit: Math.max(0.001, Number(scaleInput.value) || 1),
    tabDepthMm: Math.max(0.5, Number(tabDepthInput.value) || 6),
  };
}

function recompute(): void {
  if (!currentMesh) return;
  try {
    const t0 = performance.now();
    currentResult = runPipeline(currentMesh, currentSettings(), pinnedEdgeKinds);
    const dt = performance.now() - t0;

    viewer.setMesh(currentMesh, currentResult.topology);
    renderPages(currentResult, pagesEl);
    showWarnings(currentResult.warnings);

    const faces = currentMesh.faces.length / 3;
    statsEl.textContent = `${faces} faces · ${currentResult.islands.length} pièce(s) · ${currentResult.pageCount} page(s) · ${dt.toFixed(0)} ms`;
    savBtn.disabled = false;
    pdfBtn.disabled = false;
    dropzone.classList.add('hidden');
  } catch (err) {
    showWarnings([err instanceof Error ? err.message : String(err)]);
  }
}

function showWarnings(list: string[]): void {
  warningsEl.innerHTML = '';
  for (const w of list) {
    const div = document.createElement('div');
    div.className = 'warning';
    div.textContent = w;
    warningsEl.appendChild(div);
  }
}

async function openFile(file: File): Promise<void> {
  try {
    if (file.name.toLowerCase().endsWith('.json')) {
      const proj = loadProject(await file.text());
      currentMesh = proj.mesh;
      sourceName = proj.sourceName;
      pinnedEdgeKinds = proj.edgeKinds;
      scaleInput.value = String(proj.settings.scaleMmPerUnit);
      tabDepthInput.value = String(proj.settings.tabDepthMm);
    } else {
      const soup = parseModel(file.name, await file.arrayBuffer());
      currentMesh = weldMesh(soup);
      sourceName = file.name.replace(/\.(stl|obj)$/i, '');
      pinnedEdgeKinds = undefined;
    }
    recompute();
  } catch (err) {
    showWarnings([err instanceof Error ? err.message : String(err)]);
  }
}

fileInput.addEventListener('change', () => {
  if (fileInput.files?.[0]) void openFile(fileInput.files[0]);
  fileInput.value = '';
});

// settings changes re-run the pipeline; a re-decided layout is fine there,
// but a pinned project keeps its stored fold/cut decision
scaleInput.addEventListener('change', recompute);
tabDepthInput.addEventListener('change', recompute);

document.body.addEventListener('dragover', (e) => {
  e.preventDefault();
  document.body.classList.add('dragging');
});
document.body.addEventListener('dragleave', (e) => {
  if (e.target === document.body || !document.body.contains(e.relatedTarget as Node)) {
    document.body.classList.remove('dragging');
  }
});
document.body.addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.classList.remove('dragging');
  const file = e.dataTransfer?.files?.[0];
  if (file) void openFile(file);
});

for (const btn of document.querySelectorAll<HTMLButtonElement>('button[data-sample]')) {
  btn.addEventListener('click', async () => {
    const name = btn.dataset.sample!;
    try {
      const resp = await fetch(`${import.meta.env.BASE_URL}samples/${name}`);
      if (!resp.ok) throw new Error(`Impossible de charger l'exemple ${name}.`);
      currentMesh = weldMesh(parseModel(name, await resp.arrayBuffer()));
      sourceName = name.replace(/\.stl$/i, '');
      pinnedEdgeKinds = undefined;
      recompute();
    } catch (err) {
      showWarnings([err instanceof Error ? err.message : String(err)]);
    }
  });
}

pdfBtn.addEventListener('click', () => {
  if (!currentResult) return;
  exportPDF(currentResult).save(`${sourceName}.pdf`);
});

savBtn.addEventListener('click', () => {
  if (!currentResult) return;
  const blob = new Blob([saveProject(currentResult, sourceName)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${sourceName}.papier.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
