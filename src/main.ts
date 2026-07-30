import {
  DEFAULT_SETTINGS,
  PAGE_FORMATS,
  type Mesh,
  type PageFormat,
  type Settings,
  type UnfoldResult,
} from './types';
import { weldMesh } from './core/weld';
import { parseModel } from './io/import';
import { runPipeline } from './pipeline';
import { renderPages } from './render/viewer2d';
import { Viewer3D } from './render/viewer3d';
import { exportPDF } from './io/pdf';
import { computeMaxScale } from './core/pack';
import { getLang, LANGS, setLang, t, tIn, type Lang } from './i18n';
import { NoticeError, noticeOf } from './notice';
import type { Notice } from './types';

const viewer = new Viewer3D(document.getElementById('view3d')!);
const pagesEl = document.getElementById('pages')!;
const warningsEl = document.getElementById('warnings')!;
const statsEl = document.getElementById('stats')!;
const dimsEl = document.getElementById('dims')!;
const dropzone = document.getElementById('dropzone')!;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const scaleInput = document.getElementById('scale') as HTMLInputElement;
const tabDepthInput = document.getElementById('tabDepth') as HTMLInputElement;
const pdfBtn = document.getElementById('exportPdf') as HTMLButtonElement;
const formatSel = document.getElementById('pageFormat') as HTMLSelectElement;
const orientSel = document.getElementById('pageOrientation') as HTMLSelectElement;
const maxScaleBtn = document.getElementById('maxScale') as HTMLButtonElement;

let currentMesh: Mesh | null = null;
let currentResult: UnfoldResult | null = null;
let sourceName = 'modele';

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

/** assembled model dimensions at print scale, adaptive unit */
function updateDims(mesh: Mesh, scaleMmPerUnit: number): void {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const c = mesh.positions[i + k];
      if (c < min[k]) min[k] = c;
      if (c > max[k]) max[k] = c;
    }
  }
  const dimsMm = [0, 1, 2].map((k) => (max[k] - min[k]) * scaleMmPerUnit);
  const largest = Math.max(...dimsMm);
  let unit: string;
  let div: number;
  let digits: number;
  if (largest < 100) {
    unit = 'mm';
    div = 1;
    digits = largest < 10 ? 1 : 0;
  } else if (largest < 1000) {
    unit = 'cm';
    div = 10;
    digits = 1;
  } else {
    unit = 'm';
    div = 1000;
    digits = 2;
  }
  const txt = dimsMm.map((d) => (d / div).toFixed(digits).replace('.', ',')).join(' × ');
  dimsEl.innerHTML = `${t('dims.assembled')} : <b>${txt} ${unit}</b>`;
  dimsEl.classList.add('visible');
}

function recompute(): void {
  if (!currentMesh) return;
  try {
    const t0 = performance.now();
    currentResult = runPipeline(currentMesh, currentSettings());
    const dt = performance.now() - t0;

    viewer.setMesh(currentMesh, currentResult.topology);
    renderPages(currentResult, pagesEl);
    showWarnings(currentResult.warnings);
    updateDims(currentMesh, currentResult.settings.scaleMmPerUnit);

    const faces = currentMesh.faces.length / 3;
    lastStats = { faces, pieces: currentResult.islands.length, pages: currentResult.pageCount, ms: dt };
    renderStats();
    pdfBtn.disabled = false;
    maxScaleBtn.disabled = false;
    dropzone.classList.add('hidden');
  } catch (err) {
    showWarnings([noticeOf(err)]);
  }
}

let currentWarnings: Notice[] = [];
let lastStats: { faces: number; pieces: number; pages: number; ms: number } | null = null;

function renderStats(): void {
  if (!lastStats) return;
  const s = lastStats;
  statsEl.textContent = `${s.faces} ${t('stats.faces')} · ${s.pieces} ${t('stats.pieces')} · ${s.pages} ${t('stats.pages')} · ${s.ms.toFixed(0)} ms`;
}

