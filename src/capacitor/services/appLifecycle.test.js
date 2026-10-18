import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onAppBackground } from './appLifecycle';

const deps = vi.hoisted(() => ({}));

vi.mock('@capacitor/app', () => ({
  App: { addListener: (...args) => deps.addListener(...args) },
}));

let remove;

beforeEach(() => {
  remove = vi.fn(async () => {});
  deps.addListener = vi.fn(async () => ({ remove }));
});

const appStateListener = () => {
  const [event, listener] = deps.addListener.mock.lastCall;
  expect(event).toBe('appStateChange');
  return listener;
};

describe('onAppBackground', () => {
  it('calls back when the app goes to the background, not when it comes back', () => {
    const callback = vi.fn();
    onAppBackground(callback);
    const listener = appStateListener();

    listener({ isActive: true });
    expect(callback).not.toHaveBeenCalled();

    listener({ isActive: false });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('every trip to the background calls back again', () => {
    const callback = vi.fn();
    onAppBackground(callback);
    const listener = appStateListener();

    listener({ isActive: false });
    listener({ isActive: true });
    listener({ isActive: false });

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('the returned function removes the native listener', async () => {
    const stopListening = onAppBackground(vi.fn());

    await stopListening();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
