export type Lang = 'fr' | 'en' | 'es' | 'de';

type Dict = Record<string, string>;

const STRINGS: Record<Lang, Dict> = {
  fr: {
    'lang.name': 'Français',
    'app.title': 'Paper Centurion',
    'open.placeholder': 'Ouvrir un modèle…',
    'open.upload': 'Téléverser un fichier (STL/OBJ)…',
    'open.samples': 'Exemples',
    'sample.cube': 'Cube',
    'sample.icosahedron': 'Icosaèdre',
    'sample.torus': 'Tore',
    'label.scale': 'Échelle',
    'unit.mmPerUnit': 'mm/u',
    'label.tabs': 'Languettes',
    'unit.mm': 'mm',
    'label.paper': 'Papier',
    'orientation.portrait': 'portrait',
    'orientation.landscape': 'paysage',
    'btn.maxScale': 'Échelle max',
    'btn.maxScale.title': "Régler l'échelle au maximum tenant sur une feuille",
    'btn.exportPdf': 'Exporter le PDF',
    'drop.hint': 'Glisser-déposer un modèle 3D (STL ou OBJ)',
    'drop.overlay': 'Déposer le fichier ici',
    'dims.assembled': 'Assemblé',
    'zoom.out': 'Dézoomer',
    'zoom.in': 'Zoomer',
    'zoom.reset': 'Revenir à 100 %',
    'zoom.fit': 'Ajuster',
    'zoom.fit.title': 'Page entière',
    'view.list': 'Liste',
    'view.list.title': 'Pages en colonne',
    'view.grid': 'Mosaïque',
    'view.grid.title': 'Pages en mosaïque',
    'stats.faces': 'faces',
    'stats.pieces': 'pièce(s)',
    'stats.pages': 'page(s)',
    'page.of': 'Page {n} / {total}',
    'warn.nonManifold':
      'Maillage non-manifold : {n} arête(s) partagée(s) par plus de 2 faces — certaines pièces devront être collées bord à bord.',
    'warn.heavy': 'Maillage lourd ({n} faces) — le calcul peut prendre du temps.',
    'warn.tooBig': 'Maillage trop gros ({n} faces, maximum {max}).',
    'warn.split': 'Pièces trop grandes pour la page : {n} découpe(s) supplémentaire(s) ajoutée(s).',
    'warn.overflow': "Une pièce dépasse la page à l'échelle actuelle — échelle max ≈ {s} mm/unité.",
    'err.format': 'Format non reconnu : {name} (STL ou OBJ attendu).',
    'err.sample': "Impossible de charger l'exemple {name}.",
    'err.stlTruncated': 'Fichier STL binaire tronqué.',
    'err.stlMalformed': 'Fichier STL ASCII mal formé.',
    'err.objEmpty': 'Aucune face trouvée dans le fichier OBJ.',
    'err.unknown': 'Erreur : {msg}',
  },
  en: {
    'lang.name': 'English',
    'app.title': 'Paper Centurion',
    'open.placeholder': 'Open a model…',
    'open.upload': 'Upload a file (STL/OBJ)…',
    'open.samples': 'Samples',
    'sample.cube': 'Cube',
    'sample.icosahedron': 'Icosahedron',
    'sample.torus': 'Torus',
    'label.scale': 'Scale',
    'unit.mmPerUnit': 'mm/u',
    'label.tabs': 'Tabs',
    'unit.mm': 'mm',
    'label.paper': 'Paper',
    'orientation.portrait': 'portrait',
    'orientation.landscape': 'landscape',
    'btn.maxScale': 'Max scale',
    'btn.maxScale.title': 'Set the largest scale that still fits one sheet',
    'btn.exportPdf': 'Export PDF',
    'drop.hint': 'Drag and drop a 3D model (STL or OBJ)',
    'drop.overlay': 'Drop the file here',
    'dims.assembled': 'Assembled',
    'zoom.out': 'Zoom out',
    'zoom.in': 'Zoom in',
    'zoom.reset': 'Back to 100%',
    'zoom.fit': 'Fit',
    'zoom.fit.title': 'Whole page',
    'view.list': 'List',
    'view.list.title': 'Pages in a column',
    'view.grid': 'Grid',
    'view.grid.title': 'Pages as a grid',
    'stats.faces': 'faces',
    'stats.pieces': 'piece(s)',
    'stats.pages': 'page(s)',
    'page.of': 'Page {n} / {total}',
    'warn.nonManifold':
      'Non-manifold mesh: {n} edge(s) shared by more than 2 faces — some pieces will need butt gluing.',
    'warn.heavy': 'Heavy mesh ({n} faces) — this may take a while.',
    'warn.tooBig': 'Mesh too large ({n} faces, maximum {max}).',
    'warn.split': 'Pieces larger than the page: {n} extra cut(s) added.',
    'warn.overflow': 'A piece exceeds the page at the current scale — max scale ≈ {s} mm/unit.',
    'err.format': 'Unrecognized format: {name} (STL or OBJ expected).',
    'err.sample': 'Could not load the sample {name}.',
    'err.stlTruncated': 'Truncated binary STL file.',
    'err.stlMalformed': 'Malformed ASCII STL file.',
    'err.objEmpty': 'No face found in the OBJ file.',
    'err.unknown': 'Error: {msg}',
  },
  es: {
    'lang.name': 'Español',
    'app.title': 'Paper Centurion',
    'open.placeholder': 'Abrir un modelo…',
    'open.upload': 'Subir un archivo (STL/OBJ)…',
    'open.samples': 'Ejemplos',
    'sample.cube': 'Cubo',
    'sample.icosahedron': 'Icosaedro',
    'sample.torus': 'Toro',
    'label.scale': 'Escala',
    'unit.mmPerUnit': 'mm/u',
    'label.tabs': 'Pestañas',
    'unit.mm': 'mm',
    'label.paper': 'Papel',
    'orientation.portrait': 'vertical',
    'orientation.landscape': 'horizontal',
    'btn.maxScale': 'Escala máx.',
    'btn.maxScale.title': 'Ajustar a la mayor escala que cabe en una hoja',
    'btn.exportPdf': 'Exportar PDF',
    'drop.hint': 'Arrastra y suelta un modelo 3D (STL u OBJ)',
    'drop.overlay': 'Suelta el archivo aquí',
    'dims.assembled': 'Montado',
    'zoom.out': 'Alejar',
    'zoom.in': 'Acercar',
    'zoom.reset': 'Volver al 100 %',
    'zoom.fit': 'Ajustar',
    'zoom.fit.title': 'Página completa',
    'view.list': 'Lista',
    'view.list.title': 'Páginas en columna',
    'view.grid': 'Mosaico',
    'view.grid.title': 'Páginas en mosaico',
    'stats.faces': 'caras',
    'stats.pieces': 'pieza(s)',
    'stats.pages': 'página(s)',
    'page.of': 'Página {n} / {total}',
    'warn.nonManifold':
      'Malla no-manifold: {n} arista(s) compartida(s) por más de 2 caras — algunas piezas se pegarán a tope.',
    'warn.heavy': 'Malla pesada ({n} caras) — el cálculo puede tardar.',
    'warn.tooBig': 'Malla demasiado grande ({n} caras, máximo {max}).',
    'warn.split': 'Piezas más grandes que la página: {n} corte(s) adicional(es) añadido(s).',
    'warn.overflow': 'Una pieza excede la página a la escala actual — escala máx. ≈ {s} mm/unidad.',
    'err.format': 'Formato no reconocido: {name} (se esperaba STL u OBJ).',
    'err.sample': 'No se pudo cargar el ejemplo {name}.',
    'err.stlTruncated': 'Archivo STL binario truncado.',
    'err.stlMalformed': 'Archivo STL ASCII mal formado.',
    'err.objEmpty': 'No se encontró ninguna cara en el archivo OBJ.',
    'err.unknown': 'Error: {msg}',
  },
  de: {
    'lang.name': 'Deutsch',
    'app.title': 'Paper Centurion',
    'open.placeholder': 'Modell öffnen…',
    'open.upload': 'Datei hochladen (STL/OBJ)…',
    'open.samples': 'Beispiele',
    'sample.cube': 'Würfel',
    'sample.icosahedron': 'Ikosaeder',
    'sample.torus': 'Torus',
    'label.scale': 'Maßstab',
    'unit.mmPerUnit': 'mm/E',
    'label.tabs': 'Klebelaschen',
    'unit.mm': 'mm',
    'label.paper': 'Papier',
    'orientation.portrait': 'Hochformat',
    'orientation.landscape': 'Querformat',
    'btn.maxScale': 'Max. Maßstab',
    'btn.maxScale.title': 'Größten Maßstab wählen, der auf ein Blatt passt',
    'btn.exportPdf': 'PDF exportieren',
    'drop.hint': '3D-Modell hierher ziehen (STL oder OBJ)',
    'drop.overlay': 'Datei hier ablegen',
    'dims.assembled': 'Zusammengebaut',
    'zoom.out': 'Verkleinern',
    'zoom.in': 'Vergrößern',
    'zoom.reset': 'Zurück auf 100 %',
    'zoom.fit': 'Anpassen',
    'zoom.fit.title': 'Ganze Seite',
    'view.list': 'Liste',
    'view.list.title': 'Seiten in einer Spalte',
    'view.grid': 'Raster',
    'view.grid.title': 'Seiten als Raster',
    'stats.faces': 'Flächen',
    'stats.pieces': 'Teil(e)',
    'stats.pages': 'Seite(n)',
    'page.of': 'Seite {n} / {total}',
    'warn.nonManifold':
      'Non-manifold-Netz: {n} Kante(n) von mehr als 2 Flächen geteilt — einige Teile müssen stumpf verklebt werden.',
    'warn.heavy': 'Großes Netz ({n} Flächen) — die Berechnung kann dauern.',
    'warn.tooBig': 'Netz zu groß ({n} Flächen, maximal {max}).',
    'warn.split': 'Teile größer als die Seite: {n} zusätzliche Schnitt(e) hinzugefügt.',
    'warn.overflow': 'Ein Teil passt beim aktuellen Maßstab nicht auf die Seite — max. Maßstab ≈ {s} mm/Einheit.',
    'err.format': 'Unbekanntes Format: {name} (STL oder OBJ erwartet).',
    'err.sample': 'Beispiel {name} konnte nicht geladen werden.',
    'err.stlTruncated': 'Abgeschnittene binäre STL-Datei.',
    'err.stlMalformed': 'Fehlerhafte ASCII-STL-Datei.',
    'err.objEmpty': 'Keine Fläche in der OBJ-Datei gefunden.',
    'err.unknown': 'Fehler: {msg}',
  },
};

