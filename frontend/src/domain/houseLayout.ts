import type { Section } from './types';

export const MAX_SECTION_SPAN_METRES = 30;

export interface HouseGrid {
  lengthMetres: number;
  widthMetres: number;
  columns: number;
  rows: number;
  count: number;
  sections: Section[];
}

const positiveDimension = (value: number) =>
  Number.isFinite(value) && value > 0 ? value : MAX_SECTION_SPAN_METRES;

/** Spreadsheet-style labels keep section names compact after Z. */
export function sectionLabel(index: number): Section {
  let value = Math.max(0, Math.floor(index)) + 1;
  let label = '';
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

export function sectionIndex(section: Section) {
  if (!validSectionLabel(section)) return -1;
  return (
    section.split('').reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0) - 1
  );
}

export function validSectionLabel(value: unknown): value is Section {
  return typeof value === 'string' && /^[A-Z]{1,4}$/.test(value);
}

export function houseGrid(lengthMetres: number, widthMetres: number): HouseGrid {
  const length = positiveDimension(lengthMetres);
  const width = positiveDimension(widthMetres);
  const columns = Math.max(1, Math.ceil(length / MAX_SECTION_SPAN_METRES));
  const rows = Math.max(1, Math.ceil(width / MAX_SECTION_SPAN_METRES));
  const count = columns * rows;
  return {
    lengthMetres: length,
    widthMetres: width,
    columns,
    rows,
    count,
    sections: Array.from({ length: count }, (_, index) => sectionLabel(index)),
  };
}

export function sectionBounds(section: Section, grid: HouseGrid) {
  const index = sectionIndex(section);
  if (index < 0 || index >= grid.count) return null;
  const column = index % grid.columns;
  const row = Math.floor(index / grid.columns);
  return {
    xMin: column / grid.columns,
    xMax: (column + 1) / grid.columns,
    yMin: row / grid.rows,
    yMax: (row + 1) / grid.rows,
  };
}

export function sectionAtPosition(x: number, y: number, grid: HouseGrid): Section {
  const safeX = Math.min(0.999999, Math.max(0, x));
  const safeY = Math.min(0.999999, Math.max(0, y));
  return sectionLabel(
    Math.floor(safeY * grid.rows) * grid.columns + Math.floor(safeX * grid.columns),
  );
}

/** Places nodes inside a section without stacking multiple markers on one point. */
export function positionInSection(
  section: Section,
  grid: HouseGrid,
  position = 0,
  total = 1,
  along = 0.5,
) {
  const bounds = sectionBounds(section, grid) ?? sectionBounds(grid.sections[0]!, grid)!;
  const slot = Math.min(total, Math.max(1, position + 1)) / (Math.max(1, total) + 1);
  return {
    x: bounds.xMin + (bounds.xMax - bounds.xMin) * Math.min(0.85, Math.max(0.15, along)),
    y: bounds.yMin + (bounds.yMax - bounds.yMin) * slot,
  };
}
