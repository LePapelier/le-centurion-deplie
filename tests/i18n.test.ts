import { describe, expect, it } from 'vitest';
import { LANGS, t, tIn } from '../src/i18n';

/** every key emitted by the core or the UI must exist in every language */
const REQUIRED = [
  'app.title', 'open.placeholder', 'open.upload', 'open.samples',
  'sample.cube', 'sample.icosahedron', 'sample.torus',
  'label.scale', 'label.tabs', 'label.paper', 'unit.mm', 'unit.mmPerUnit',
  'orientation.portrait', 'orientation.landscape',
  'btn.maxScale', 'btn.maxScale.title', 'btn.exportPdf',
  'drop.hint', 'drop.overlay', 'dims.assembled',
  'zoom.in', 'zoom.out', 'zoom.reset', 'zoom.fit', 'zoom.fit.title',
  'view.list', 'view.list.title', 'view.grid', 'view.grid.title',
  'stats.faces', 'stats.pieces', 'stats.pages', 'page.of',
  'warn.nonManifold', 'warn.heavy', 'warn.tooBig', 'warn.split', 'warn.overflow',
  'err.format', 'err.sample', 'err.stlTruncated', 'err.stlMalformed', 'err.objEmpty', 'err.unknown',
  'lang.name',
];

describe('i18n', () => {
  it.each(LANGS)('%s defines every key', (lang) => {
    for (const key of REQUIRED) {
      const s = tIn(lang, key);
      expect(s, `${lang}/${key}`).not.toBe(key); // missing keys fall back to the key itself
      expect(s.length).toBeGreaterThan(0);
    }
  });

  it.each(LANGS)('%s keeps the same placeholders as English', (lang) => {
    const holders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const key of REQUIRED) {
      expect(holders(tIn(lang, key)), `${lang}/${key}`).toBe(holders(tIn('en', key)));
    }
  });

  it('substitutes parameters', () => {
    expect(t('page.of', { n: 2, total: 7 })).toContain('2');
    expect(t('page.of', { n: 2, total: 7 })).toContain('7');
  });
});
