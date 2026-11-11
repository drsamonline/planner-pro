/* Planner Pro — data store
   Single localStorage document, versioned, with a migration from the
   v13 "enterprise" layout. Days are keyed by full date (not by year bucket),
   so navigating across a year boundary no longer writes to the wrong year. */
(function (global) {
  'use strict';

  var KEY = 'planner_v14';
  var LEGACY_KEY = 'planner_v13_enterprise';
  var VERSION = 14;

  var THEMES = [
    { id: 'midnight', label: 'Midnight' },
    { id: 'ocean', label: 'Ocean' },
    { id: 'light', label: 'Light' },
    { id: 'system', label: 'System' }
  ];

  var state = { v: VERSION, activeUser: null, users: {} };
  var saveTimer = null;
  var listeners = [];

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function blankUser(name) {
    return {
      name: name || 'User',
      pinHash: null, pinSalt: null, pinIter: 0, legacyPin: null,
      theme: 'midnight',
      weekStart: 1,
      createdAt: Date.now(),
      quickNotes: '',
      days: {}, weeks: {}, months: {}, years: {}, archives: {},
      trash: [], lastExportAt: 0, backupSnoozeUntil: 0,
      recurring: [], templates: [], capacityMin: 480,
      reviewDay: 0, reviewSnoozeUntil: 0,
      settings: { carryOver: true, autoArchive: true, requirePin: true, panicBlur: false }
    };
  }

  function blankDay() { return { intention: '', notes: '', todos: [], blocks: [] }; }

  function emit(type, detail) {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](type, detail); } catch (e) { /* listener must not break saving */ }
    }
  }

  function on(fn) { listeners.push(fn); }

  /* ---------------- persistence ---------------- */

  var DB_NAME = 'planner-pro';
  var DB_STORE = 'docs';
  var BLOB_STORE = 'blobs';
  var DB_VERSION = 2;
  var dbPromise = null;
  var backend = 'ls';          // 'idb' or 'ls'
  var lastWriteError = null;

  function readRaw(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function fresh() { return { v: VERSION, activeUser: null, users: {} }; }

  /* ---- IndexedDB ---- */

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!global.indexedDB) { reject(new Error('no-indexeddb')); return; }
      var req = global.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
        if (!db.objectStoreNames.contains(BLOB_STORE)) db.createObjectStore(BLOB_STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('idb-open-failed')); };
      req.onblocked = function () { reject(new Error('idb-blocked')); };
    });
    return dbPromise;
  }

  function idb(mode, fn, storeName) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName || DB_STORE, mode);
        var request = fn(tx.objectStore(storeName || DB_STORE));
        tx.oncomplete = function () { resolve(request ? request.result : undefined); };
        tx.onerror = function () { reject(tx.error || new Error('idb-tx-failed')); };
        tx.onabort = function () { reject(tx.error || new Error('idb-tx-aborted')); };
      });
    });
  }

  /* ---- gzip, when the browser has it ---- */

  function pack(value) {
    var json = JSON.stringify(value);
    if (!global.CompressionStream || typeof global.Blob !== 'function') {
      return Promise.resolve({ v: 1, gz: false, json: json });
    }
    try {
      var stream = new global.Blob([json]).stream().pipeThrough(new global.CompressionStream('gzip'));
      return new global.Response(stream).arrayBuffer().then(function (buf) {
        return { v: 1, gz: true, buf: buf };
      });
    } catch (e) {
      return Promise.resolve({ v: 1, gz: false, json: json });
    }
  }

  function unpack(record) {
    if (!record) return Promise.resolve(null);
    if (typeof record === 'string') {
      try { return Promise.resolve(JSON.parse(record)); } catch (e) { return Promise.resolve(null); }
    }
    if (!record.gz) {
      try { return Promise.resolve(JSON.parse(record.json)); } catch (e) { return Promise.resolve(null); }
    }
    try {
      var stream = new global.Blob([record.buf]).stream().pipeThrough(new global.DecompressionStream('gzip'));
      return new global.Response(stream).text().then(function (text) { return JSON.parse(text); });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  /* ---- load ---- */

  function load() {
    var lsRaw = readRaw(KEY);
    var legacyRaw = readRaw(LEGACY_KEY);

    return openDb().then(function () {
      backend = 'idb';
      return idb('readonly', function (store) { return store.get(KEY); });
    }).then(function (record) {
      return unpack(record);
    }).then(function (fromDb) {
      if (fromDb && typeof fromDb === 'object') {
        state = fromDb;
        return finishLoad();
      }
      if (lsRaw) {
        // first run on this build: lift the localStorage document into IndexedDB
        try {
          state = JSON.parse(lsRaw);
        } catch (e) {
          try { localStorage.setItem(KEY + '_corrupt_' + Date.now(), lsRaw); } catch (e2) {}
          state = fresh();
        }
        normalize();
        return persistNow().then(function (ok) {
          if (ok) { try { localStorage.removeItem(KEY); } catch (e) {} }
          return state;
        });
      }
      if (legacyRaw) { state = migrateV13(legacyRaw); return finishLoad(); }
      state = fresh();
      return finishLoad();
    }).catch(function () {
      // no IndexedDB (file://, private window, blocked storage): stay on localStorage
      backend = 'ls';
      if (lsRaw) {
        try { state = JSON.parse(lsRaw); }
        catch (e) {
          try { localStorage.setItem(KEY + '_corrupt_' + Date.now(), lsRaw); } catch (e2) {}
          state = fresh();
        }
      } else if (legacyRaw) {
        state = migrateV13(legacyRaw);
      } else {
        state = fresh();
      }
      return finishLoad();
    });
  }

  function finishLoad() {
    normalize();
    return state;
  }

  function normalize() {
    if (!state || typeof state !== 'object') state = { v: VERSION, activeUser: null, users: {} };
    if (!state.users || typeof state.users !== 'object') state.users = {};
    state.v = VERSION;

    // v14.0–14.5 keyed profiles by their PIN. Move them to opaque ids so the PIN
    // is no longer sitting in the document as a key; the hash lands on next unlock.
    Object.keys(state.users).forEach(function (key) {
      if (!/^\d{4}$/.test(key)) return;
      var legacy = state.users[key];
      var id = 'u_' + Math.random().toString(36).slice(2, 10);
      if (legacy && typeof legacy === 'object' && !legacy.legacyPin) legacy.legacyPin = key;
      state.users[id] = legacy;
      delete state.users[key];
      if (state.activeUser === key) state.activeUser = id;
    });
    Object.keys(state.users).forEach(function (pin) {
      var u = state.users[pin];
      if (!u || typeof u !== 'object') { delete state.users[pin]; return; }
      var base = blankUser(u.name);
      for (var k in base) if (u[k] === undefined) u[k] = base[k];
      if (!u.settings || typeof u.settings !== 'object') u.settings = { carryOver: true, autoArchive: true, requirePin: true };
      if (u.settings.carryOver === undefined) u.settings.carryOver = true;
      if (u.settings.autoArchive === undefined) u.settings.autoArchive = true;
      if (u.settings.requirePin === undefined) u.settings.requirePin = true;
      if (u.settings.panicBlur === undefined) u.settings.panicBlur = false;
      ['days', 'weeks', 'months', 'years', 'archives'].forEach(function (k) {
        if (!u[k] || typeof u[k] !== 'object') u[k] = {};
      });
      if (!Array.isArray(u.trash)) u.trash = [];
      if (typeof u.lastExportAt !== 'number') u.lastExportAt = 0;
      if (typeof u.backupSnoozeUntil !== 'number') u.backupSnoozeUntil = 0;
      if (!Array.isArray(u.recurring)) u.recurring = [];
      if (!Array.isArray(u.templates)) u.templates = [];
      if (typeof u.capacityMin !== 'number' || u.capacityMin <= 0) u.capacityMin = 480;
      if (typeof u.reviewDay !== 'number') u.reviewDay = 0;
      if (typeof u.reviewSnoozeUntil !== 'number') u.reviewSnoozeUntil = 0;
      if (u.pinHash === undefined) u.pinHash = null;
      if (u.pinSalt === undefined) u.pinSalt = null;
      if (u.pinIter === undefined) u.pinIter = 0;
      if (u.legacyPin === undefined) u.legacyPin = null;
      Object.keys(u.days).forEach(function (dk) {
        var d = u.days[dk];
        if (!d || typeof d !== 'object') { delete u.days[dk]; return; }
        if (!Array.isArray(d.todos)) d.todos = [];
        if (!Array.isArray(d.blocks)) d.blocks = [];
        d.todos.forEach(function (t) { if (!t.id) t.id = uid(); });
        d.blocks.forEach(function (b) { if (!b.id) b.id = uid(); });
      });
    });
    if (state.activeUser && !state.users[state.activeUser]) state.activeUser = null;
  }

  function persistNow() {
    var snapshot = state;

    if (backend === 'ls') {
      try {
        localStorage.setItem(KEY, JSON.stringify(snapshot));
        emit('saved');
        return Promise.resolve(true);
      } catch (e) {
        emit('error', e);
        return Promise.resolve(false);
      }
    }

    return pack(snapshot).then(function (record) {
      return idb('readwrite', function (store) { return store.put(record, KEY); });
    }).then(function () {
      lastWriteError = null;
      emit('saved');
      return true;
    }).catch(function (e) {
      // never lose an edit: fall back to localStorage for this write
      try { localStorage.setItem(KEY, JSON.stringify(snapshot)); } catch (e2) { /* full */ }
      lastWriteError = e;
      emit('error', e);
      return false;
    });
  }

  /** Debounced save — safe to call on every keystroke. */
  function save() {
    if (saveTimer) clearTimeout(saveTimer);
    emit('saving');
    saveTimer = setTimeout(function () { saveTimer = null; persistNow(); }, 220);
  }

  function saveNow() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    persistNow();
    return true;
  }

  /* ---------------- v13 migration ---------------- */

  function migrateV13(raw) {
    var old;
    try { old = JSON.parse(raw); } catch (e) { return { v: VERSION, activeUser: null, users: {} }; }
    var out = { v: VERSION, activeUser: null, users: {} };

    function mapTodos(list) {
      return (list || []).map(function (t) {
        return { id: uid(), text: String(t && t.text != null ? t.text : t || ''), done: !!(t && t.done), prio: false };
      }).filter(function (t) { return t.text; });
    }
    function mapBlocks(list) {
      return (list || []).map(function (s) {
        return {
          id: uid(),
          start: (s && (s.time || s.start)) || '',
          end: '',
          text: (s && (s.task || s.text)) || ''
        };
      }).filter(function (b) { return b.text || b.start; });
    }
    function mapDay(d) {
      d = d || {};
      return {
        intention: d.intention || '',
        notes: d.notes || '',
        todos: mapTodos(d.todos),
        blocks: mapBlocks(d.schedule)
      };
    }

    Object.keys(old.users || {}).forEach(function (pin) {
      var o = old.users[pin] || {};
      var u = blankUser(o.name || 'User');
      u.theme = o.theme || 'midnight';
      u.quickNotes = o.quickNotes || '';
      u.createdAt = o.createdAt || Date.now();

      var data = o.data || {};
      Object.keys(data).forEach(function (y) {
        var yd = data[y] || {};
        Object.keys(yd.daily || {}).forEach(function (dk) {
          if (!global.DateUtil.isKey(dk)) return;
          u.days[dk] = mapDay(yd.daily[dk]);
        });
        // v13 weekly/monthly plans were not bound to real dates — keep them
        // as year goals instead of inventing a week they never belonged to.
        var yr = u.years[y] || { theme: '', goals: [] };
        if (!Array.isArray(yr.goals)) yr.goals = [];
        Object.keys(yd.weekly || {}).forEach(function (k) {
          (yd.weekly[k] || []).forEach(function (t) {
            if (!t || !t.text) return;
            yr.goals.push({
              id: uid(), done: !!t.done, legacy: true,
              text: 'Weekly · ' + k.replace('week-', '') + ' — ' + t.text
            });
          });
        });
        Object.keys(yd.yearly || {}).forEach(function (k) {
          (yd.yearly[k] || []).forEach(function (t) {
            if (!t || !t.text) return;
            yr.goals.push({
              id: uid(), done: !!t.done, legacy: true,
              text: k.replace('year-', '') + ' — ' + t.text
            });
          });
        });
        u.years[y] = yr;
      });

      Object.keys(o.archives || {}).forEach(function (y) {
        var a = o.archives[y] || {};
        var snap = { days: {}, weeks: {}, months: {}, years: {} };
        Object.keys(a.daily || {}).forEach(function (dk) {
          if (!global.DateUtil.isKey(dk)) return;
          snap.days[dk] = mapDay(a.daily[dk]);
        });
        var goals = [];
        Object.keys(a.yearly || {}).forEach(function (k) {
          (a.yearly[k] || []).forEach(function (t) {
            if (!t || !t.text) return;
            goals.push({ id: uid(), done: !!t.done, legacy: true, text: k.replace('year-', '') + ' — ' + t.text });
          });
        });
        snap.years[y] = { theme: '', goals: goals };
        u.archives[y] = snap;
      });

      out.users[pin] = u;
    });

    // v13 remembered the logged-in user, which let anyone open the app without a PIN.
    out.activeUser = null;
    return out;
  }

  /* ---------------- accessors ---------------- */

  function user() {
    return state.activeUser ? state.users[state.activeUser] : null;
  }

  function users() {
    return Object.keys(state.users).map(function (id) {
      return { id: id, name: state.users[id].name, user: state.users[id] };
    });
  }

  function day(key, create) {
    var u = user();
    if (!u || !key) return null;
    if (!u.days[key]) {
      if (!create) return null;
      u.days[key] = blankDay();
    }
    return u.days[key];
  }

  function peekDay(key) { return day(key, false); }

  function week(key, create) {
    var u = user();
    if (!u || !key) return null;
    if (!u.weeks[key]) {
      if (!create) return null;
      u.weeks[key] = { focus: '', todos: [] };
    }
    if (!Array.isArray(u.weeks[key].todos)) u.weeks[key].todos = [];
    return u.weeks[key];
  }

  function month(key, create) {
    var u = user();
    if (!u || !key) return null;
    if (!u.months[key]) {
      if (!create) return null;
      u.months[key] = { focus: '', goals: [] };
    }
    if (!Array.isArray(u.months[key].goals)) u.months[key].goals = [];
    return u.months[key];
  }

  function year(y, create) {
    var u = user();
    if (!u) return null;
    var k = String(y);
    if (!u.years[k]) {
      if (!create) return null;
      u.years[k] = { theme: '', goals: [] };
    }
    if (!Array.isArray(u.years[k].goals)) u.years[k].goals = [];
    return u.years[k];
  }

  /* ---------------- users & auth ----------------
     Profiles are keyed by an opaque id. The PIN is stored as a PBKDF2-SHA256
     hash with a per-profile salt, never in the clear. A profile created by an
     older build still carries `legacyPin`; it is hashed on the first successful
     unlock and the plaintext is deleted. */

  var PIN_ITERATIONS = 120000;

  function toB64(buf) {
    var bytes = new Uint8Array(buf);
    var out = '';
    for (var i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    return global.btoa(out);
  }

  function fromB64(text) {
    var raw = global.atob(text);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function cryptoReady() {
    return !!(global.crypto && global.crypto.subtle && global.btoa);
  }

  function derivePin(pin, salt, iterations) {
    var material = global.crypto.subtle.importKey(
      'raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveBits']
    );
    return material.then(function (key) {
      return global.crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
        key, 256
      );
    }).then(toB64);
  }

  function hashPin(pin) {
    if (!cryptoReady()) return Promise.resolve(null);
    var salt = global.crypto.getRandomValues(new Uint8Array(16));
    return derivePin(pin, salt, PIN_ITERATIONS).then(function (hash) {
      return { salt: toB64(salt), hash: hash, iterations: PIN_ITERATIONS };
    });
  }

  /** Replace the plaintext PIN with a hash, in place. */
  function harden(userId, pin) {
    var u = state.users[userId];
    if (!u) return Promise.resolve(false);
    return hashPin(pin).then(function (result) {
      if (!result) return false;
      u.pinSalt = result.salt;
      u.pinHash = result.hash;
      u.pinIter = result.iterations;
      u.legacyPin = null;
      persist();
      return true;
    }).catch(function () { return false; });
  }

  function verifyPin(u, pin) {
    if (!u) return Promise.resolve(false);
    if (u.pinHash && u.pinSalt) {
      return derivePin(pin, fromB64(u.pinSalt), u.pinIter || PIN_ITERATIONS)
        .then(function (hash) { return hash === u.pinHash; })
        .catch(function () { return false; });
    }
    if (u.legacyPin) return Promise.resolve(String(pin) === String(u.legacyPin));
    return Promise.resolve(false);
  }



  function hasUser(id) { return !!state.users[id]; }

  /** Is this PIN already used by another profile? (Compares hashes.) */
  function pinTaken(pin, exceptId) {
    var ids = Object.keys(state.users).filter(function (id) { return id !== exceptId; });
    return Promise.all(ids.map(function (id) {
      return verifyPin(state.users[id], pin);
    })).then(function (results) {
      return results.some(Boolean);
    });
  }

  /**
   * Creates a profile. Returns synchronously; the PIN is hashed in the
   * background (a few milliseconds) and the plaintext never touches storage
   * beyond this call.
   */
  function addUser(name, pin) {
    if (!name || !/^\d{4}$/.test(String(pin))) return { ok: false, error: 'Enter a name and a 4-digit PIN.' };
    var id = 'u_' + Math.random().toString(36).slice(2, 10);
    var user = blankUser(name);
    if (cryptoReady()) user.legacyPin = String(pin);   // hashed immediately below
    else user.legacyPin = String(pin);                 // no WebCrypto: plaintext stays
    state.users[id] = user;
    state.activeUser = id;
    saveNow();
    if (cryptoReady()) harden(id, String(pin));
    return { ok: true, id: id };
  }

  /** Unlock a profile. Resolves true when the PIN matches. */
  function auth(id, pin) {
    var u = state.users[id];
    if (!u) return Promise.resolve(false);
    return verifyPin(u, pin).then(function (ok) {
      if (!ok) return false;
      state.activeUser = id;
      saveNow();
      // finish the upgrade before reporting success, so a caller that unlocks
      // and then reloads cannot race the hash write
      if (u.legacyPin && cryptoReady()) {
        return harden(id, pin).then(function () { return true; });
      }
      return true;
    });
  }

  /** Switch to a profile without a PIN check — internal and test use only. */
  function activate(id) {
    if (!state.users[id]) return false;
    state.activeUser = id;
    saveNow();
    return true;
  }

  function lock() {
    state.activeUser = null;
    saveNow();
    emit('locked');
  }

  function renameUser(name) {
    var u = user();
    if (!u || !name.trim()) return false;
    u.name = name.trim();
    save();
    return true;
  }

  function changePin(currentPin, nextPin) {
    var id = state.activeUser;
    var u = state.users[id];
    if (!u) return Promise.resolve({ ok: false, error: 'Not signed in.' });
    if (!/^\d{4}$/.test(String(nextPin))) {
      return Promise.resolve({ ok: false, error: 'New PIN must be 4 digits.' });
    }
    return verifyPin(u, currentPin).then(function (ok) {
      if (!ok) return { ok: false, error: 'Current PIN is incorrect.' };
      return pinTaken(nextPin, id).then(function (taken) {
        if (taken) return { ok: false, error: 'That PIN is already used by another profile.' };
        u.pinHash = null;
        u.pinSalt = null;
        u.pinIter = 0;
        u.legacyPin = String(nextPin);
        saveNow();
        return harden(id, String(nextPin)).then(function () { return { ok: true }; });
      });
    });
  }

  function removeUser(id) {
    delete state.users[id];
    if (state.activeUser === id) state.activeUser = null;
    saveNow();
  }

  /* ---------------- archiving ---------------- */

  function sliceYear(u, y) {
    var ys = String(y);
    var snap = { days: {}, weeks: {}, months: {}, years: {} };
    var moved = 0;
    Object.keys(u.days).forEach(function (k) {
      if (k.slice(0, 4) === ys) { snap.days[k] = u.days[k]; delete u.days[k]; moved++; }
    });
    Object.keys(u.weeks).forEach(function (k) {
      if (k.slice(0, 4) === ys) { snap.weeks[k] = u.weeks[k]; delete u.weeks[k]; moved++; }
    });
    Object.keys(u.months).forEach(function (k) {
      if (k.slice(0, 4) === ys) { snap.months[k] = u.months[k]; delete u.months[k]; moved++; }
    });
    Object.keys(u.years).forEach(function (k) {
      if (k === ys) { snap.years[k] = u.years[k]; delete u.years[k]; moved++; }
    });
    if (!moved) return 0;
    u.archives[ys] = snap;
    return moved;
  }

  function archiveYear(y) {
    var u = user();
    if (!u) return 0;
    var n = sliceYear(u, y);
    saveNow();
    return n;
  }

  function restoreArchive(y) {
    var u = user();
    if (!u || !u.archives[y]) return 0;
    var snap = u.archives[y];
    var moved = 0;
    ['days', 'weeks', 'months', 'years'].forEach(function (k) {
      Object.keys(snap[k] || {}).forEach(function (key) {
        u[k][key] = snap[k][key];
        moved++;
      });
    });
    delete u.archives[y];
    saveNow();
    return moved;
  }

  function removeArchive(y) {
    var u = user();
    if (!u || !u.archives[y]) return false;
    delete u.archives[y];
    saveNow();
    return true;
  }

  /** Move every completed past year into archives. Never touches the current year. */
  function autoArchive() {
    var u = user();
    if (!u || !u.settings.autoArchive) return [];
    var current = new Date().getFullYear();
    var years = {};
    Object.keys(u.days).forEach(function (k) { years[k.slice(0, 4)] = 1; });
    Object.keys(u.weeks).forEach(function (k) { years[k.slice(0, 4)] = 1; });
    Object.keys(u.months).forEach(function (k) { years[k.slice(0, 4)] = 1; });
    Object.keys(u.years).forEach(function (k) { years[k] = 1; });
    var done = [];
    Object.keys(years).forEach(function (y) {
      if (Number(y) < current) {
        if (sliceYear(u, y)) done.push(y);
      }
    });
    if (done.length) saveNow();
    return done;
  }

  /* ---------------- import / export ---------------- */

  function exportJSON() { return JSON.stringify(state, null, 2); }

  function importJSON(text) {
    var parsed;
    try { parsed = JSON.parse(text); } catch (e) { return { ok: false, error: 'That file is not valid JSON.' }; }
    if (!parsed || typeof parsed !== 'object' || !parsed.users) {
      return { ok: false, error: 'This file does not look like a Planner Pro backup.' };
    }
    // keep the current session if that profile still exists in the backup
    var previousActive = state.activeUser;
    state = parsed;
    normalize();
    if (previousActive && state.users[previousActive]) state.activeUser = previousActive;
    saveNow();
    return { ok: true };
  }

  /* ---------------- stats ---------------- */

  function dayStats(key) {
    var d = peekDay(key);
    var total = d ? d.todos.length : 0;
    var done = d ? d.todos.filter(function (t) { return t.done; }).length : 0;
    return { total: total, done: done, pct: total ? Math.round(done / total * 100) : 0 };
  }

  function monthStats(mk) {
    var total = 0, done = 0;
    global.DateUtil.monthDates(mk).forEach(function (k) {
      var s = dayStats(k);
      total += s.total; done += s.done;
    });
    return { total: total, done: done, pct: total ? Math.round(done / total * 100) : 0 };
  }

  /** Consecutive days (ending today, or yesterday if today is still empty) with a completed task. */
  function streak() {
    var k = global.DateUtil.todayKey();
    var s = dayStats(k);
    if (s.done === 0) k = global.DateUtil.addDays(k, -1);
    var count = 0;
    for (var i = 0; i < 730; i++) {
      var st = dayStats(k);
      if (st.done > 0) { count++; k = global.DateUtil.addDays(k, -1); }
      else break;
    }
    return count;
  }

  function weekBars(days) {
    var out = [];
    var t = global.DateUtil.todayKey();
    for (var i = days - 1; i >= 0; i--) {
      var k = global.DateUtil.addDays(t, -i);
      out.push({ key: k, stats: dayStats(k), today: i === 0 });
    }
    return out;
  }

  function usage() {
    var bytes = 0;
    try { bytes = new Blob([JSON.stringify(state)]).size; } catch (e) { bytes = 0; }
    return {
      bytes: bytes,
      kb: Math.round(bytes / 1024),
      backend: backend,
      compressed: backend === 'idb' && !!global.CompressionStream
    };
  }

  function setTheme(theme) {
    var u = user();
    if (!u) return;
    u.theme = theme;
    saveNow();
  }

  function cycleTheme() {
    var u = user();
    if (!u) return null;
    var ids = THEMES.map(function (t) { return t.id; });
    var next = ids[(ids.indexOf(u.theme) + 1) % ids.length];
    setTheme(next);
    return next;
  }

  /* ---------------- trash & undo ----------------
     Deleting is instant, so every destructive action keeps a copy here for 30
     days. `undo` in the UI pops the newest entry; Settings lists all of them. */
  var TRASH_DAYS = 30;
  var DAY_MS = 86400000;

  function trash() {
    var u = user();
    if (!u) return [];
    if (!Array.isArray(u.trash)) u.trash = [];
    var cutoff = Date.now() - TRASH_DAYS * DAY_MS;
    var before = u.trash.length;
    u.trash = u.trash.filter(function (e) { return (e.at || 0) > cutoff; });
    if (u.trash.length !== before) save();
    return u.trash;
  }

  function trashAdd(entry) {
    var u = user();
    if (!u) return null;
    if (!Array.isArray(u.trash)) u.trash = [];
    entry.id = uid();
    entry.at = Date.now();
    u.trash.unshift(entry);
    if (u.trash.length > 300) u.trash.length = 300;
    saveNow();
    return entry;
  }

  function trashRemove(id) {
    var u = user();
    if (!u || !Array.isArray(u.trash)) return null;
    var found = null;
    u.trash = u.trash.filter(function (e) {
      if (e.id === id) { found = e; return false; }
      return true;
    });
    if (found) saveNow();
    return found;
  }

  function trashEmpty() {
    var u = user();
    if (!u) return 0;
    var n = (u.trash || []).length;
    u.trash = [];
    saveNow();
    return n;
  }

  /* ---------------- recurring tasks ----------------
     A rule is a definition; instances are ordinary todos carrying `recurringId`.
     They are materialised lazily when a day is opened, which keeps the stored
     document small and makes a missed day self-heal. */

  function matchesRule(rule, key) {
    var wd = global.DateUtil.weekday(key);
    if (rule.repeat === 'daily') return true;
    if (rule.repeat === 'weekdays') return wd >= 1 && wd <= 5;
    return (rule.days || []).indexOf(wd) >= 0;
  }

  function recurring() {
    var u = user();
    return (u && Array.isArray(u.recurring)) ? u.recurring : [];
  }

  function addRecurring(rule) {
    var u = user();
    if (!u || !rule || !rule.text) return null;
    if (!Array.isArray(u.recurring)) u.recurring = [];
    rule.id = rule.id || uid();
    rule.createdAt = Date.now();
    rule.from = rule.from || global.DateUtil.todayKey();
    if (rule.active === undefined) rule.active = true;
    u.recurring.push(rule);
    saveNow();
    return rule;
  }

  function removeRecurring(id) {
    var u = user();
    if (!u) return false;
    u.recurring = (u.recurring || []).filter(function (r) { return r.id !== id; });
    saveNow();
    return true;
  }

  function toggleRecurring(id) {
    var u = user();
    if (!u) return null;
    var found = null;
    (u.recurring || []).forEach(function (r) { if (r.id === id) { r.active = r.active === false; found = r; } });
    if (found) saveNow();
    return found;
  }

  /** Create any missing instances of the active rules for one date. */
  function ensureRecurring(key) {
    var u = user();
    if (!u || !Array.isArray(u.recurring) || !u.recurring.length) return 0;
    if (!global.DateUtil.isKey(key)) return 0;

    var d = day(key, true);
    var have = {};
    d.todos.forEach(function (t) { if (t.recurringId) have[t.recurringId] = 1; });

    var created = 0;
    u.recurring.forEach(function (r) {
      if (r.active === false || !r.text) return;
      if (r.from && key < r.from) return;
      if (!matchesRule(r, key)) return;
      if (have[r.id]) return;
      d.todos.push({
        id: uid(), text: r.text, done: false, prio: !!r.prio,
        at: r.at || '', tags: (r.tags || []).slice(), est: r.est || 0,
        recurringId: r.id
      });
      created++;
    });
    if (created) save();
    return created;
  }

  function repeatLabel(rule) {
    var names = global.DateUtil.DAYS_SHORT;
    if (rule.repeat === 'daily') return 'every day';
    if (rule.repeat === 'weekdays') return 'weekdays';
    var days = (rule.days || []).slice().sort();
    if (days.length === 1) return 'every ' + names[days[0]];
    return days.map(function (d) { return names[d]; }).join(', ');
  }

  /* ---------------- attachments ----------------
     Files are blobs in IndexedDB, keyed by id; the day only holds metadata, so
     the document stays small and the JSON backup stays readable. Attachments are
     deliberately NOT part of the JSON export — they would turn a 20 KB backup
     into megabytes of base64. Each one can be opened and saved individually. */

  var MAX_ATTACHMENT = 8 * 1024 * 1024;

  function attachmentsSupported() {
    return backend === 'idb' && typeof global.indexedDB !== 'undefined';
  }

  function attachFile(dayKey, file) {
    if (!attachmentsSupported()) return Promise.resolve({ ok: false, error: 'Attachments need IndexedDB' });
    if (!file) return Promise.resolve({ ok: false, error: 'No file' });
    if (file.size > MAX_ATTACHMENT) return Promise.resolve({ ok: false, error: 'Files are limited to 8 MB' });

    var d = day(dayKey, true);
    var id = uid();
    return file.arrayBuffer().then(function (buf) {
      return idb('readwrite', function (store) {
        return store.put({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, buf: buf }, 'file:' + id);
      }, BLOB_STORE);
    }).then(function () {
      if (!Array.isArray(d.files)) d.files = [];
      d.files.push({
        id: id,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        addedAt: Date.now()
      });
      saveNow();
      return { ok: true, id: id };
    }).catch(function (e) {
      return { ok: false, error: 'Could not store that file' };
    });
  }

  function getAttachment(id) {
    return idb('readonly', function (store) { return store.get('file:' + id); }, BLOB_STORE);
  }

  function removeAttachment(dayKey, id) {
    var d = peekDay(dayKey);
    if (d && Array.isArray(d.files)) {
      d.files = d.files.filter(function (f) { return f.id !== id; });
      saveNow();
    }
    return idb('readwrite', function (store) { return store.delete('file:' + id); }, BLOB_STORE)
      .catch(function () { return null; });
  }

  /* ---------------- data health ----------------
     Conservative on purpose: a check may report anything, but a repair only
     fills in missing ids, unlinks dangling recurring references and prunes the
     trash. It never deletes a day, a note or a task. */

  function healthCheck() {
    var u = user();
    if (!u) return null;

    var missingIds = 0, duplicates = 0, emptyText = 0, orphanRules = 0;
    var badKeys = 0, subMissingIds = 0, seen = {};
    var todoCount = 0;

    Object.keys(u.days).forEach(function (k) {
      if (!global.DateUtil.isKey(k)) badKeys++;
      (u.days[k].todos || []).forEach(function (t) {
        todoCount++;
        if (!t.id) missingIds++;
        else if (seen[t.id]) duplicates++;
        else seen[t.id] = 1;
        if (!String(t.text || '').trim()) emptyText++;
        if (t.recurringId && !(u.recurring || []).some(function (r) { return r.id === t.recurringId; })) orphanRules++;
        (t.sub || []).forEach(function (x) { if (!x.id) subMissingIds++; });
      });
      (u.days[k].blocks || []).forEach(function (b) { if (!b.id) missingIds++; });
    });

    var issues = [];
    if (missingIds) issues.push({ code: 'ids', count: missingIds, label: 'Records without an id' });
    if (subMissingIds) issues.push({ code: 'subids', count: subMissingIds, label: 'Subtasks without an id' });
    if (duplicates) issues.push({ code: 'dupes', count: duplicates, label: 'Duplicate ids' });
    if (emptyText) issues.push({ code: 'empty', count: emptyText, label: 'Tasks with no text' });
    if (orphanRules) issues.push({ code: 'orphans', count: orphanRules, label: 'Repeats that no longer exist' });
    if (badKeys) issues.push({ code: 'keys', count: badKeys, label: 'Days with a malformed date key' });

    return {
      size: usage().bytes,
      days: Object.keys(u.days).length,
      todos: todoCount,
      trash: (u.trash || []).length,
      issues: issues,
      clean: issues.length === 0
    };
  }

  /** Fix what can be fixed without guessing. Returns what was changed. */
  function repair() {
    var u = user();
    if (!u) return null;
    var fixed = { ids: 0, dupes: 0, orphans: 0, trash: 0 };
    var seen = {};

    Object.keys(u.days).forEach(function (k) {
      (u.days[k].todos || []).forEach(function (t) {
        if (!t.id) { t.id = uid(); fixed.ids++; }
        else if (seen[t.id]) { t.id = uid(); fixed.dupes++; }
        seen[t.id] = 1;
        (t.sub || []).forEach(function (x) { if (!x.id) { x.id = uid(); fixed.ids++; } });
        if (t.recurringId && !(u.recurring || []).some(function (r) { return r.id === t.recurringId; })) {
          delete t.recurringId;
          fixed.orphans++;
        }
      });
      (u.days[k].blocks || []).forEach(function (b) { if (!b.id) { b.id = uid(); fixed.ids++; } });
    });

    var before = (u.trash || []).length;
    trash();
    fixed.trash = before - (u.trash || []).length;

    saveNow();
    return fixed;
  }

  /* ---------------- CSV import ---------------- */

  /** Merge parsed rows into days. rows: [{date, text, done, tags}] */
  function importRows(rows) {
    var u = user();
    if (!u) return { tasks: 0, days: 0 };
    var touched = {};
    var added = 0;

    (rows || []).forEach(function (row) {
      if (!row || !row.text || !global.DateUtil.isKey(row.date)) return;
      var d = day(row.date, true);
      var exists = d.todos.some(function (t) { return t.text.toLowerCase() === row.text.toLowerCase(); });
      if (exists) return;
      d.todos.push({
        id: uid(), text: row.text, done: !!row.done,
        tags: row.tags || [], est: row.est || 0, at: row.at || ''
      });
      touched[row.date] = 1;
      added++;
    });

    if (added) saveNow();
    return { tasks: added, days: Object.keys(touched).length };
  }

  /* ---------------- reviews ----------------
     A weekly review lives on the week object, a daily one on the day. Both are
     plain data, so they export and archive with everything else. */

  function reviewDay() {
    var u = user();
    if (!u) return -1;
    return (typeof u.reviewDay === 'number') ? u.reviewDay : 0;
  }

  function setReviewDay(index) {
    var u = user();
    if (!u) return;
    u.reviewDay = Number(index);
    saveNow();
  }

  /** Is a weekly review waiting today? */
  function reviewDue() {
    var u = user();
    if (!u) return null;
    var idx = reviewDay();
    if (idx < 0) return null;
    var today = global.DateUtil.todayKey();
    if (global.DateUtil.weekday(today) !== idx) return null;
    if (u.reviewSnoozeUntil && u.reviewSnoozeUntil >= today) return null;
    var wk = global.DateUtil.weekStartKey(today, u.weekStart);
    var w = week(wk, true);
    if (w.review && w.review.at) return null;
    return { weekKey: wk };
  }

  function snoozeReview() {
    var u = user();
    if (!u) return;
    u.reviewSnoozeUntil = global.DateUtil.addDays(global.DateUtil.todayKey(), 1);
    saveNow();
  }

  /** Plain-text summary of a week, used to seed the review. */
  function weekSummary(weekKey) {
    var dates = global.DateUtil.weekDates(weekKey);
    var done = [];
    var total = 0, completed = 0, planned = 0;
    dates.forEach(function (k) {
      var d = peekDay(k);
      if (!d) return;
      var counted = false;
      (d.todos || []).forEach(function (t) {
        total++;
        if (t.done) { completed++; done.push(t.text); }
      });
      if ((d.todos || []).length) counted = true;
      if (counted) planned++;
    });
    var w = week(weekKey, true);
    return {
      weekKey: weekKey,
      daysPlanned: planned,
      tasksDone: completed,
      tasksTotal: total,
      completedText: done,
      goalsDone: (w.todos || []).filter(function (t) { return t.done; }).length,
      goalsTotal: (w.todos || []).length,
      focus: w.focus || ''
    };
  }

  /* ---------------- templates ---------------- */

  function templates() {
    var u = user();
    return (u && Array.isArray(u.templates)) ? u.templates : [];
  }

  function addTemplate(tpl) {
    var u = user();
    if (!u || !tpl || !tpl.name) return null;
    if (!Array.isArray(u.templates)) u.templates = [];
    tpl.id = uid();
    tpl.createdAt = Date.now();
    u.templates.push(tpl);
    saveNow();
    return tpl;
  }

  function removeTemplate(id) {
    var u = user();
    if (!u) return false;
    u.templates = (u.templates || []).filter(function (t) { return t.id !== id; });
    saveNow();
    return true;
  }

  /* ---------------- daily capacity ---------------- */

  function capacity() {
    var u = user();
    return (u && u.capacityMin) || 480;
  }

  function setCapacity(minutes) {
    var u = user();
    if (!u) return;
    var n = Math.round(Number(minutes));
    if (!n || n < 30) n = 30;
    if (n > 1440) n = 1440;
    u.capacityMin = n;
    saveNow();
  }

  /** Total estimated minutes for a day (0 when nothing is estimated). */
  function dayLoad(key) {
    var d = peekDay(key);
    var total = 0;
    var estimated = 0;
    if (d) {
      d.todos.forEach(function (t) {
        if (t.est) { total += t.est; estimated++; }
      });
    }
    return { minutes: total, tasks: estimated, capacity: capacity(), over: total > capacity() };
  }

  /** Move a set of todos from one day to another, preserving their fields. */
  function moveTodos(fromKey, ids, toKey) {
    var from = day(fromKey, true);
    var to = day(toKey, true);
    var moved = [];
    from.todos = from.todos.filter(function (t) {
      if (ids.indexOf(t.id) < 0) return true;
      to.todos.push(t);
      moved.push(t.id);
      return false;
    });
    if (moved.length) saveNow();
    return moved.length;
  }

  /* ---------------- insight aggregates ---------------- */

  /** Every day of a calendar year, with its completion counts. */
  function heatmap(year) {
    var out = [];
    var first = global.DateUtil.toKey(new Date(year, 0, 1));
    var last = global.DateUtil.toKey(new Date(year, 11, 31));
    var k = first;
    while (k <= last) {
      var st = dayStats(k);
      out.push({ key: k, done: st.done, total: st.total });
      k = global.DateUtil.addDays(k, 1);
    }
    return out;
  }

  /** Longest run of consecutive days with at least one completed task. */
  function bestStreak() {
    var u = user();
    if (!u) return 0;
    var keys = Object.keys(u.days).sort();
    var best = 0, run = 0, prev = null;
    keys.forEach(function (k) {
      if (dayStats(k).done > 0) {
        run = (prev && global.DateUtil.diffDays(k, prev) === 1) ? run + 1 : 1;
        if (run > best) best = run;
        prev = k;
      } else {
        run = 0;
        prev = null;
      }
    });
    return best;
  }

  /** tag → count, most used first. */
  function tagIndex() {
    var u = user();
    if (!u) return [];
    var counts = {};
    Object.keys(u.days).forEach(function (k) {
      (u.days[k].todos || []).forEach(function (t) {
        (t.tags || []).forEach(function (tag) { counts[tag] = (counts[tag] || 0) + 1; });
      });
    });
    return Object.keys(counts).map(function (tag) {
      return { tag: tag, count: counts[tag] };
    }).sort(function (a, b) { return b.count - a.count || a.tag.localeCompare(b.tag); });
  }

  /** Completion per day for the last N days, oldest first. */
  function trend(days) {
    var out = [];
    var today = global.DateUtil.todayKey();
    for (var i = (days || 30) - 1; i >= 0; i--) {
      var k = global.DateUtil.addDays(today, -i);
      var st = dayStats(k);
      out.push({ key: k, done: st.done, total: st.total });
    }
    return out;
  }

  function insights() {
    var u = user();
    if (!u) return null;
    var planned = 0, total = 0, done = 0;
    var byWeekday = [0, 0, 0, 0, 0, 0, 0];
    Object.keys(u.days).forEach(function (k) {
      var st = dayStats(k);
      if (st.total) planned++;
      total += st.total;
      done += st.done;
      byWeekday[global.DateUtil.weekday(k)] += st.done;
    });
    var busiest = 0;
    byWeekday.forEach(function (n, i) { if (n > byWeekday[busiest]) busiest = i; });

    return {
      daysPlanned: planned,
      tasksTotal: total,
      tasksDone: done,
      pct: total ? Math.round(done / total * 100) : 0,
      bestStreak: bestStreak(),
      currentStreak: streak(),
      byWeekday: byWeekday,
      busiestWeekday: busiest,
      tags: tagIndex(),
      rules: (u.recurring || []).length
    };
  }

  /* ---------------- backup nudge ---------------- */

  function markExported() {
    var u = user();
    if (!u) return;
    u.lastExportAt = Date.now();
    saveNow();
  }

  function backupStatus() {
    var u = user();
    if (!u) return null;
    var hasData = Object.keys(u.days).length > 0;
    var days = u.lastExportAt ? Math.floor((Date.now() - u.lastExportAt) / DAY_MS) : null;
    var snoozed = !!u.backupSnoozeUntil && u.backupSnoozeUntil > Date.now();
    return {
      hasData: hasData,
      days: days,
      snoozed: snoozed,
      due: hasData && !snoozed && (days === null || days >= 14)
    };
  }

  function snoozeBackup(days) {
    var u = user();
    if (!u) return;
    u.backupSnoozeUntil = Date.now() + (days || 3) * DAY_MS;
    saveNow();
  }

  global.Store = {
    VERSION: VERSION, THEMES: THEMES, TRASH_DAYS: TRASH_DAYS,
    load: load, save: save, saveNow: saveNow, on: on,
    state: function () { return state; },
    user: user, users: users, hasUser: hasUser, addUser: addUser, auth: auth, activate: activate,
    verifyPin: verifyPin, hashPin: hashPin, pinTaken: pinTaken, lock: lock,
    renameUser: renameUser, changePin: changePin, removeUser: removeUser,
    day: day, peekDay: peekDay, week: week, month: month, year: year, moveTodos: moveTodos,
    archiveYear: archiveYear, restoreArchive: restoreArchive,
    removeArchive: removeArchive, autoArchive: autoArchive,
    exportJSON: exportJSON, importJSON: importJSON,
    dayStats: dayStats, monthStats: monthStats, streak: streak, weekBars: weekBars,
    usage: usage, setTheme: setTheme, cycleTheme: cycleTheme,
    trash: trash, trashAdd: trashAdd, trashRemove: trashRemove, trashEmpty: trashEmpty,
    recurring: recurring, addRecurring: addRecurring, removeRecurring: removeRecurring,
    toggleRecurring: toggleRecurring, ensureRecurring: ensureRecurring, repeatLabel: repeatLabel,
    templates: templates, addTemplate: addTemplate, removeTemplate: removeTemplate,
    healthCheck: healthCheck, repair: repair, importRows: importRows,
    attachFile: attachFile, getAttachment: getAttachment, removeAttachment: removeAttachment,
    attachmentsSupported: attachmentsSupported, MAX_ATTACHMENT: MAX_ATTACHMENT,
    reviewDay: reviewDay, setReviewDay: setReviewDay, reviewDue: reviewDue,
    snoozeReview: snoozeReview, weekSummary: weekSummary,
    capacity: capacity, setCapacity: setCapacity, dayLoad: dayLoad,
    heatmap: heatmap, bestStreak: bestStreak, tagIndex: tagIndex, trend: trend, insights: insights,
    markExported: markExported, backupStatus: backupStatus, snoozeBackup: snoozeBackup,
    uid: uid, blankDay: blankDay
  };
})(window);
