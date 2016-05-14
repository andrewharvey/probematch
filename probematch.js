var rbush = require('rbush');
var extent = require('turf-extent');
var xtend = require('xtend');
var flatten = require('geojson-flatten');
var normalize = require('geojson-normalize');
var linestring = require('turf-linestring');
var point = require('turf-point');
var cheapRuler = require('cheap-ruler');

module.exports = function (inputLines, opts) {
  var options = xtend({
    maxProbeDistance: 0.01, // max kilometers away a probe can be to be considered a match
    rbushMaxEntries: 9,
    compareBearing: true, // should bearing be used to filter matches?
    maxBearingRange: 5, // max bearing degrees allowed between a probe and a potentially matching road
    bidirectionalBearing: false
  }, opts);

  var tree = rbush(options.rbushMaxEntries);
  var lines = normalize(flatten(inputLines));
  var load = [];
  var segments = [];

  for (var i = 0; i < lines.features.length; i++) {
    var coords = lines.features[i].geometry.coordinates;
    var ruler = cheapRuler(coords[0][1], 'kilometers');

    for (var j = 0; j < coords.length - 1; j++) {
      var seg = linestring([coords[j], coords[j + 1]], {
        lineId: i,
        segmentId: j
      });

      var ext = ruler.bufferBBox(extent(seg), options.maxProbeDistance);
      seg.properties.bearing = ruler.bearing(coords[j], coords[j + 1]);
      if (seg.properties.bearing < 0) seg.properties.bearing += 360;

      ext.id = segments.length;

      load.push(ext);
      segments.push(seg);
    }
  }
  tree.load(load);

  var match = function (pt, bearing, ruler) {
    var ptCoordinates = pt.geometry ? pt.geometry.coordinates : pt;
    pt = pt.geometry ? pt : point(pt);

    if (!ruler) ruler = cheapRuler(ptCoordinates[1], 'kilometers');

    var ext = [ptCoordinates[0], ptCoordinates[1], ptCoordinates[0], ptCoordinates[1]];
    var hits = tree.search(ext);
    var matches = [];

    if (options.compareBearing &&
      (bearing === null || typeof bearing === 'undefined')) return [];

    if (bearing && bearing < 0) bearing = bearing + 360;

    for (var i = 0; i < hits.length; i++) {
      var segment = segments[hits[i].id];
      var parent = lines.features[segment.properties.lineId];

      if (options.compareBearing && !compareBearing(
        segment.properties.bearing,
        options.maxBearingRange,
        bearing,
        options.bidirectionalBearing
      )) continue;

      var p = ruler.pointOnLine(segment.geometry.coordinates, ptCoordinates);
      var dist = ruler.distance(ptCoordinates, p);

      if (dist <= options.maxProbeDistance) {
        matches.push({segment: segment, line: parent, distance: dist});
      }
    }

    matches.sort(function (a, b) {
      if (a.distance < b.distance) return -1;
      if (a.distance > b.distance) return 1;
      return 0;
    });
    return matches;
  };

  match.matchLine = function (line) {
    var coords = line.coordinates || line.geometry.coordinates;

    var lastbearing;
    var results = [];

    var ruler = cheapRuler(coords[0][1], 'kilometers');

    for (var i = 0; i < coords.length - 1; i++) {
      lastbearing = ruler.bearing(coords[i], coords[i + 1]);
      results.push(match(coords[i], lastbearing, ruler));
    }
    // handle last point
    if (coords.length > 0) results.push(match(coords[coords.length - 1], lastbearing, ruler));
    return results;
  };

  match.tree = tree;
  match.options = options;

  return match;
};

function compareBearing(base, range, bearing, bidirectional) {
  var min = base - range,
    max = base + range;

  if (bearing > min && bearing < max) return true;

  if (bidirectional) {
    min = min - 180;
    max = max - 180;

    if (min < 0) min = min + 360;
    if (max < 0) max = max + 360;

    if (bearing > min && bearing < max) return true;
  }

  return false;
}
