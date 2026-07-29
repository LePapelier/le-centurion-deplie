import {
  DEFAULT_SETTINGS,
  PAGE_FORMATS,
  type EdgeKind,
  type Mesh,
  type PageFormat,
  type Settings,
  type UnfoldResult,
} from './types';
import { computeMaxScale } from './core/pack';
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
const formatSel = document.getElementById('pageFormat') as HTMLSelectElement;
const orientSel = document.getElementById('pageOrientation') as HTMLSelectElement;
const maxScaleBtn = document.getElementById('maxScale') as HTMLButtonElement;

let currentMesh: Mesh | null = null;
let currentResult: UnfoldResult | null = null;
let sourceName = 'modele';
let pinnedEdgeKinds: EdgeKind[] | undefined;

function currentSettings(): Settings {
  const fmt = PAGE_FORMATS[formatSel.value as PageFormat] ?? PAGE_FORMATS.A4;
  const landscape = orientSel.value === 'paysage';
  return {
    ...DEFAULT_SETTINGS,
    scaleMmPerUnit: Math.max(0.001, Number(scaleInput.value) || 1),
    tabDepthMm: Math.max(0.5, Number(tabDepthInput.value) || 6),
    pageWidthMm: landscape ? fmt.height : fmt.width,
    pageHeightMm: landscape ? fmt.width : fmt.height,
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
    maxScaleBtn.disabled = false;
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
formatSel.addEventListener('change', recompute);
orientSel.addEventListener('change', recompute);

// largest scale where every piece fits a page; tab size is fixed in mm so
// the fit is re-checked after re-running the pipeline, shrinking if needed
maxScaleBtn.addEventListener('click', () => {
  if (!currentResult) return;
  let s = computeMaxScale(currentResult.islands, currentResult.settings);
  for (let i = 0; i < 4; i++) {
    // floor to one decimal: keeps the input on the 0.1 stepper grid
    scaleInput.value = String(Math.max(0.1, Math.floor(s * 10) / 10));
    recompute();
    if (!currentResult || !currentResult.warnings.some((w) => w.includes('dépasse'))) break;
    s *= 0.95;
  }
});

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

// zoom / pan of the 2D preview
const zoomLevelEl = document.getElementById('zoomLevel')!;
let zoom = 100;
const setZoom = (z: number) => {
  zoom = Math.min(800, Math.max(25, Math.round(z)));
  pagesEl.style.setProperty('--zoom', String(zoom));
  zoomLevelEl.textContent = `${zoom} %`;
};
document.getElementById('zoomIn')!.addEventListener('click', () => setZoom(zoom * 1.25));
document.getElementById('zoomOut')!.addEventListener('click', () => setZoom(zoom / 1.25));
document.getElementById('zoomReset')!.addEventListener('click', () => setZoom(100));
document.getElementById('zoomFit')!.addEventListener('click', () => {
  // width so one full page height fits the panel
  const first = pagesEl.querySelector<SVGSVGElement>('.page-svg');
  if (!first) return setZoom(100);
  const s = currentSettings();
  const availH = pagesEl.clientHeight - 50;
  const availW = pagesEl.clientWidth - 24;
  const widthPx = Math.min(availW, (availH * s.pageWidthMm) / s.pageHeightMm);
  setZoom((100 * widthPx) / availW);
});
const viewListBtn = document.getElementById('viewList') as HTMLButtonElement;
const viewGridBtn = document.getElementById('viewGrid') as HTMLButtonElement;
const setView = (mosaic: boolean) => {
  pagesEl.classList.toggle('mosaic', mosaic);
  viewListBtn.classList.toggle('pressed', !mosaic);
  viewGridBtn.classList.toggle('pressed', mosaic);
  // entering mosaic at full width would keep one page per row: start at 3 per row
  if (mosaic && zoom > 50) setZoom(33);
  if (!mosaic && zoom < 50) setZoom(100);
};
viewListBtn.addEventListener('click', () => setView(false));
viewGridBtn.addEventListener('click', () => setView(true));

pagesEl.addEventListener(
  'wheel',
  (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  },
  { passive: false },
);
let pan: { x: number; y: number; left: number; top: number } | null = null;
pagesEl.addEventListener('pointerdown', (e) => {
  // touch devices pan via native scrolling; drag-to-pan is mouse-only
  if (e.pointerType !== 'mouse' || e.button !== 0) return;
  pan = { x: e.clientX, y: e.clientY, left: pagesEl.scrollLeft, top: pagesEl.scrollTop };
  pagesEl.classList.add('panning');
});
window.addEventListener('pointermove', (e) => {
  if (!pan) return;
  pagesEl.scrollLeft = pan.left - (e.clientX - pan.x);
  pagesEl.scrollTop = pan.top - (e.clientY - pan.y);
});
window.addEventListener('pointerup', () => {
  pan = null;
  pagesEl.classList.remove('panning');
});

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
