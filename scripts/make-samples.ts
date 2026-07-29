// Generates the sample STL models in public/samples/ (run: node scripts/make-samples.ts)
import { writeFileSync, mkdirSync } from 'node:fs';
import { cubeSoup, icosahedronSoup, torusSoup, toBinarySTL } from '../src/geom/shapes.ts';

mkdirSync(new URL('../public/samples/', import.meta.url), { recursive: true });

const out = (name: string, soup: Float64Array) => {
  const url = new URL(`../public/samples/${name}`, import.meta.url);
  writeFileSync(url, Buffer.from(toBinarySTL(soup)));
  console.log(`${name}: ${soup.length / 9} triangles`);
};

out('cube.stl', cubeSoup(30));
out('icosaedre.stl', icosahedronSoup(18));
out('tore.stl', torusSoup(28, 11, 14, 7));
