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
      theme: 'midnight',
      weekStart: 1,
      createdAt: Date.now(),
      quickNotes: '',
      days: {}, weeks: {}, months: {}, years: {}, archives: {},
      settings: { carryOver: true, autoArchive: true, requirePin: true }
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

  function readRaw(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function load() {
    var raw = readRaw(KEY);
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') state = parsed;
      } catch (e) {
        // corrupt document: keep a copy so nothing is silently destroyed
        try { localStorage.setItem(KEY + '_corrupt_' + Date.now(), raw); } catch (e2) {}
        state = { v: VERSION, activeUser: null, users: {} };
      }
    } else {
      var legacy = readRaw(LEGACY_KEY);
      if (legacy) state = migrateV13(legacy);
    }
    normalize();
    return state;
  }

  function normalize() {
    if (!state || typeof state !== 'object') state = { v: VERSION, activeUser: null, users: {} };
    if (!state.users || typeof state.users !== 'object') state.users = {};
    state.v = VERSION;
    Object.keys(state.users).forEach(function (pin) {
      var u = state.users[pin];
      if (!u || typeof u !== 'object') { delete state.users[pin]; return; }
      var base = blankUser(u.name);
      for (var k in base) if (u[k] === undefined) u[k] = base[k];
      if (!u.settings || typeof u.settings !== 'object') u.settings = { carryOver: true, autoArchive: true, requirePin: true };
      if (u.settings.carryOver === undefined) u.settings.carryOver = true;
      if (u.settings.autoArchive === undefined) u.settings.autoArchive = true;
      if (u.settings.requirePin === undefined) u.settings.requirePin = true;
      ['days', 'weeks', 'months', 'years', 'archives'].forEach(function (k) {
        if (!u[k] || typeof u[k] !== 'object') u[k] = {};
      });
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

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      emit('saved');
      return true;
    } catch (e) {
      emit('error', e);
      return false;
    }
  }

  /** Debounced save — safe to call on every keystroke. */
  function save() {
    if (saveTimer) clearTimeout(saveTimer);
    emit('saving');
    saveTimer = setTimeout(function () { saveTimer = null; persist(); }, 220);
  }

  function saveNow() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    return persist();
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
    return Object.keys(state.users).map(function (pin) {
      return { pin: pin, name: state.users[pin].name, user: state.users[pin] };
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

  /* ---------------- users & auth ---------------- */

  function hasUser(pin) { return !!state.users[pin]; }

  function addUser(name, pin) {
    if (!name || !/^\d{4}$/.test(String(pin))) return { ok: false, error: 'Enter a name and a 4-digit PIN.' };
    if (state.users[pin]) return { ok: false, error: 'That PIN is already in use. Pick another.' };
    state.users[pin] = blankUser(name);
    state.activeUser = pin;
    saveNow();
    return { ok: true, pin: pin };
  }

  function auth(pin) {
    if (!state.users[pin]) return false;
    state.activeUser = pin;
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
    var u = user();
    if (!u) return { ok: false, error: 'Not signed in.' };
    if (state.activeUser !== currentPin) return { ok: false, error: 'Current PIN is incorrect.' };
    if (!/^\d{4}$/.test(String(nextPin))) return { ok: false, error: 'New PIN must be 4 digits.' };
    if (state.users[nextPin]) return { ok: false, error: 'That PIN is already used by another profile.' };
    delete state.users[currentPin];
    state.users[nextPin] = u;
    state.activeUser = nextPin;
    saveNow();
    return { ok: true };
  }

  function removeUser(pin) {
    delete state.users[pin];
    if (state.activeUser === pin) state.activeUser = null;
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
    return { bytes: bytes, kb: Math.round(bytes / 1024) };
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

  global.Store = {
    VERSION: VERSION, THEMES: THEMES,
    load: load, save: save, saveNow: saveNow, on: on,
    state: function () { return state; },
    user: user, users: users, hasUser: hasUser, addUser: addUser, auth: auth, lock: lock,
    renameUser: renameUser, changePin: changePin, removeUser: removeUser,
    day: day, peekDay: peekDay, week: week, month: month, year: year,
    archiveYear: archiveYear, restoreArchive: restoreArchive,
    removeArchive: removeArchive, autoArchive: autoArchive,
    exportJSON: exportJSON, importJSON: importJSON,
    dayStats: dayStats, monthStats: monthStats, streak: streak, weekBars: weekBars,
    usage: usage, setTheme: setTheme, cycleTheme: cycleTheme,
    uid: uid, blankDay: blankDay
  };
})(window);
