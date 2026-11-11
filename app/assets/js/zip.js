/* Planner Pro — a tiny ZIP writer.
   Store-only (no compression) so a vault of Markdown files can be downloaded in
   one click without shipping a dependency. Reads back in every unzip tool. */
(function (global) {
  'use strict';

  var TABLE = null;

  function crcTable() {
    if (TABLE) return TABLE;
    TABLE = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      TABLE[n] = c >>> 0;
    }
    return TABLE;
  }

  function crc32(bytes) {
    var table = crcTable();
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function dosTime(date) {
    return ((date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2))) & 0xFFFF;
  }

  function dosDate(date) {
    return (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xFFFF;
  }

  /** files: [{ name, content }] → Blob (application/zip) */
  function build(files) {
    var encoder = new TextEncoder();
    var now = new Date();
    var time = dosTime(now);
    var date = dosDate(now);
    var parts = [];
    var central = [];
    var offset = 0;

    files.forEach(function (file) {
      var nameBytes = encoder.encode(file.name);
      var data = encoder.encode(file.content);
      var crc = crc32(data);

      var local = new Uint8Array(30 + nameBytes.length);
      var lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);      // local file header
      lv.setUint16(4, 20, true);              // version needed
      lv.setUint16(6, 0x0800, true);          // UTF-8 names
      lv.setUint16(8, 0, true);               // stored, no compression
      lv.setUint16(10, time, true);
      lv.setUint16(12, date, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);

      parts.push(local, data);

      var entry = new Uint8Array(46 + nameBytes.length);
      var cv = new DataView(entry.buffer);
      cv.setUint32(0, 0x02014b50, true);      // central directory header
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, time, true);
      cv.setUint16(14, date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      entry.set(nameBytes, 46);
      central.push(entry);

      offset += local.length + data.length;
    });

    var centralSize = central.reduce(function (sum, entry) { return sum + entry.length; }, 0);
    var end = new Uint8Array(22);
    var ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);        // end of central directory
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);

    return new Blob(parts.concat(central, [end]), { type: 'application/zip' });
  }

  global.PlannerZip = { build: build, crc32: crc32 };
})(window);
