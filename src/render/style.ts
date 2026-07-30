/** Shared print style: the SVG preview and the PDF must match exactly. */
export const STYLE = {
  cutWidthMm: 0.25,
  foldWidthMm: 0.2,
  /** dash patterns in mm */
  mountainDashMm: [2, 1] as number[],
  valleyDashMm: [4, 1, 0.4, 1] as number[],
  labelFontMm: 2.5,
  labelInsetMm: 1.8,
  cutColor: '#000000',
  mountainColor: '#c02020',
  valleyColor: '#2040c0',
  labelColor: '#404040',
  /** poster joint marks: where two sheets of an oversized piece meet */
  jointWidthMm: 0.15,
  jointDashMm: [1.5, 1.5] as number[],
  jointColor: '#aaaaaa',
} as const;
