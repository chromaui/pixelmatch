'use strict';

var PNG = require('pngjs').PNG,
    fs = require('fs'),
    test = require('tap').test,
    path = require('path'),
    match = require('../.');

diffTest('1a', '1b', '1diff', {threshold: 0.05, includeAA: false}, 143);
diffTest('2a', '2b', '2diff', {threshold: 0.05, includeAA: false}, 12437);
diffTest('3a', '3b', '3diff', {threshold: 0.05, includeAA: false}, 212);
diffTest('4a', '4b', '4diff', {threshold: 0.05, includeAA: false}, 36049);
diffTest('5a', '5b', '5diff', {threshold: 0.05, includeAA: false}, 0);
diffTest('6a', '6b', '6diff', {threshold: 0.05, includeAA: false}, 51);
diffTest('7a', '7b', '7diff', {
    threshold: 0.05,
    includeAA: false,
    diffMask: true,
    drawAA: false
}, 143);

test('throws error if image sizes do not match', function (t) {
    t.throws(function () {
        match([1, 2, 3], [1, 2, 3, 4], null, 2, 1);
    }, /Image sizes do not match/);
    t.end();
});

function diffTest(imgPath1, imgPath2, diffPath, options, expectedMismatch) {
    var name = 'comparing ' + imgPath1 + ' to ' + imgPath2 +
            ', threshold: ' + options.threshold + ', includeAA: ' + options.includeAA;

    test(name, function (t) {
        var img1 = readImage(imgPath1, function () {
            var img2 = readImage(imgPath2, function () {
                var expectedDiff = readImage(diffPath, function () {
                    var diff = new PNG({width: img1.width, height: img1.height});

                    var mismatch = match(img1.data, img2.data, diff.data, diff.width, diff.height, options);
                    var mismatch2 = match(img1.data, img2.data, null, diff.width, diff.height, options);

                    // For testing
                    // fs.writeFileSync('diff.png', PNG.sync.write(diff));

                    t.same(diff.data, expectedDiff.data, 'diff image');
                    t.same(mismatch, expectedMismatch, 'number of mismatched pixels');
                    t.same(mismatch, mismatch2, 'number of mismatched pixels');

                    t.end();
                });
            });
        });
    });
}

function readImage(name, done) {
    return fs.createReadStream(path.join(__dirname, '/fixtures/' + name + '.png')).pipe(new PNG()).on('parsed', done);
}
