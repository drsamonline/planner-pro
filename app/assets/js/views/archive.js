/* Planner Pro — Archive view */
(function (global) {
  'use strict';
  var esc = UI.esc, icon = UI.icon, D = global.DateUtil;
  global.Views = global.Views || {};

  function yearSummary(u, y) {
    var a = u.archives[y];
    if (!a) return null;
    var days = Object.keys(a.days || {}).length;
    var total = 0, done = 0;
    Object.keys(a.days || {}).forEach(function (k) {
      (a.days[k].todos || []).forEach(function (t) { total++; if (t.done) done++; });
    });
    var goals = [];
    Object.keys(a.years || {}).forEach(function (k) { goals = goals.concat(a.years[k].goals || []); });
    var months = {};
    Object.keys(a.days || {}).forEach(function (k) {
      var mk = k.slice(0, 7);
      months[mk] = months[mk] || { total: 0, done: 0 };
      (a.days[k].todos || []).forEach(function (t) { months[mk].total++; if (t.done) months[mk].done++; });
    });
    return { days: days, total: total, done: done, goals: goals, months: months, theme: (a.years && a.years[y] ? a.years[y].theme : '') };
  }

  global.Views.archive = {
    title: 'Archive',
    subtitle: function () { return 'Past years, kept intact and readable'; },

    render: function (p) {
      var u = Store.user();
      var years = Object.keys(u.archives || {}).sort().reverse();
      var selected = /^\d{4}$/.test(String(p || '')) ? String(p) : (years[0] || null);
      var current = new Date().getFullYear();
      var h = '';

      h += '<div class="card"><div class="card-head"><h2>' + icon('archive') + 'Archives</h2>' +
        '<button class="btn btn-ghost btn-sm" data-act="archive-last-year">Archive ' + (current - 1) + '</button></div>' +
        '<p class="small muted">Finished years move here automatically so the live planner stays light. Nothing is deleted — you can restore a year, export it, or remove it for good.</p>' +
        (years.length ? '<div class="year-list">' + years.map(function (y) {
          var s = yearSummary(u, y) || { days: 0, total: 0, done: 0 };
          return '<div class="year-item">' +
            '<b class="num">' + y + '</b>' +
            '<span class="tiny dim">' + s.days + ' days · ' + s.done + '/' + s.total + ' tasks</span>' +
            '<span class="spacer"></span>' +
            '<button class="btn btn-sm ' + (y === selected ? 'btn-ghost' : 'btn-quiet') + '" data-act="go" data-href="#/archive/' + y + '">Open</button>' +
            '<button class="icon-btn flat" data-act="archive-export" data-year="' + y + '" title="Export JSON">' + icon('download') + '</button>' +
            '<button class="icon-btn flat" data-act="archive-restore" data-year="' + y + '" title="Restore to live planner">' + icon('upload') + '</button>' +
            '<button class="icon-btn flat danger" data-act="archive-delete" data-year="' + y + '" title="Delete archive">' + icon('trash') + '</button>' +
            '</div>';
        }).join('') + '</div>' : UI.empty('archive', 'Nothing archived yet. Your first archive appears when the year turns over.')) +
        '</div>';

      if (selected && u.archives[selected]) {
        var s2 = yearSummary(u, selected);
        h += '<div class="grid g2">' +
          '<div class="card"><div class="card-head"><h2>' + icon('star') + selected + ' goals</h2>' +
          (s2.theme ? '<span class="pill">' + esc(s2.theme) + '</span>' : '') + '</div>' +
          (s2.goals.length ? '<div class="rows">' + s2.goals.map(function (g) {
            return '<div class="row' + (g.done ? ' done' : '') + '"><span class="check">' + icon('check') + '</span>' +
              '<span class="row-text">' + esc(g.text) + '</span></div>';
          }).join('') + '</div>' : UI.empty('star', 'No goals recorded for this year.')) +
          '</div>' +
          '<div class="card"><div class="card-head"><h2>' + icon('year') + 'Month by month</h2></div>' +
          '<div class="stack">' + Object.keys(s2.months).sort().map(function (mk) {
            var m = s2.months[mk];
            var pct = m.total ? Math.round(m.done / m.total * 100) : 0;
            return '<div><div class="tiny dim" style="display:flex;justify-content:space-between">' +
              '<span>' + esc(D.monthLabel(mk)) + '</span><span class="num">' + m.done + '/' + m.total + '</span></div>' +
              '<div class="progress' + (pct === 100 && m.total ? ' ok' : '') + '"><i style="width:' + pct + '%"></i></div></div>';
          }).join('') + '</div></div>' +
          '</div>';
      }

      return h;
    }
  };
})(window);
