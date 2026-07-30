import { jsPDF } from 'jspdf';
import type { UnfoldResult } from '../types';
import { layoutPages } from '../render/primitives';
import { STYLE } from '../render/style';

/** Vector PDF, one page per layout page, mm units. */
export function exportPDF(result: UnfoldResult): jsPDF {
  const { pageWidthMm, pageHeightMm } = result.settings;
  const doc = new jsPDF({
    unit: 'mm',
    format: [pageWidthMm, pageHeightMm],
    orientation: pageWidthMm > pageHeightMm ? 'landscape' : 'portrait',
  });

  const pages = layoutPages(result);
  pages.forEach((page, i) => {
    if (i > 0) doc.addPage([pageWidthMm, pageHeightMm]);

    for (const kind of ['cut', 'mountain', 'valley', 'joint'] as const) {
      const lines = page.lines.filter((l) => l.kind === kind);
      if (lines.length === 0) continue;
      if (kind === 'cut') {
        doc.setLineWidth(STYLE.cutWidthMm);
        doc.setDrawColor(STYLE.cutColor);
        doc.setLineDashPattern([], 0);
      } else if (kind === 'joint') {
        doc.setLineWidth(STYLE.jointWidthMm);
        doc.setDrawColor(STYLE.jointColor);
        doc.setLineDashPattern([...STYLE.jointDashMm], 0);
      } else if (kind === 'mountain') {
        doc.setLineWidth(STYLE.foldWidthMm);
        doc.setDrawColor(STYLE.mountainColor);
        doc.setLineDashPattern([...STYLE.mountainDashMm], 0);
      } else {
        doc.setLineWidth(STYLE.foldWidthMm);
        doc.setDrawColor(STYLE.valleyColor);
        doc.setLineDashPattern([...STYLE.valleyDashMm], 0);
      }
      for (const l of lines) {
        doc.line(l.a.x, l.a.y, l.b.x, l.b.y);
      }
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(STYLE.labelFontMm * 2.83465); // mm → pt
    doc.setTextColor(STYLE.labelColor);
    for (const t of page.texts) {
      doc.text(t.text, t.pos.x, t.pos.y, {
        align: 'center',
        baseline: 'middle',
        // t.angle is in math (y-up) coords; on the y-down page the segment
        // appears at -t.angle, and jsPDF's angle option is degrees CCW on paper
        angle: (-t.angle * 180) / Math.PI,
      });
    }
  });

  return doc;
}
