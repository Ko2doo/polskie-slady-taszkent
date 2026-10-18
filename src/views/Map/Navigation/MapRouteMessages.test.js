import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ERROR_CODES } from '@/lib/errors/errorCodes';
import { errorToast } from '@/store/ui/errorToast';
import { createRouteMessages } from './MapRouteMessages';

vi.mock('@/store/ui/errorToast', () => ({ errorToast: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const i18n = { t: (key) => key };

beforeEach(() => {
  // vi.fn()s created inside vi.mock are not reset by restoreMocks
  Object.values(errorToast).forEach((fn) => fn.mockReset());
});

describe('createRouteMessages', () => {
  it.each([
    ['engineInitFailed', 'errors:navigationInitFailed', ERROR_CODES.NAV_INIT],
    ['routeNotFound', 'errors:navigationRouteNotFound', ERROR_CODES.NAV_ROUTE_NOT_FOUND],
    ['routeCalculationFailed', 'errors:navigationCalculateRouteFailed', ERROR_CODES.NAV_ROUTE_CALC],
  ])('%s: an error toast with its text and code, under the given scope', (method, text, code) => {
    createRouteMessages({ i18n, scope: 'MapNavigation' })[method]();

    expect(errorToast.error).toHaveBeenCalledWith(text, { scope: 'MapNavigation', code });
  });

  it('each controller keeps its own scope', () => {
    createRouteMessages({ i18n, scope: 'MapNavigation' }).routeNotFound();
    createRouteMessages({ i18n, scope: 'GPSNavigation' }).routeNotFound();

    expect(errorToast.error.mock.calls.map(([, meta]) => meta.scope)).toEqual(['MapNavigation', 'GPSNavigation']);
  });
});
