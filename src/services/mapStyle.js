/**
 * Runtime generation basemap style Protomaps for MapLibre
 */

import { layers, LIGHT, DARK } from '@protomaps/basemaps';

// Choise flavor (pallete) with theme name
function resolveFlavor(theme) {
  switch (theme) {
    case 'dark':
      return DARK;
    case 'light':
      return LIGHT;

    default:
      return LIGHT;
  }
}

/**
 * Force a single fontstack for all text layers in a MapLibre style object.
 *
 * - Walks through style.layers
 * - If a layer has layout["text-font"], it will be replaced with [fontstackName]
 * - Mutates and returns the same style object (convenient in build pipeline)
 *
 * @param {object} style        MapLibre style JSON object
 * @param {string} fontstackName  Fontstack name, e.g. "Roboto Regular"
 * @returns {object} the same style object for chaining
 */
function applyFontEverywhere(style, fontstackName) {
  if (!style || !Array.isArray(style.layers)) return style;

  const rewriteExpr = (node) => {
    if (Array.isArray(node)) {
      return node.map(rewriteExpr);
    }
    if (node && typeof node === 'object') {
      const out = {};
      for (const [key, value] of Object.entries(node)) {
        if (key === 'text-font') {
          out[key] = ['literal', [fontstackName]];
        } else {
          out[key] = rewriteExpr(value);
        }
      }
      return out;
    }
    return node;
  };

  for (const layer of style.layers) {
    if (!layer || !layer.layout) continue;

    if (layer.layout['text-font']) {
      layer.layout['text-font'] = [fontstackName];
    }

    if (layer.layout['text-field']) {
      layer.layout['text-field'] = rewriteExpr(layer.layout['text-field']);
    }
  }

  return style;
}

/**
 * Building runtime-style Protomaps + MapLibre
 *
 * origin      — window.location.origin, пробрасывается снаружи
 * pmtilesKey  — key with pmtiles:// (example: "tashkent-local")
 * theme       — "light" | "dark"
 * lang        — labels lang ("ru" | "uz" | "en" и т.д.)
 * fontstack   — fontstack name .pbf
 */
export function buildBaseMapStyle({
  origin,
  pmtilesKey,
  theme = 'light', // by default
  lang = 'en',
  fontstack = 'Roboto Regular',
}) {
  const flavor = resolveFlavor(theme);

  // data - pmtiles://tashkent-local
  const pmtilesUrl = `pmtiles://${pmtilesKey}`;

  // Local glyphs (.pbf)
  const glyphsUrl = `${origin}/fonts/map/{fontstack}/{range}.pbf`;

  // Local sprites:
  // public/map/sprites/light/light.{png,json}
  // public/map/sprites/dark/dark.{png,json}
  const spriteBase = `${origin}/map/sprites`;
  const spriteUrl = `${spriteBase}/${theme}/${theme}`;

  const style = {
    version: 8,
    glyphs: glyphsUrl,
    sprite: spriteUrl,

    sources: {
      protomaps: {
        type: 'vector',
        url: pmtilesUrl,
        // attributionControl: false,
        // attribution: '<a href="https://protomaps.com">Protomaps</a> © <a href="https://www.openstreetmap.org">OpenStreetMap</a>',
      },
    },

    // full stack layers with Protomaps
    layers: layers('protomaps', flavor, { lang }),
  };

  return applyFontEverywhere(style, fontstack);
}
