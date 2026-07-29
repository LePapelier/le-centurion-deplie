/**
 * STL (binary + ASCII) and OBJ parsers → raw triangle soup
 * (9 floats per triangle). Pure, DOM-free.
 */
import { NoticeError } from '../notice';

export function parseModel(name: string, buffer: ArrayBuffer): Float64Array {
  const lower = name.toLowerCase();
  if (lower.endsWith('.obj')) return parseOBJ(new TextDecoder().decode(buffer));
  if (lower.endsWith('.stl')) return parseSTL(buffer);
  throw new NoticeError({ key: 'err.format', params: { name } });
}

export function parseSTL(buffer: ArrayBuffer): Float64Array {
  const bytes = new Uint8Array(buffer);
  const head = new TextDecoder().decode(bytes.slice(0, Math.min(512, bytes.length)));
  // ASCII STL starts with "solid" AND contains "facet"; binary files may
  // also start with "solid", so check for a facet keyword in the head.
  if (/^\s*solid/.test(head) && /facet/.test(head)) return parseAsciiSTL(new TextDecoder().decode(bytes));
  return parseBinarySTL(buffer);
}

function parseBinarySTL(buffer: ArrayBuffer): Float64Array {
  if (buffer.byteLength < 84) throw new NoticeError({ key: 'err.stlTruncated' });
  const view = new DataView(buffer);
  const triCount = view.getUint32(80, true);
  const expected = 84 + triCount * 50;
  if (buffer.byteLength < expected) throw new NoticeError({ key: 'err.stlTruncated' });
  const soup = new Float64Array(triCount * 9);
  for (let t = 0; t < triCount; t++) {
    const base = 84 + t * 50 + 12; // skip normal
    for (let k = 0; k < 9; k++) {
      soup[9 * t + k] = view.getFloat32(base + 4 * k, true);
    }
  }
  return soup;
}

function parseAsciiSTL(text: string): Float64Array {
  const soup: number[] = [];
  const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    soup.push(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  if (soup.length % 9 !== 0) throw new NoticeError({ key: 'err.stlMalformed' });
  return new Float64Array(soup);
}

export function parseOBJ(text: string): Float64Array {
  const verts: number[] = [];
  const soup: number[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('v ')) {
      const parts = line.slice(2).trim().split(/\s+/).map(Number);
      verts.push(parts[0], parts[1], parts[2]);
    } else if (line.startsWith('f ')) {
      const idx = line
        .slice(2)
        .trim()
        .split(/\s+/)
        .map((tok) => {
          const i = parseInt(tok.split('/')[0], 10);
          return i > 0 ? i - 1 : verts.length / 3 + i;
        });
      // fan triangulation of n-gons
      for (let i = 1; i + 1 < idx.length; i++) {
        for (const vi of [idx[0], idx[i], idx[i + 1]]) {
          soup.push(verts[3 * vi], verts[3 * vi + 1], verts[3 * vi + 2]);
        }
      }
    }
  }
  if (soup.length === 0) throw new NoticeError({ key: 'err.objEmpty' });
  return new Float64Array(soup);
}
