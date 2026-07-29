import type { Vec3 } from '../types';

export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const sub3 = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
export const add3 = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
export const scale3 = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s);
export const dot3 = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross3 = (a: Vec3, b: Vec3): Vec3 =>
  v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const len3 = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const dist3 = (a: Vec3, b: Vec3): number => len3(sub3(a, b));
export const norm3 = (a: Vec3): Vec3 => {
  const l = len3(a);
  return l > 0 ? scale3(a, 1 / l) : v3(0, 0, 0);
};

export const getVertex = (positions: Float64Array, i: number): Vec3 =>
  v3(positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]);
