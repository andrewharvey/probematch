var probematch = require('../');
var test = require('tap').test;
var path = require('path');
var point = require('turf-point');

function load() {
  return require(path.join(__dirname, 'fixtures/roads.input.json'));
}


test('probematch -- returns scored roads', function (t) {
  var match = probematch(load(), {compareBearing: false});
  var probe = point([-77.03038215637207, 38.909639917926036]);

  var matched = match(probe);

  t.deepEqual(matched, require(path.join(__dirname, 'fixtures/out/scored.json')), 'matches expected output');
  t.ok(matched[0].distance < matched[1].distance, 'is sorted by distance');
  t.end();
});

test('probematch -- including bearing limits matches', function (t) {
  var match = probematch(load());
  var probe = point([-77.03038215637207, 38.909639917926036]);

  var matched = match(probe, 87);
  t.deepEqual(matched, require(path.join(__dirname, 'fixtures/out/bearing.json')), 'matches expected output');

  t.deepEqual(match(probe), [], 'undefined bearing results in no matches');
  t.deepEqual(match(probe, null), [], 'null bearing results in no matches');
  t.end();
});

test('probematch -- match distance is configurable', function (t) {
  var probe = point([-77.03162670135498, 38.91076278357181]);

  var matchNormal = probematch(load());
  var matchFar = probematch(load(), {maxProbeDistance: 0.13});

  t.deepEqual(matchNormal(probe, 89), [], 'no matches for a far away probe');
  t.deepEqual(matchFar(probe, 89), require(path.join(__dirname, 'fixtures/out/bearingConfigured.json')), 'matches expected output');

  t.end();
});

test('probematch -- bearing range is configurable', function (t) {
  var matchNormal = probematch(load());
  var matchExpanded = probematch(load(), {maxBearingRange: 20});
  var probe = point([-77.03038215637207, 38.909639917926036]);

  t.deepEqual(matchNormal(probe, 70), [], 'bearing outside range finds no matches');
  t.deepEqual(matchExpanded(probe, 70), require(path.join(__dirname, 'fixtures/out/bearingExpanded.json')), 'expanded bearing range finds matches');

  t.end();
});