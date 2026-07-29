import type { UnfoldResult } from '../types';
import { layoutPages } from './primitives';
import { STYLE } from './style';

/** Render the layout as one SVG element per page — the print proof. */
export function renderPages(result: UnfoldResult, container: HTMLElement): void {
  container.innerHTML = '';
  const { pageWidthMm: W, pageHeightMm: H } = result.settings;
  const pages = layoutPages(result);

  pages.forEach((page, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'page';
    const title = document.createElement('div');
    title.className = 'page-title';
    title.textContent = `Page ${i + 1} / ${pages.length}`;
    wrap.appendChild(title);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'page-svg');

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', String(W));
    bg.setAttribute('height', String(H));
    bg.setAttribute('fill', 'white');
    svg.appendChild(bg);

    for (const l of page.lines) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', l.a.x.toFixed(4));
      line.setAttribute('y1', l.a.y.toFixed(4));
      line.setAttribute('x2', l.b.x.toFixed(4));
      line.setAttribute('y2', l.b.y.toFixed(4));
      if (l.kind === 'cut') {
        line.setAttribute('stroke', STYLE.cutColor);
        line.setAttribute('stroke-width', String(STYLE.cutWidthMm));
      } else if (l.kind === 'mountain') {
        line.setAttribute('stroke', STYLE.mountainColor);
        line.setAttribute('stroke-width', String(STYLE.foldWidthMm));
        line.setAttribute('stroke-dasharray', STYLE.mountainDashMm.join(' '));
      } else {
        line.setAttribute('stroke', STYLE.valleyColor);
        line.setAttribute('stroke-width', String(STYLE.foldWidthMm));
        line.setAttribute('stroke-dasharray', STYLE.valleyDashMm.join(' '));
      }
      svg.appendChild(line);
    }

    for (const t of page.texts) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', '0');
      text.setAttribute('y', '0');
      // t.angle is math (y-up); SVG rotate() is clockwise-positive on a
      // y-down canvas, so +angle gives the same visual orientation as PDF
      text.setAttribute(
        'transform',
        `translate(${t.pos.x.toFixed(4)} ${t.pos.y.toFixed(4)}) rotate(${((t.angle * 180) / Math.PI).toFixed(2)})`,
      );
      text.setAttribute('font-size', String(STYLE.labelFontMm));
      text.setAttribute('font-family', 'Helvetica, Arial, sans-serif');
      text.setAttribute('fill', STYLE.labelColor);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.textContent = t.text;
      svg.appendChild(text);
    }

    wrap.appendChild(svg);
    container.appendChild(wrap);
  });
}
