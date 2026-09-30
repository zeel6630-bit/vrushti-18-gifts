# ZEEL × VRUSH — Birthday V8

V8 integrates the actual CodePen cake animation mechanism supplied by the user: inline SVG path morph animations plus the original CSS candle/flame timing. The original pink page background is not used.

The cake SVG uses the supplied animation sequence and is recolored toward chocolate while preserving its animation geometry. The candle is positioned into the cake top rather than floating above it.

The toran is a single connected rig: one upper rope, every flag attached at its top edge, and the whole decoration moves together.

Password: 1119

Run with: `python3 -m http.server 3000` and open `http://localhost:3000`.

V9 fixes the celebration layout: the animated cake is lifted to eliminate the large blank region, the three candles are seated into the cake and delayed until after the SVG cake morph completes, and the footer/scroll cue are kept outside the cake visual box to prevent overlap.
