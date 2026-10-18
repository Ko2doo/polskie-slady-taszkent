import { describe, it, expect } from 'vitest';
import { mergeImportedPoints } from '@/services/customPointsMerge';

const A = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const B = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const C = 'c56a4180-65aa-42ec-a945-5fd21dec0538';
const T = 1_760_000_000_000;

// A point on the device: its own photos and preview
function devicePoint(id, overrides = {}) {
  return {
    id,
    title: `Device ${id.slice(0, 4)}`,
    description: 'on the device',
    coords: { lng: 69.24, lat: 41.31 },
    preview: `preview-${id}`,
    photos: [`photos/${id}/x.jpg`],
    createdAt: T - 10_000,
    updatedAt: T,
    ...overrides,
  };
}

// A point as parseFile returns it from an import: no local fields
function importedPoint(id, overrides = {}) {
  return {
    id,
    title: `Imported ${id.slice(0, 4)}`,
    description: 'from the file',
    coords: { lng: 69.3, lat: 41.35 },
    preview: '',
    photos: [],
    createdAt: T - 99_000,
    updatedAt: T,
    ...overrides,
  };
}

describe('mergeImportedPoints', () => {
  it('adds new points at the end, in the file order', () => {
    const existing = [devicePoint(A)];

    const result = mergeImportedPoints(existing, [importedPoint(C), importedPoint(B)]);

    expect(result.points.map((point) => point.id)).toEqual([A, C, B]);
    expect(result.points[1]).toEqual(importedPoint(C));
    expect(result).toMatchObject({ added: 2, updated: 0, unchanged: 0 });
  });

  it('a fresher imported point replaces the shared data and keeps the local photos, preview and createdAt', () => {
    const existing = [devicePoint(A)];
    const imported = importedPoint(A, { updatedAt: T + 1 });

    const result = mergeImportedPoints(existing, [imported]);

    expect(result.points).toEqual([
      {
        ...devicePoint(A),
        title: imported.title,
        description: imported.description,
        coords: imported.coords,
        updatedAt: T + 1,
      },
    ]);
    expect(result).toMatchObject({ added: 0, updated: 1, unchanged: 0 });
  });

  it('an older imported point changes nothing', () => {
    const existing = [devicePoint(A)];

    const result = mergeImportedPoints(existing, [importedPoint(A, { updatedAt: T - 1 })]);

    expect(result.points).toEqual([devicePoint(A)]);
    expect(result).toMatchObject({ added: 0, updated: 0, unchanged: 1 });
  });

  it('an equally fresh imported point keeps the device one', () => {
    const result = mergeImportedPoints([devicePoint(A)], [importedPoint(A, { updatedAt: T })]);

    expect(result.points).toEqual([devicePoint(A)]);
    expect(result.unchanged).toBe(1);
  });

  it('never deletes a point the file does not have', () => {
    const existing = [devicePoint(A), devicePoint(B)];

    const result = mergeImportedPoints(existing, [importedPoint(C)]);

    expect(result.points.map((point) => point.id)).toEqual([A, B, C]);
  });

  it('keeps the order of the device points when one of them is updated', () => {
    const existing = [devicePoint(A), devicePoint(B), devicePoint(C)];

    const result = mergeImportedPoints(existing, [importedPoint(B, { updatedAt: T + 1 })]);

    expect(result.points.map((point) => point.id)).toEqual([A, B, C]);
    expect(result.points[1].title).toBe(importedPoint(B).title);
  });

  it('counts a mixed import', () => {
    const existing = [devicePoint(A), devicePoint(B)];

    const result = mergeImportedPoints(existing, [
      importedPoint(A, { updatedAt: T + 1 }),
      importedPoint(B, { updatedAt: T - 1 }),
      importedPoint(C),
    ]);

    expect(result).toMatchObject({ added: 1, updated: 1, unchanged: 1 });
    expect(result.points).toHaveLength(3);
  });

  it('an empty import changes nothing', () => {
    const existing = [devicePoint(A)];

    expect(mergeImportedPoints(existing, [])).toEqual({ points: [devicePoint(A)], added: 0, updated: 0, unchanged: 0 });
  });

  it('into an empty device: every point is added', () => {
    const result = mergeImportedPoints([], [importedPoint(A), importedPoint(B)]);

    expect(result.points).toEqual([importedPoint(A), importedPoint(B)]);
    expect(result.added).toBe(2);
  });

  it('does not modify the lists or points it is given', () => {
    const existing = [devicePoint(A)];
    const imported = [importedPoint(A, { updatedAt: T + 1 }), importedPoint(B)];

    mergeImportedPoints(existing, imported);

    expect(existing).toEqual([devicePoint(A)]);
    expect(imported).toEqual([importedPoint(A, { updatedAt: T + 1 }), importedPoint(B)]);
  });

  it('the updated point does not share its coords object with the imported one', () => {
    const imported = importedPoint(A, { updatedAt: T + 1 });

    const [merged] = mergeImportedPoints([devicePoint(A)], [imported]).points;

    expect(merged.coords).not.toBe(imported.coords);
  });
});
