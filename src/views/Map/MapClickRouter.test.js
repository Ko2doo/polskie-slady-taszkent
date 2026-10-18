import { describe, it, expect, vi } from 'vitest';
import { CLICK_MODE, routeMapClick } from '@/views/Map/MapClickRouter';

const event = { point: { x: 1, y: 2 } };

function modes({ gpsMode = false, gpsReady = false, navigationMode = false, isEditing = false } = {}) {
  return {
    gpsNavigation: { gpsMode, gpsReady, handleMapClick: vi.fn() },
    navigation: { navigationMode, handleMapClick: vi.fn() },
    pointsEditor: { handleMapClick: vi.fn() },
    isEditing,
  };
}

const takers = (current) =>
  [current.gpsNavigation, current.navigation, current.pointsEditor].filter(
    (mode) => mode.handleMapClick.mock.calls.length,
  );

describe('routeMapClick', () => {
  it('ready GPS navigation takes the tap before everything else', () => {
    const current = modes({ gpsMode: true, gpsReady: true, navigationMode: true, isEditing: true });

    expect(routeMapClick(event, current)).toBe(CLICK_MODE.GPS);
    expect(current.gpsNavigation.handleMapClick).toHaveBeenCalledWith(event);
    expect(takers(current)).toHaveLength(1);
  });

  it('GPS navigation that is not ready yet lets the next mode take it', () => {
    const current = modes({ gpsMode: true, gpsReady: false, navigationMode: true });

    expect(routeMapClick(event, current)).toBe(CLICK_MODE.NAVIGATION);
    expect(current.gpsNavigation.handleMapClick).not.toHaveBeenCalled();
  });

  it('point-to-point navigation takes it without a ready check, before the edit mode', () => {
    const current = modes({ navigationMode: true, isEditing: true });

    expect(routeMapClick(event, current)).toBe(CLICK_MODE.NAVIGATION);
    expect(current.navigation.handleMapClick).toHaveBeenCalledWith(event);
    expect(takers(current)).toHaveLength(1);
  });

  it('the edit mode takes it when no navigation is on', () => {
    const current = modes({ isEditing: true });

    expect(routeMapClick(event, current)).toBe(CLICK_MODE.EDIT);
    expect(current.pointsEditor.handleMapClick).toHaveBeenCalledWith(event);
  });

  it('with no mode on, nobody takes it', () => {
    const current = modes();

    expect(routeMapClick(event, current)).toBeNull();
    expect(takers(current)).toHaveLength(0);
  });

  it('modes that do not exist yet (the map is still starting) are skipped', () => {
    expect(
      routeMapClick(event, { gpsNavigation: null, navigation: null, pointsEditor: null, isEditing: true }),
    ).toBeNull();
  });
});
