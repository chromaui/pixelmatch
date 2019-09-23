'use strict';

module.exports = pixelmatch;

function pixelmatch(img1, img2, output, width, height, options) {

    if (img1.length !== img2.length) throw new Error('Image sizes do not match.');

    if (!options) options = {};

    var threshold = options.threshold === undefined ? 0.1 : options.threshold;
    var drawAA = options.drawAA === undefined ? true : options.drawAA;
    var maskPixelColor = options.maskPixelColor === undefined ?
        {r: 55, g: 255, b: 20} : options.maskPixelColor;

    // maximum acceptable square distance between two colors;
    // 35215 is the maximum possible value for the YIQ difference metric
    var maxDelta = 35215 * threshold * threshold;
    var diff = 0;

    function toDiff(delta) {
        return Math.sqrt(delta/35215);
    }
    var diffHistogram = {}
    var aaDiffHistogram = {}
    
    // compare each pixel of one image against the other one
    for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {

            var pos = (y * width + x) * 4;

            // squared YUV distance between colors at this pixel position
            var delta = colorDelta(img1, img2, pos, pos);

            var diffValue;
            if (options.debug) {
                diffValue = toDiff(delta);
                diffHistogram[diffValue] = diffHistogram[diffValue] || 0;
                diffHistogram[diffValue] += 1;
            }

            // the color difference is above the threshold
            if (delta > maxDelta) {
                
                // check it's a real rendering difference or just anti-aliasing
                if (!options.includeAA && (antialiased(img1, x, y, width, height, img2) ||
                                   antialiased(img2, x, y, width, height, img1))) {
                    // one of the pixels is anti-aliasing; draw as yellow and do not count as difference
                    if (output && drawAA) drawPixel(output, pos, 255, 255, 0);

                    if (options.debug) {
                        aaDiffHistogram[diffValue] = aaDiffHistogram[diffValue] || 0;
                        aaDiffHistogram[diffValue] += 1;
                    }
        
                } else {
                    // found substantial difference not caused by anti-aliasing; draw it as red
                    if (output)
                        if (!options.diffMask)
                            drawPixel(output, pos, 255, 0, 0);
                        else
                            drawPixel(output, pos, maskPixelColor.r, maskPixelColor.g, maskPixelColor.b);
                    diff++;
                }

            } else if (output) {
                if (!options.diffMask) {
                    // pixels are similar; draw background as grayscale image blended with white
                    var val = grayPixel(img1, pos, 0.1);
                    drawPixel(output, pos, val, val, val);
                }
            }
        }
    }

    if (options.debug) {
        const diffs = Object.keys(diffHistogram).sort();
        console.log(`Pixels 0 difference: ${100 *diffHistogram[0]/(height*width)}%`)
        // diffs.forEach(d => d > threshold && console.log(`${d}: ${diffHistogram[d] - (aaDiffHistogram[d] || 0)} (${diffHistogram[d]})`))
        const largestDiff = diffs.reverse().find(d => diffHistogram[d] - aaDiffHistogram[d] > 0)
        console.log(`Largest non-antialiased diff ${largestDiff}`)
    }

    // return the number of different pixels
    return diff;
}

// check if a pixel is likely a part of anti-aliasing;
// based on "Anti-aliased Pixel and Intensity Slope Detector" paper by V. Vysniauskas, 2009

