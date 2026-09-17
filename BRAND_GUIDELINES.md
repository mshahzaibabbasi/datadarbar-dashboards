# Data Darbar — Brand Guidelines (dashboard use)

The rules the dashboard engine already implements, written down so they're a
reference (and so a rebuild never loses them). To apply, use the brand preset in
`brand.datadarbar.js` inside your dataset config.

## Colours
- **Primary:** `#0a4c76`
- **Secondary:** `#999999`
- **Additional colours:** monochromes (tints/shades) of primary and secondary
  only. The engine auto-generates these as a ramp — do not introduce new hues.
- **Change indicators:** increase = green, decrease = red.
  Dashboard uses brand-tinted `#1a7f4b` (up) / `#c0392b` (down).
- **Background:** white.

## Type
- **Font:** Poppins.
- **Text colour:** black.

## Chart rules (all enforced by the engine)
- **No major gridlines.**
- **Cross major ticks on the y-axis.**
- **No units on axis tick numbers** (no "millions", "billions", "$", "%").
  The unit is stated in the subtitle instead, and on the axis title in combo view.
- **White plot background.**
- Axes for money/count begin at zero (no negative ticks).

## Logo
- Full-colour logo (black wordmark + blue accent), transparent background.
- Dashboard: top-right of the header.
- Exported PNG: bottom-right of the footer band, with the source note at
  bottom-left.

## Source / attribution line
- Short form used on exports and footer: **"Data Darbar · <SOURCE> data"**
  (e.g. "Data Darbar · SBP data"). Set per dataset in `config.sourceNote`.

## Voice (for titles/subtitles)
- Confident, data-forward, plain. Lead with the indicator, not methodology.
  Avoid hedging. Keep subtitles factual (source · what the figures are · range).

---
*These are implemented in `engine.js`; this file is the human reference. Editing
colours/font is done via the config `brand` block, not the engine.*
