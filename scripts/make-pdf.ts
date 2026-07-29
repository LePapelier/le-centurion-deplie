// CLI check: full pipeline → PDF, written to the given path (run: node scripts/make-pdf.ts out.pdf [cube|icosaedre|tore])
import { writeFileSync } from 'node:fs';
import { weldMesh } from '../src/core/weld.ts';
import { runPipeline } from '../src/pipeline.ts';
import { exportPDF } from '../src/io/pdf.ts';
import { DEFAULT_SETTINGS } from '../src/types.ts';
import { cubeSoup, icosahedronSoup, torusSoup } from '../src/geom/shapes.ts';

const [, , out = 'out.pdf', shape = 'cube'] = process.argv;
const soup =
  shape === 'icosaedre' ? icosahedronSoup(18) : shape === 'tore' ? torusSoup(28, 11, 14, 7) : cubeSoup(30);

const result = runPipeline(weldMesh(soup), { ...DEFAULT_SETTINGS });
const doc = exportPDF(result);
writeFileSync(out, Buffer.from(doc.output('arraybuffer')));
console.log(
  `${out}: ${result.mesh.faces.length / 3} faces, ${result.islands.length} pièce(s), ${result.pageCount} page(s)`,
);
