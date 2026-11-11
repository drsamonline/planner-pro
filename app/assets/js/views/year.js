/* Planner Pro — Year view */
(function (global) {
  'use strict';
  var esc = UI.esc, icon = UI.icon, D = global.DateUtil;
  global.Views = global.Views || {};

  global.Views.year = {
    title: 'Year',
    subtitle: function (p) { return 'Goals, month by month'; },

    render: function (p) {
      var y = /^\d{4}$/.test(String(p || '')) ? String(p) : String(new Date().getFullYear());
      var yr = Store.year(y, true);
      var thisYear = String(new Date().getFullYear());
      var daysPlanned = 0, yDone = 0, yTotal = 0;
      Object.keys(Store.user().days).forEach(function (k) {
        if (k.slice(0, 4) !== y) return;
        var s = Store.dayStats(k);
        daysPlanned++; yDone += s.done; yTotal += s.total;
      });
      var h = '';

      h += '<div class="datebar">' +
        '<button class="icon-btn" data-act="go" data-href="#/year/' + (Number(y) - 1) + '" aria-label="Previous year">' + icon('left') + '</button>' +
        '<strong style="padding:0 6px;font-size:15px" class="num">' + y + '</strong>' +
        '<button class="icon-btn" data-act="go" data-href="#/year/' + (Number(y) + 1) + '" aria-label="Next year">' + icon('right') + '</button>' +
        (y === thisYear ? '<span class="pill pill-ok">This year</span>' :
          '<button class="btn btn-ghost btn-sm" data-act="go" data-href="#/year/' + thisYear + '">This year</button>') +
        '<span class="spacer"></span>' +
        '<button class="btn btn-ghost btn-sm" data-act="go" data-href="#/insights/' + y + '">' + icon('chart') + '<span class="btn-label">Insights</span></button>' +
        (y !== thisYear ? '<button class="btn btn-ghost btn-sm" data-act="archive-year" data-year="' + y + '">' + icon('archive') + 'Archive ' + y + '</button>' : '') +
        '</div>';

      h += '<div class="grid g2">' +
        '<div class="card"><div class="card-head"><h2>' + icon('star') + 'Theme of ' + y + '</h2></div>' +
        '<input type="text" value="' + esc(yr.theme || '') + '" placeholder="One word or phrase for this year" ' +
        'data-bind="year-theme" data-key="' + y + '" aria-label="Year theme">' +
        '<div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' +
        '<div class="stat" style="padding:9px 10px"><div class="stat-value num" style="font-size:17px">' + daysPlanned + '</div>' +
        '<div class="stat-label">days planned</div></div>' +
        '<div class="stat" style="padding:9px 10px"><div class="stat-value num" style="font-size:17px">' + yDone + '<small>/' + yTotal + '</small></div>' +
        '<div class="stat-label">tasks done</div></div>' +
        '<div class="stat" style="padding:9px 10px"><div class="stat-value num" style="font-size:17px">' +
        yr.goals.filter(function (g) { return g.done; }).length + '<small>/' + yr.goals.length + '</small></div>' +
        '<div class="stat-label">goals met</div></div></div></div>' +
        '<div class="card"><div class="card-head"><h2>' + icon('check') + 'Year goals</h2>' +
        (yr.goals.length ? '<span class="pill">' + yr.goals.filter(function (g) { return g.done; }).length + '/' + yr.goals.length + '</span>' : '') +
        '</div>' +
        Parts.composer('year', y, 'Add a goal for the year…') +
        (yr.goals.length ? '<div class="rows">' + yr.goals.map(function (g) { return Parts.goalRow(g, 'year', y); }).join('') + '</div>'
          : UI.empty('star', 'Big goals go here — three is plenty.')) +
        '</div></div>';

      h += '<div class="month-grid">' + D.MONTHS.map(function (name, i) {
        var mk = y + '-' + D.pad(i + 1);
        var m = Store.month(mk, true);
        var ms = Store.monthStats(mk);
        var isCurrent = mk === D.monthKey(D.todayKey());
        var goals = m.goals.slice(0, 3);
        var more = m.goals.length - goals.length;
        return '<div class="month-card' + (isCurrent ? ' current' : '') + '">' +
          '<div class="month-head"><b>' + esc(name) + '</b>' +
          '<button class="icon-btn flat" style="width:24px;height:24px" data-act="month-goal-add" data-key="' + mk +
          '" title="Add goal for ' + esc(name) + '" aria-label="Add goal for ' + esc(name) + '">' + icon('plus') + '</button></div>' +
          '<div class="progress' + (ms.pct === 100 && ms.total ? ' ok' : '') + '"><i style="width:' + ms.pct + '%"></i></div>' +
          '<div class="tiny dim num">' + (ms.total ? ms.done + '/' + ms.total + ' tasks' : 'no tasks yet') + '</div>' +
          (goals.length ? goals.map(function (g) {
            return '<button class="mini' + (g.done ? ' done' : '') + '" data-act="todo-toggle" data-scope="month" data-key="' + mk +
              '" data-id="' + esc(g.id) + '"><span class="tick">' + (g.done ? '✓' : '·') + '</span><span>' + esc(g.text) + '</span></button>';
          }).join('') : '<div class="tiny dim">No goals set.</div>') +
          (more > 0 ? '<div class="tiny dim">+' + more + ' more</div>' : '') +
          '</div>';
      }).join('') + '</div>';

      return h;
    }
  };
})(window);
