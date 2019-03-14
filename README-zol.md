## @zol/pixelmatch

### API

#### pixelmatch(img1, img2, output, width, height[, options])

As the originial, plus:

`options` is an object literal with the following properties:

- `threshold` — Matching threshold, ranges from `0` to `1`. Smaller values make the comparison more sensitive. `0.1` by default.
- `includeAA` — If `true`, disables detecting and ignoring anti-aliased pixels. `false` by default.
- `diffMask` - If `true`, output will be a mask rather than a complete image. `false` by default.
- `drawAA` - If `true`, output will contain yellow pixels for those detected as anti-aliased. `true` by default.