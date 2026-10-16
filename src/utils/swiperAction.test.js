import { describe, it, expect, vi, beforeEach } from 'vitest';

// Records every Swiper instance created; the real Swiper needs layout APIs jsdom lacks.
const instances = [];

vi.mock('swiper', () => ({
  default: vi.fn(function Swiper(node, params) {
    this.node = node;
    this.params = params;
    this.destroyed = false;
    this.destroy = vi.fn(() => {
      this.destroyed = true;
    });
    instances.push(this);
  }),
}));

const { swiperInstance } = await import('@/utils/swiperAction');

describe('swiperInstance', () => {
  beforeEach(() => {
    instances.length = 0;
  });

  it('creates one Swiper on the node with the given params', () => {
    const node = document.createElement('div');
    const params = { loop: false };

    swiperInstance(node, params);

    expect(instances).toHaveLength(1);
    expect(instances[0].node).toBe(node);
    expect(instances[0].params).toBe(params);
  });

  it('destroys the instance with DOM cleanup on destroy', () => {
    const action = swiperInstance(document.createElement('div'), {});

    action.destroy();

    expect(instances[0].destroy).toHaveBeenCalledWith(true, true);
  });

  it('does not destroy an already destroyed instance again', () => {
    const action = swiperInstance(document.createElement('div'), {});
    instances[0].destroyed = true;

    action.destroy();

    expect(instances[0].destroy).not.toHaveBeenCalled();
  });
});
