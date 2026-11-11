/* Planner Pro — Insights: a year at a glance, without a scoreboard. */
(function (global) {
  'use strict';
  var esc = UI.esc, icon = UI.icon, D = global.DateUtil;
  global.Views = global.Views || {};

  var LEVELS = [0, 0, 0, 0, 0];

  function level(cell) {
    if (!cell.done) return 0;
    if (!cell.total) return 1;
    var pct = cell.done / cell.total;
    if (pct >= 1) return 4;
    if (pct >= 0.66) return 3;
    if (pct >= 0.33) return 2;
    return 1;
  }

  function heatmap(year) {
    var cells = Store.heatmap(year);
    if (!cells.length) return '';

    // pad the first week so the grid starts on the right weekday (Monday-first)
    var firstWeekday = (D.weekday(cells[0].key) + 6) % 7;
    var pad = '';
    for (var i = 0; i < firstWeekday; i++) pad += '<span class="heat-cell is-pad"></span>';

    var body = cells.map(function (c) {
      var lvl = level(c);
      var label = D.prettyDay(c.key) + ' · ' + (c.total ? c.done + '/' + c.total + ' done' : 'nothing planned');
      if (!c.total) {
        return '<span class="heat-cell lvl-0" title="' + esc(label) + '"></span>';
      }
      return '<button class="heat-cell lvl-' + lvl + '" data-act="go" data-href="#/day/' + c.key +
        '" title="' + esc(label) + '" aria-label="' + esc(label) + '"></button>';
    }).join('');

    var done = cells.reduce(function (a, c) { return a + c.done; }, 0);
    var planned = cells.filter(function (c) { return c.total; }).length;

    return '<div class="heat-wrap">' +
      '<div class="heat-scroll"><div class="heat-grid">' + pad + body + '</div></div>' +
      '<div class="heat-foot tiny dim">' +
      '<span>' + done + ' tasks completed · ' + planned + ' days planned</span>' +
      '<span class="heat-legend">less ' +
      '<i class="heat-cell lvl-0"></i><i class="heat-cell lvl-1"></i><i class="heat-cell lvl-2"></i>' +
      '<i class="heat-cell lvl-3"></i><i class="heat-cell lvl-4"></i> more</span>' +
      '</div></div>';
  }

  function trendBars(series) {
    var max = 1;
    series.forEach(function (d) { if (d.done > max) max = d.done; });
    // pixel heights, not percentages: a percentage height inside a flex column
    // silently resolves to the content height and the bars all look identical
    var TOP = 56;
    return '<div class="trend">' + series.map(function (d) {
      var px = d.done ? Math.max(4, Math.round(d.done / max * TOP)) : 2;
      return '<span class="trend-col" title="' + esc(D.prettyDay(d.key)) + ' · ' + d.done + ' done">' +
        '<i style="height:' + px + 'px" class="' + (d.done ? '' : 'bar-zero') + '"></i></span>';
    }).join('') + '</div>';
  }

  global.Views.insights = {
    title: 'Insights',
    subtitle: function () { return 'What the year actually looked like'; },

    render: function (p) {
      var y = /^\d{4}$/.test(String(p || '')) ? String(p) : String(new Date().getFullYear());
      var thisYear = String(new Date().getFullYear());
      var data = Store.insights();
      var cells = Store.heatmap(y);
      var withWork = cells.filter(function (c) { return c.total; });
      var yearDone = cells.reduce(function (a, c) { return a + c.done; }, 0);
      var yearTotal = cells.reduce(function (a, c) { return a + c.total; }, 0);
      var series = Store.trend(30);
      var h = '';

      h += '<div class="datebar">' +
        '<button class="icon-btn" data-act="go" data-href="#/insights/' + (Number(y) - 1) + '" aria-label="Previous year">' + icon('left') + '</button>' +
        '<strong style="padding:0 6px;font-size:15px" class="num">' + y + '</strong>' +
        '<button class="icon-btn" data-act="go" data-href="#/insights/' + (Number(y) + 1) + '" aria-label="Next year">' + icon('right') + '</button>' +
        (y === thisYear ? '<span class="pill pill-ok">This year</span>' :
          '<button class="btn btn-ghost btn-sm" data-act="go" data-href="#/insights/' + thisYear + '">This year</button>') +
        '<span class="spacer"></span>' +
        '<button class="btn btn-ghost btn-sm" data-act="print">' + icon('print') + '<span class="btn-label">Print</span></button>' +
        '</div>';

      h += '<section class="stats">' +
        '<div class="stat"><div class="stat-top">' + icon('check') + '<span class="eyebrow">Done in ' + y + '</span></div>' +
        '<div class="stat-value num">' + yearDone + '<small>/' + yearTotal + '</small></div>' +
        '<div class="stat-label">' + (yearTotal ? Math.round(yearDone / yearTotal * 100) + '% completion' : 'nothing planned yet') + '</div></div>' +

        '<div class="stat"><div class="stat-top">' + icon('day') + '<span class="eyebrow">Days planned</span></div>' +
        '<div class="stat-value num">' + withWork.length + '</div>' +
        '<div class="stat-label">in ' + y + '</div></div>' +

        '<div class="stat"><div class="stat-top">' + icon('fire') + '<span class="eyebrow">Best streak</span></div>' +
        '<div class="stat-value num">' + data.bestStreak + '<small> days</small></div>' +
        '<div class="stat-label">now ' + data.currentStreak + '</div></div>' +

        '<div class="stat"><div class="stat-top">' + icon('week') + '<span class="eyebrow">Busiest day</span></div>' +
        '<div class="stat-value" style="font-size:17px">' + esc(D.DAYS[data.busiestWeekday]) + '</div>' +
        '<div class="stat-label">' + data.byWeekday[data.busiestWeekday] + ' tasks done</div></div>' +
        '</section>';

      h += '<div class="card"><div class="card-head"><h2>' + icon('year') + 'The year, day by day</h2>' +
        '<span class="tiny dim">darker = more completed</span></div>' +
        heatmap(y) + '</div>';

      h += '<div class="grid g2">' +
        '<div class="card"><div class="card-head"><h2>' + icon('today') + 'Last 30 days</h2>' +
        '<span class="pill num">' + series.reduce(function (a, d) { return a + d.done; }, 0) + ' done</span></div>' +
        trendBars(series) +
        '<div class="tiny dim">Each bar is one day. Hover for the date.</div></div>' +

        '<div class="card"><div class="card-head"><h2>' + icon('search') + 'Tags</h2>' +
        (data.tags.length ? '<span class="pill num">' + data.tags.length + '</span>' : '') + '</div>' +
        (data.tags.length
          ? '<div class="tag-cloud">' + data.tags.slice(0, 18).map(function (t) {
            return '<button class="pill pill-tag" data-act="filter-tag" data-tag="' + esc(t.tag) + '">' +
              '#' + esc(t.tag) + ' <span class="dim">' + t.count + '</span></button>';
          }).join('') + '</div>'
          : UI.empty('search', 'No tags yet. Add one with #tag in quick add or a task.'));
      h += '</div></div>';

      h += '<div class="card card-pad"><div class="insight-foot">' +
        '<span class="tiny dim">' + data.rules + ' repeating task' + (data.rules === 1 ? '' : 's') + ' · ' +
        data.tasksTotal + ' tasks ever · ' + UI.fmtBytes(Store.usage().bytes) + ' stored</span>' +
        '<span class="insight-foot-actions">' +
        '<button class="btn btn-ghost btn-sm" data-act="export-md">' + icon('download') + 'Export Markdown</button>' +
        '<button class="btn btn-quiet btn-sm" data-act="go" data-href="#/year/' + y + '">' + icon('year') + 'Year goals</button>' +
        '</span></div></div>';

      return h;
    }
  };
})(window);