export const LANGS = Object.keys(STRINGS) as Lang[];

const STORAGE_KEY = 'papercenturion.lang';

function detectLang(): Lang {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // no storage (private mode, non-browser runtime)
  }
  if (stored && (LANGS as string[]).includes(stored)) return stored as Lang;
  const nav = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [];
  for (const tag of nav ?? []) {
    const base = tag.slice(0, 2).toLowerCase();
    if ((LANGS as string[]).includes(base)) return base as Lang;
  }
  return 'en';
}

let current: Lang = detectLang();

export const getLang = (): Lang => current;

export function setLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // private mode: keep the in-memory choice
  }
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  applyTranslations();
}

/** a string in a given language, without switching the active one */
export const tIn = (lang: Lang, key: string): string => STRINGS[lang][key] ?? STRINGS.en[key] ?? key;

/** translate a key, substituting {placeholders} */
export function t(key: string, params?: Record<string, string | number>): string {
  const s = STRINGS[current][key] ?? STRINGS.en[key] ?? key;
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
}

/**
 * Apply translations to every [data-i18n] element (text content),
 * [data-i18n-title] (title attribute) and [data-i18n-attr] on the page.
 */
export function applyTranslations(): void {
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n!);
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-title]')) {
    el.title = t(el.dataset.i18nTitle!);
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-label]')) {
    (el as HTMLOptGroupElement).label = t(el.dataset.i18nLabel!);
  }
  document.title = `${t('app.title')} — ${t('drop.hint')}`;
}
