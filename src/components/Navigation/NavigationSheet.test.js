import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { createToggle } from '@/lib/state/createToggler.svelte.js';
import { i18nStub } from '@/test/i18nStub';
import { reactiveProps } from '@/test/reactiveProps.svelte.js';
import NavigationSheet from '@/components/Navigation/NavigationSheet.svelte';

const ROUTE_INFO = { distance: 2500, nodes: 40, computeTime: 12, iterations: 300 };

let target;
let component;
let props;

function render(overrides = {}) {
  props = reactiveProps({
    i18n: i18nStub,
    sheetToggler: createToggle(true),
    onToggle: vi.fn(),
    onClear: vi.fn(),
    onGPSToggle: vi.fn(),
    onGPSClear: vi.fn(),
    ...overrides,
  });
  component = mount(NavigationSheet, { target, props });
  flushSync();
}

const text = () => document.body.textContent;
const button = (key) => [...document.body.querySelectorAll('button')].find((item) => item.textContent.includes(key));
const closeLink = () => document.body.querySelector('.toolbar a, a');

function click(element) {
  element.click();
  flushSync();
}

beforeEach(() => {
  target = document.createElement('div');
  document.body.append(target);
});

afterEach(() => {
  unmount(component);
  target.remove();
});

describe('no mode active', () => {
  it('offers both modes', () => {
    render();

    expect(text()).toContain('ui:modalSheet:nav:title');
    expect(document.body.querySelectorAll('.nav-info-panel')).toHaveLength(0);
  });

  it('the mode buttons start manual or GPS navigation', () => {
    render();
    click(button('ui:map:nav:pointToPoint'));
    click(button('ui:map:gps:navigate'));

    expect(props.onToggle).toHaveBeenCalledTimes(1);
    expect(props.onGPSToggle).toHaveBeenCalledTimes(1);
  });

  it('the close icon closes the sheet', () => {
    render();

    click(closeLink());

    expect(props.sheetToggler.value).toBe(false);
  });
});

describe('manual mode, choosing points', () => {
  it('explains how to set the points', () => {
    render({ navigationMode: true, navigationReady: true });

    expect(text()).toContain('ui:map:infoPanel:setRoutePoints');
    expect(text()).toContain('ui:map:infoPanel:startProg');
  });

  it('the close icon leaves the mode', () => {
    render({ navigationMode: true, navigationReady: true });

    click(closeLink());

    expect(props.onToggle).toHaveBeenCalledTimes(1);
  });

  it('nothing to show until the engine is ready', () => {
    render({ navigationMode: true, navigationReady: false, navigationLoading: true });

    expect(document.body.querySelector('.nav-info-panel')).toBeNull();
  });
});

describe('a route is shown', () => {
  it('distance in km and walking time at 5 km/h', () => {
    render({ navigationMode: true, navigationReady: true, routeInfo: ROUTE_INFO });

    expect(text()).toContain('ui:map:infoPanel:info');
    expect(text()).toContain('12ui:map:infoPanel:time');
    expect(document.body.querySelectorAll('strong')[0].textContent).toBe('2.50');
    expect(document.body.querySelectorAll('strong')[1].textContent).toBe('30');
  });

  it('GPS mode shows the GPS route', () => {
    render({ gpsMode: true, gpsReady: true, gpsRouteInfo: ROUTE_INFO, routeInfo: null });

    expect(text()).toContain('ui:map:gps:routing');
  });

  it('ending the route asks first; "no" keeps it', () => {
    render({ navigationMode: true, navigationReady: true, routeInfo: ROUTE_INFO });

    click(closeLink());
    expect(text()).toContain('ui:dialog:nav:title');
    click(button('ui:dialog:nav:no'));

    expect(props.onClear).not.toHaveBeenCalled();
    expect(props.onToggle).not.toHaveBeenCalled();
  });

  it('"yes" clears the route and leaves the active mode', () => {
    render({ gpsMode: true, gpsReady: true, gpsRouteInfo: ROUTE_INFO });

    click(closeLink());
    click(button('ui:dialog:nav:yes'));

    expect(props.onGPSClear).toHaveBeenCalledTimes(1);
    expect(props.onGPSToggle).toHaveBeenCalledTimes(1);
    expect(props.onClear).not.toHaveBeenCalled();
  });
});

describe('arrival', () => {
  it('shows the arrival message instead of the route', () => {
    render({ gpsMode: true, gpsReady: true, isArrived: true, gpsRouteInfo: null });

    expect(text()).toContain('ui:map:gps:arrived');
    expect(text()).not.toContain('ui:map:gps:instruction');
  });
});
