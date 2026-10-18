/**
 * Custom points merge: what the user's points become after an import.
 *
 * Points with the same id are the same point (customPointsFormat.js). For each imported point:
 * - a new id is added (at the end, in the file's order);
 * - a known id with a fresher `updatedAt` replaces the shared data (title, description, coords,
 *   updatedAt) — the device's own photos, preview and `createdAt` stay;
 * - a known id that isn't fresher changes nothing (an equal `updatedAt` keeps the device's point).
 * An import never deletes a point. Pure: no storage, no state — the caller saves the result.
 *
 * @example
 * const parsed = parseFile(text, { kind: 'import' });
 * if (parsed.ok) {
 *   const { points, added, updated, unchanged } = mergeImportedPoints(customPointsState.points, parsed.points);
 * }
 */

/**
 * Merge imported points into the device's points.
 *
 * @param {Array<Object>} existingPoints - The device's points (all fields); not modified
 * @param {Array<Object>} importedPoints - Points from `parseFile(text, { kind: 'import' })`:
 *   validated, unique ids, no local fields
 * @returns {{ points: Array<Object>, added: number, updated: number, unchanged: number }} the
 *   merged list (existing order kept, new points appended) and how many imported points were
 *   added, updated, or changed nothing
 */
export function mergeImportedPoints(existingPoints, importedPoints) {
  const indexById = new Map(existingPoints.map((point, index) => [point.id, index]));
  const points = [...existingPoints];
  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const imported of importedPoints) {
    const index = indexById.get(imported.id);

    if (index === undefined) {
      indexById.set(imported.id, points.length);
      points.push(imported);
      added += 1;
      continue;
    }

    const existing = points[index];
    if (imported.updatedAt <= existing.updatedAt) {
      unchanged += 1;
      continue;
    }

    points[index] = {
      ...existing,
      title: imported.title,
      description: imported.description,
      coords: { lng: imported.coords.lng, lat: imported.coords.lat },
      updatedAt: imported.updatedAt,
    };
    updated += 1;
  }

  return { points, added, updated, unchanged };
}
