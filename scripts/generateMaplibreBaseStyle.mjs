// This script generates static MapLibre style JSON files
// based on the Protomaps basemap configuration.
//
// Behavior:
// - If no CLI arguments are provided, it generates *all* default combinations:
//     themes: ["light", "dark"]
//     langs:  ["uz", "ru", "pl"]
// - If --theme=<...> is provided, only those themes are used.
//   You can pass a single value or a comma-separated list:
//     --theme=light
//     --theme=light,dark
// - If --lang=<...> is provided, only those languages are used.
//   Again, single value or comma-separated list:
//     --lang=uz
//     --lang=uz,ru,pl
// - If both are provided, it generates the cartesian product of
//   the selected themes and langs.
//
// There is intentionally NO validation of “supported” themes or languages.
// Whatever you pass to --theme / --lang will be used as-is in file names
// and passed directly to the basemap layer generator (except for the
// flavor lookup, which must be something Protomaps understands).

import { layers, namedFlavor, LIGHT, DARK, WHITE, BLACK, GRAYSCALE } from '@protomaps/basemaps';
import fs from 'node:fs';
import path from 'node:path';

// Where to write style files (should be publicly served by your frontend).
const OUTPUT_DIR = 'public/map/styles';

// Default sets for themes and languages.
// If no CLI args are passed, we generate all combinations:
//   ["light", "dark"] x ["uz", "ru", "pl"]
const DEFAULT_THEMES = ['light', 'dark'];
const DEFAULT_LANGS = ['uz', 'ru', 'pl'];
const DEFAULT_FONTNAME = 'Roboto Regular';

// NOTE:
// We don't point directly to a physical PMTiles file here.
// "pmtiles://tashkent-local" is a *logical* source ID handled by our custom
// in-memory PMTiles setup. The PMTiles archive is fetched/loaded once into
// a buffer, and MapLibre reads tiles from that buffer via this ID.
// This allows the map to work fully offline after the initial load.
const PMTILES_URL = 'pmtiles://tashkent-local';

// Remote assets for fonts and sprites.
// You can later replace these with local/offline paths if needed.
const GLYPHS_URL = '/fonts/map/{fontstack}/{range}.pbf';
const SPRITE_BASE_URL = '/map/sprites';

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

// ----- CLI ARGUMENTS (comma-separated support) ---------------------------

// Supported flags:
//   --theme=light
//   --theme=light,dark
//   --lang=uz
//   --lang=uz,ru,pl
let themeArgRaw = null;
let langArgRaw = null;

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--theme=')) {
    themeArgRaw = arg.split('=')[1] ?? '';
  } else if (arg.startsWith('--lang=')) {
    langArgRaw = arg.split('=')[1] ?? '';
  }
}

// Helper: split comma-separated argument into an array and trim spaces.
// Empty segments are filtered out, but no further validation is done.
function parseListArg(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Parse lists (possibly empty if arg not provided or empty).
const themeArgList = parseListArg(themeArgRaw);
const langArgList = parseListArg(langArgRaw);

// Decide which themes and langs to generate.
// No theme arg → use DEFAULT_THEMES.
// No lang arg  → use DEFAULT_LANGS.
//
// If user passes an empty list (e.g. "--theme="), this will effectively
// generate nothing for that dimension, but we do not try to be clever here.
const themesToGenerate = themeArgList.length > 0 ? themeArgList : DEFAULT_THEMES;
const langsToGenerate = langArgList.length > 0 ? langArgList : DEFAULT_LANGS;

// ----- STYLE BUILDING -----------------------------------------------------

/**
 * Resolve a Protomaps "flavor" object for a given theme string.
 *
 * For well-known themes we use exported constants:
 *   - "light"     → LIGHT
 *   - "dark"      → DARK
 *   - "white"     → WHITE
 *   - "black"     → BLACK
 *   - "grayscale" → GRAYSCALE
 *
 * For any other custom theme name we fall back to namedFlavor(theme).
 * If that fails, we rethrow with additional context.
 */
function resolveFlavor(theme) {
  switch (theme) {
    case 'light':
      return LIGHT;
    case 'dark':
      return DARK;
    case 'white':
      return WHITE;
    case 'black':
      return BLACK;
    case 'grayscale':
      return GRAYSCALE;
    default:
      try {
        return namedFlavor(theme);
      } catch (err) {
        console.error(
          `❌ Failed to resolve flavor for theme "${theme}". ` +
            `Make sure the name matches a known Protomaps flavor ` +
            `or use one of the built-ins: "light", "dark", "white", ` +
            `"black", "grayscale".`
        );
        throw err;
      }
  }
}

/**
 * Build a MapLibre style object for a given theme and language.
 *
 * @param {string} theme - visual flavor, e.g. "light" or "dark"
 * @param {string} lang  - label language, e.g. "uz", "ru", "pl"
 */
function buildStyle(theme, lang) {
  const flavor = resolveFlavor(theme);

  const style = {
    version: 8,

    center: [69.28, 41.3],
    zoom: 12,

    glyphs: GLYPHS_URL,

    // Use a sprite that matches the theme name (light/dark/etc.).
    sprite: `${SPRITE_BASE_URL}/${theme}`,

    sources: {
      protomaps: {
        type: 'vector',
        url: PMTILES_URL,
        attribution:
          '<a href="https://protomaps.com">Protomaps</a> © <a href="https://www.openstreetmap.org">OpenStreetMap</a>',
      },
    },

    // Full basemap layer stack (land, water, roads, buildings, POIs, labels, ...).
    layers: layers('protomaps', flavor, { lang }),
  };

  return applyFontEverywhere(style, DEFAULT_FONTNAME);
}

// ----- FILE GENERATION ----------------------------------------------------

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

for (const theme of themesToGenerate) {
  for (const lang of langsToGenerate) {
    const style = buildStyle(theme, lang);

    // File name format: style.<theme>.<lang>.json
    // Examples:
    //   style.light.uz.json
    //   style.dark.ru.json
    //   style.dark.pl.json
    const fileName = `style.${theme}.${lang}.json`;
    const filePath = path.join(OUTPUT_DIR, fileName);

    fs.writeFileSync(filePath, JSON.stringify(style, null, 2), 'utf8');
    console.log(`✅ Generated ${filePath}`);
  }
}

console.log(
  `Done. Themes: ${themesToGenerate.length ? themesToGenerate.join(', ') : '(none)'}; Langs: ${
    langsToGenerate.length ? langsToGenerate.join(', ') : '(none)'
  }`
);