function antialiased(img, x1, y1, width, height, img2) {
    var x0 = Math.max(x1 - 1, 0);
    var y0 = Math.max(y1 - 1, 0);
    var x2 = Math.min(x1 + 1, width - 1);
    var y2 = Math.min(y1 + 1, height - 1);
    var pos = (y1 * width + x1) * 4;
    var zeroes = x1 === x0 || x1 === x2 || y1 === y0 || y1 === y2 ? 1 : 0;
    var min = 0;
    var max = 0;
    var minX, minY, maxX, maxY;

    // go through 8 adjacent pixels
    for (var x = x0; x <= x2; x++) {
        for (var y = y0; y <= y2; y++) {
            if (x === x1 && y === y1) continue;

            // brightness delta between the center pixel and adjacent one
            var delta = colorDelta(img, img, pos, (y * width + x) * 4, true);

            // count the number of equal, darker and brighter adjacent pixels
            if (delta === 0) {
                zeroes++;
                // if found more than 2 equal siblings, it's definitely not anti-aliasing
                if (zeroes > 2) return false;

            // remember the darkest pixel
            } else if (delta < min) {
                min = delta;
                minX = x;
                minY = y;

            // remember the brightest pixel
            } else if (delta > max) {
                max = delta;
                maxX = x;
                maxY = y;
            }
        }
    }

    // if there are no both darker and brighter pixels among siblings, it's not anti-aliasing
    if (min === 0 || max === 0) return false;

    // if either the darkest or the brightest pixel has 3+ equal siblings in both images
    // (definitely not anti-aliased), this pixel is anti-aliased
    return (hasManySiblings(img, minX, minY, width, height) && hasManySiblings(img2, minX, minY, width, height)) ||
           (hasManySiblings(img, maxX, maxY, width, height) && hasManySiblings(img2, maxX, maxY, width, height));
}

// check if a pixel has 3+ adjacent pixels of the same color.
function hasManySiblings(img, x1, y1, width, height) {
    var x0 = Math.max(x1 - 1, 0);
    var y0 = Math.max(y1 - 1, 0);
    var x2 = Math.min(x1 + 1, width - 1);
    var y2 = Math.min(y1 + 1, height - 1);
    var pos = (y1 * width + x1) * 4;
    var zeroes = x1 === x0 || x1 === x2 || y1 === y0 || y1 === y2 ? 1 : 0;

    // go through 8 adjacent pixels
    for (var x = x0; x <= x2; x++) {
        for (var y = y0; y <= y2; y++) {
            if (x === x1 && y === y1) continue;

            var pos2 = (y * width + x) * 4;
            if (img[pos] === img[pos2] &&
                img[pos + 1] === img[pos2 + 1] &&
                img[pos + 2] === img[pos2 + 2] &&
                img[pos + 3] === img[pos2 + 3]) zeroes++;

            if (zeroes > 2) return true;
        }
    }

    return false;
}

// calculate color difference according to the paper "Measuring perceived color difference
// using YIQ NTSC transmission color space in mobile applications" by Y. Kotsarenko and F. Ramos

function colorDelta(img1, img2, k, m, yOnly) {
    var r1 = img1[k + 0];
    var g1 = img1[k + 1];
    var b1 = img1[k + 2];
    var a1 = img1[k + 3];

    var r2 = img2[m + 0];
    var g2 = img2[m + 1];
    var b2 = img2[m + 2];
    var a2 = img2[m + 3];

    if (a1 === a2 && r1 === r2 && g1 === g2 && b1 === b2) return 0;

    if (a1 < 255) {
        a1 /= 255;
        r1 = blend(r1, a1);
        g1 = blend(g1, a1);
        b1 = blend(b1, a1);
    }

    if (a2 < 255) {
        a2 /= 255;
        r2 = blend(r2, a2);
        g2 = blend(g2, a2);
        b2 = blend(b2, a2);
    }

    var y = rgb2y(r1, g1, b1) - rgb2y(r2, g2, b2);

    if (yOnly) return y; // brightness difference only

    var i = rgb2i(r1, g1, b1) - rgb2i(r2, g2, b2),
        q = rgb2q(r1, g1, b1) - rgb2q(r2, g2, b2);

    return 0.5053 * y * y + 0.299 * i * i + 0.1957 * q * q;
}

function rgb2y(r, g, b) { return r * 0.29889531 + g * 0.58662247 + b * 0.11448223; }
function rgb2i(r, g, b) { return r * 0.59597799 - g * 0.27417610 - b * 0.32180189; }
function rgb2q(r, g, b) { return r * 0.21147017 - g * 0.52261711 + b * 0.31114694; }

// blend semi-transparent color with white
function blend(c, a) {
    return 255 + (c - 255) * a;
}

function drawPixel(output, pos, r, g, b) {
    output[pos + 0] = r;
    output[pos + 1] = g;
    output[pos + 2] = b;
    output[pos + 3] = 255;
}

function grayPixel(img, i, alpha) {
    var r = img[i + 0];
    var g = img[i + 1];
    var b = img[i + 2];
    return blend(rgb2y(r, g, b), alpha * img[i + 3] / 255);
}
