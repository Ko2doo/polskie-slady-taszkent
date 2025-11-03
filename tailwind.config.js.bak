// (Tailwind v4)
export default {
  // с @tailwindcss/vite обычно не нужен content
  safelist: [
    // === Display / Position / Z ===
    { pattern: /^(hidden|block|inline|inline-block|flex|inline-flex|grid|inline-grid|table|contents)$/ },
    { pattern: /^(static|fixed|absolute|relative|sticky)$/ },
    {
      pattern:
        /^(inset|top|right|bottom|left)-(-?(\d+|px)|0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|8|10|12|14|16|20|24|28|32|36|40|44|48|56|64|72|80|96|1\/2|1\/3|2\/3|1\/4|3\/4|full)$/,
    },
    { pattern: /^z-(-?\d+|0|10|20|30|40|50|auto)$/ },

    // === Flex / Grid / Order / Gap ===
    { pattern: /^flex-(row|row-reverse|col|col-reverse|wrap|wrap-reverse|nowrap)$/ },
    { pattern: /^(flex|grow|shrink)(|-(0|1))$/ },
    { pattern: /^basis-(auto|0|1\/2|1\/3|2\/3|1\/4|3\/4|full|\d+|px)$/ },
    { pattern: /^grid(-(cols|rows)-\d{1,2}|-flow-(row|col|dense))$/ },
    { pattern: /^col-span-(auto|\d{1,2})$/ },
    { pattern: /^row-span-(auto|\d{1,2})$/ },
    { pattern: /^order-(-?\d+|first|last|none)$/ },
    {
      pattern: /^gap-([xy]-)?(0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|8|10|12|14|16|20|24|28|32|36|40|44|48|56|64|72|80|96)$/,
    },

    // === Spacing (margin/padding) ===
    {
      pattern:
        /^(m|mx|my|mt|mr|mb|ml|p|px|py|pt|pr|pb|pl)-(0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|8|10|12|14|16|20|24|28|32|36|40|44|48|56|64|72|80|96|px|auto)$/,
    },

    // === Sizing (width/height/min/max) ===
    { pattern: /^(w|min-w|max-w)-(auto|px|full|screen|fit|min|max|prose|(\d+)|(\d+\/\d+))$/ },
    { pattern: /^(h|min-h|max-h)-(auto|px|full|screen|(\d+))$/ },

    // === Typography ===
    { pattern: /^text-(left|center|right|justify)$/ },
    { pattern: /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)$/ },
    { pattern: /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\d{3})$/ },
    { pattern: /^leading-(none|tight|snug|normal|relaxed|loose|\d{3})$/ },
    { pattern: /^tracking-(tighter|tight|normal|wide|wider|widest)$/ },
    { pattern: /^(whitespace|break)-(normal|nowrap|pre|pre-line|pre-wrap|words|all)$/ },

    // === Colors (bg/text/border) — палитры: slate, gray, zinc, neutral, stone, red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose ===
    {
      pattern:
        /^(bg|text|border|outline|ring|ring-offset)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900)$/,
    },
    { pattern: /^(bg|text|border)-(black|white|transparent|current)$/ },

    // === Backgrounds / Object ===
    {
      pattern:
        /^bg-(cover|contain|clip-border|clip-padding|clip-content|clip-text|fixed|local|scroll|no-repeat|repeat|repeat-(x|y)|center|top|bottom|left|right|([-\d]+))$/,
    },
    { pattern: /^object-(contain|cover|fill|none|scale-down|center|top|bottom|left|right)$/ },

    // === Borders / Radius / Divide ===
    { pattern: /^border(-(0|2|4|8))?$/ },
    { pattern: /^border-(x|y|t|r|b|l)-(0|2|4|8)$/ },
    { pattern: /^rounded(-(none|sm|md|lg|xl|2xl|3xl|full))?$/ },
    { pattern: /^rounded-(t|r|b|l|tl|tr|br|bl)-(none|sm|md|lg|xl|2xl|3xl|full)$/ },
    { pattern: /^divide-(x|y)-(0|2|4|8)$/ },

    // === Ring / Shadow / Opacity ===
    { pattern: /^ring(-(0|1|2|4|8))?$/ },
    { pattern: /^ring-(inset|offset|offset-(\d+|0|1|2|4|8))$/ },
    {
      pattern:
        /^ring-(black|white|transparent|current|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900))$/,
    },
    { pattern: /^shadow(-(sm|md|lg|xl|2xl|inner|none))?$/ },
    { pattern: /^opacity-(0|5|10|20|25|30|40|50|60|70|75|80|90|95|100)$/ },

    // === Transforms / Transitions / Animations ===
    { pattern: /^(transform|transform-gpu|transform-cpu|transform-none)$/ },
    {
      pattern:
        /^(translate|scale|rotate|skew)-(x|y)?-(-?\d+|0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|8|10|12|14|16|20|24|28|32|36|40|44|48|56|64|72|80|96|full|px)$/,
    },
    { pattern: /^origin-(center|top|top-right|right|bottom-right|bottom|bottom-left|left|top-left)$/ },
    { pattern: /^transition(-(none|all|colors|opacity|shadow|transform))?$/ },
    { pattern: /^duration-(75|100|150|200|300|500|700|1000)$/ },
    { pattern: /^ease-(linear|in|out|in-out)$/ },
    { pattern: /^delay-(75|100|150|200|300|500|700|1000)$/ },
    { pattern: /^animate-(none|spin|ping|pulse|bounce)$/ },

    // === Overflow / Scroll / Visibility ===
    { pattern: /^overflow(-(auto|hidden|clip|visible|scroll))?$/ },
    { pattern: /^overflow-(x|y)-(auto|hidden|clip|visible|scroll)$/ },
    { pattern: /^(scrolling-touch|scrolling-auto)$/ },
    { pattern: /^(visible|invisible)$/ },

    // === Align / Justify / Content / Self ===
    { pattern: /^items-(start|end|center|baseline|stretch)$/ },
    { pattern: /^justify-(start|end|center|between|around|evenly)$/ },
    { pattern: /^content-(start|end|center|between|around|evenly|normal|stretch)$/ },
    { pattern: /^self-(auto|start|end|center|stretch|baseline)$/ },

    // === Cursor / Pointer / Select ===
    { pattern: /^cursor-(auto|default|pointer|wait|text|move|not-allowed|grab|grabbing)$/ },
    { pattern: /^select-(none|text|all|auto)$/ },

    // === Visibility helpers ===
    { pattern: /^(sr-only|not-sr-only)$/ },
  ],
};