function showWarnings(list: Notice[]): void {
  currentWarnings = list;
  warningsEl.innerHTML = '';
  for (const w of list) {
    const div = document.createElement('div');
    div.className = 'warning';
    div.textContent = t(w.key, w.params);
    warningsEl.appendChild(div);
  }
}

async function openFile(file: File): Promise<void> {
  try {
    const soup = parseModel(file.name, await file.arrayBuffer());
    currentMesh = weldMesh(soup);
    sourceName = file.name.replace(/\.(stl|obj)$/i, '');
    recompute();
  } catch (err) {
    showWarnings([noticeOf(err)]);
  }
}

fileInput.addEventListener('change', () => {
  if (fileInput.files?.[0]) void openFile(fileInput.files[0]);
  fileInput.value = '';
});

// custom −/+ steppers (native number spinners are too small to hit)
for (const btn of document.querySelectorAll<HTMLButtonElement>('button.step')) {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.stepFor!) as HTMLInputElement;
    const dir = Number(btn.dataset.step);
    const step = Number(input.step) || 1;
    const min = input.min === '' ? -Infinity : Number(input.min);
    const decimals = (input.step.split('.')[1] ?? '').length;
    const next = Math.max(min, (Number(input.value) || 0) + dir * step);
    input.value = next.toFixed(decimals);
    recompute();
  });
}

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
    if (!currentResult || !currentResult.warnings.some((w) => w.key === 'warn.overflow')) break;
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

const openModelSel = document.getElementById('openModel') as HTMLSelectElement;
// not async: showPicker/click must run inside the user gesture, before any await
openModelSel.addEventListener('change', () => {
  const choice = openModelSel.value;
  openModelSel.value = ''; // back to the placeholder
  if (!choice) return;
  if (choice === 'upload') {
    if (typeof fileInput.showPicker === 'function') fileInput.showPicker();
    else fileInput.click();
    return;
  }
  void loadSample(choice);
});

async function loadSample(choice: string): Promise<void> {
  try {
    const resp = await fetch(`${import.meta.env.BASE_URL}samples/${choice}`);
    if (!resp.ok) throw new NoticeError({ key: 'err.sample', params: { name: choice } });
    currentMesh = weldMesh(parseModel(choice, await resp.arrayBuffer()));
    sourceName = choice.replace(/\.stl$/i, '');
    recompute();
  } catch (err) {
    showWarnings([noticeOf(err)]);
  }
}

// zoom / pan of the 2D preview
const zoomLevelBtn = document.getElementById('zoomLevel') as HTMLButtonElement;
let zoom = 100;
const setZoom = (z: number) => {
  zoom = Math.min(800, Math.max(25, Math.round(z)));
  pagesEl.style.setProperty('--zoom', String(zoom));
  zoomLevelBtn.textContent = `${zoom} %`;
};
document.getElementById('zoomIn')!.addEventListener('click', () => setZoom(zoom * 1.25));
document.getElementById('zoomOut')!.addEventListener('click', () => setZoom(zoom / 1.25));
zoomLevelBtn.addEventListener('click', () => setZoom(100));
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

// language: auto-detected from the browser, overridable and remembered.
// Each option is labelled in its own language, so the menu stays readable
// whatever the current one is.
const langSel = document.getElementById('langSel') as HTMLSelectElement;
for (const lang of LANGS) {
  const opt = document.createElement('option');
  opt.value = lang;
  opt.textContent = tIn(lang, 'lang.name');
  langSel.appendChild(opt);
}
langSel.value = getLang();
langSel.addEventListener('change', () => {
  setLang(langSel.value as Lang);
  renderStats();
  showWarnings(currentWarnings);
  if (currentMesh && currentResult) {
    updateDims(currentMesh, currentResult.settings.scaleMmPerUnit);
    renderPages(currentResult, pagesEl); // page titles
  }
});

setLang(getLang());
