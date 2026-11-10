/* Planner Pro — date helpers
   All keys are local-time strings: day = YYYY-MM-DD, month = YYYY-MM.
   Weeks are keyed by their start date (respects the user's week-start setting),
   which is safer than ISO week numbers across year boundaries. */
(function (global) {
  'use strict';

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function pad(n) { return String(n).padStart(2, '0'); }

  function toKey(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function fromKey(key) {
    var p = String(key).split('-').map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
  }

  function isKey(key) { return /^\d{4}-\d{2}-\d{2}$/.test(String(key || '')); }

  function todayKey() { return toKey(new Date()); }

  function addDays(key, n) {
    var d = fromKey(key);
    d.setDate(d.getDate() + n);
    return toKey(d);
  }

  function addMonths(key, n) {
    var d = fromKey(key);
    var day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return toKey(d);
  }

  function addYears(key, n) {
    var d = fromKey(key);
    var day = d.getDate();
    d.setDate(1);
    d.setFullYear(d.getFullYear() + n);
    var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return toKey(d);
  }

  function monthKey(key) { return String(key).slice(0, 7); }

  function yearOf(key) { return Number(String(key).slice(0, 4)); }

  function weekday(key) { return fromKey(key).getDay(); }

  /** Start of the week containing `key`, honouring weekStart (1 = Monday, 0 = Sunday). */
  function weekStartKey(key, weekStart) {
    var ws = (weekStart === 0) ? 0 : 1;
    var d = fromKey(key);
    var diff = (d.getDay() - ws + 7) % 7;
    d.setDate(d.getDate() - diff);
    return toKey(d);
  }

  function weekDates(startKey) {
    var out = [];
    for (var i = 0; i < 7; i++) out.push(addDays(startKey, i));
    return out;
  }

  /** ISO-8601 week number, used only for labels. */
  function isoWeekNumber(key) {
    var d = fromKey(key);
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var dayNum = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil((((t - yearStart) / 86400000) + 1) / 7);
  }

  function prettyDay(key) {
    var d = fromKey(key);
    return DAYS_SHORT[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear();
  }

  function longDay(key) {
    var d = fromKey(key);
    return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function shortDay(key) {
    var d = fromKey(key);
    return DAYS_SHORT[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()];
  }

  function relative(key) {
    var t = todayKey();
    if (key === t) return 'Today';
    if (key === addDays(t, 1)) return 'Tomorrow';
    if (key === addDays(t, -1)) return 'Yesterday';
    return '';
  }

  function monthLabel(mk) {
    var p = mk.split('-');
    return MONTHS[Number(p[1]) - 1] + ' ' + p[0];
  }

  function monthShort(mk) {
    var p = mk.split('-');
    return MONTHS_SHORT[Number(p[1]) - 1];
  }

  function monthDates(mk) {
    var p = mk.split('-').map(Number);
    var last = new Date(p[0], p[1], 0).getDate();
    var out = [];
    for (var i = 1; i <= last; i++) out.push(mk + '-' + pad(i));
    return out;
  }

  function isWeekend(key) {
    var w = weekday(key);
    return w === 0 || w === 6;
  }

  function diffDays(a, b) {
    return Math.round((fromKey(a) - fromKey(b)) / 86400000);
  }

  function greeting(date) {
    var h = (date || new Date()).getHours();
    if (h < 5) return 'Late night';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Good night';
  }

  function nowTime() {
    var d = new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function minutesOf(hhmm) {
    if (!hhmm || hhmm.indexOf(':') < 0) return null;
    var p = hhmm.split(':').map(Number);
    return p[0] * 60 + p[1];
  }

  global.DateUtil = {
    MONTHS: MONTHS, MONTHS_SHORT: MONTHS_SHORT, DAYS: DAYS, DAYS_SHORT: DAYS_SHORT,
    pad: pad, toKey: toKey, fromKey: fromKey, isKey: isKey, todayKey: todayKey,
    addDays: addDays, addMonths: addMonths, addYears: addYears,
    monthKey: monthKey, yearOf: yearOf, weekday: weekday,
    weekStartKey: weekStartKey, weekDates: weekDates, isoWeekNumber: isoWeekNumber,
    prettyDay: prettyDay, longDay: longDay, shortDay: shortDay, relative: relative,
    monthLabel: monthLabel, monthShort: monthShort, monthDates: monthDates,
    isWeekend: isWeekend, diffDays: diffDays, greeting: greeting,
    nowTime: nowTime, minutesOf: minutesOf
  };
})(window);
