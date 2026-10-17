import { describe, it, expect } from 'vitest';
import { DARK, LIGHT, layers } from '@protomaps/basemaps';
import { buildBaseMapStyle } from '@/services/mapStyle';

const BASE = { origin: 'http://localhost', pmtilesKey: 'tashkent-local' };

// Every text-font anywhere in a layer, however deep it sits in an expression
function collectTextFonts(node, found = []) {
  if (Array.isArray(node)) node.forEach((child) => collectTextFonts(child, found));
  else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'text-font') found.push(value);
      else collectTextFonts(value, found);
    }
  }
  return found;
}

describe('buildBaseMapStyle', () => {
  it('points at the local tiles, glyphs and sprites (nothing from the internet)', () => {
    const style = buildBaseMapStyle({ ...BASE, theme: 'dark' });

    expect(style.version).toBe(8);
    expect(style.sources.protomaps).toEqual({ type: 'vector', url: 'pmtiles://tashkent-local' });
    expect(style.glyphs).toBe('http://localhost/fonts/map/{fontstack}/{range}.pbf');
    expect(style.sprite).toBe('http://localhost/map/sprites/dark/dark');
  });

  it('uses the palette of the theme, light by default and for an unknown theme', () => {
    const light = layers('protomaps', LIGHT, { lang: 'en' });
    const dark = layers('protomaps', DARK, { lang: 'en' });

    expect(buildBaseMapStyle(BASE).layers.length).toBe(light.length);
    expect(buildBaseMapStyle({ ...BASE, theme: 'dark' }).layers[0]).toEqual(dark[0]);
    expect(buildBaseMapStyle({ ...BASE, theme: 'sepia' }).layers[0]).toEqual(light[0]);
  });

  // Only one fontstack ships in public/fonts/map: any other one would be a missing glyph request
  it('every text layer uses the one shipped fontstack', () => {
    const style = buildBaseMapStyle({ ...BASE, fontstack: 'Roboto Regular' });
    const fonts = style.layers.flatMap((layer) => collectTextFonts(layer.layout ?? {}));

    expect(fonts.length).toBeGreaterThan(0);
    for (const font of fonts) {
      expect([['Roboto Regular'], ['literal', ['Roboto Regular']]]).toContainEqual(font);
    }
  });

  it('labels follow the language', () => {
    const russian = JSON.stringify(buildBaseMapStyle({ ...BASE, lang: 'ru' }).layers);

    expect(russian).toContain('name:ru');
  });
});
