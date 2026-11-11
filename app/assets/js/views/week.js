/* Planner Pro — Week view */
(function (global) {
  'use strict';
  var esc = UI.esc, icon = UI.icon, D = global.DateUtil;
  global.Views = global.Views || {};

  global.Views.week = {
    title: 'Week',
    subtitle: function (p) { return 'Week ' + D.isoWeekNumber(p) + ' · ' + D.yearOf(p); },

    render: function (p) {
      var u = Store.user();
      var ws = (u.weekStart === 0) ? 0 : 1;
      var key = D.isKey(p) ? D.weekStartKey(p, ws) : D.weekStartKey(D.todayKey(), ws);
      var w = Store.week(key, true);
      var dates = D.weekDates(key);
      var prev = D.addDays(key, -7);
      var next = D.addDays(key, 7);
      var thisWeek = D.weekStartKey(D.todayKey(), ws);
      var tk = D.todayKey();
      var first = dates[0], last = dates[6];
      var rangeLabel = D.shortDay(first) + ' – ' + D.shortDay(last) + ', ' + D.yearOf(last);
      var wkDone = 0, wkTotal = 0, planned = 0;
      dates.forEach(function (k) {
        var s = Store.dayStats(k);
        wkDone += s.done; wkTotal += s.total;
        if (s.total) planned++;
      });
      var h = '';

      /* nav */
      h += '<div class="datebar">' +
        '<button class="icon-btn" data-act="go" data-href="#/week/' + prev + '" aria-label="Previous week">' + icon('left') + '</button>' +
        '<strong style="padding:0 4px">' + esc(rangeLabel) + '</strong>' +
        '<button class="icon-btn" data-act="go" data-href="#/week/' + next + '" aria-label="Next week">' + icon('right') + '</button>' +
        '<span class="pill">Week ' + D.isoWeekNumber(key) + '</span>' +
        (key === thisWeek ? '<span class="pill pill-ok">This week</span>' :
          '<button class="btn btn-ghost btn-sm" data-act="go" data-href="#/week/' + thisWeek + '">This week</button>') +
        '<span class="spacer"></span>' +
        '<button class="btn btn-ghost btn-sm" data-act="print">' + icon('print') + '<span class="btn-label">Print</span></button>' +
        '<button class="btn btn-ghost btn-sm" data-act="export-ics" data-days="' + dates.join(',') + '" title="Export this week to a calendar app">' +
        icon('clock') + '<span class="btn-label">Calendar</span></button>' +
        '<button class="btn ' + (w.review && w.review.at ? 'btn-ghost' : '') + ' btn-sm" data-act="week-review" data-key="' + key + '">' +
        icon('note') + (w.review && w.review.at ? 'Review' : 'Review week') + '</button>' +
        '</div>';

      /* focus + goals */
      h += '<div class="grid g2">' +
        '<div class="card"><div class="card-head"><h2>' + icon('star') + 'Focus of the week</h2></div>' +
        '<input type="text" value="' + esc(w.focus || '') + '" placeholder="If only one thing gets done this week…" ' +
        'data-bind="week-focus" data-key="' + key + '" aria-label="Weekly focus">' +
        '<div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:2px">' +
        '<div class="stat" style="padding:9px 10px"><div class="stat-value num" style="font-size:17px">' + wkDone + '<small>/' + wkTotal + '</small></div>' +
        '<div class="stat-label">tasks done</div></div>' +
        '<div class="stat" style="padding:9px 10px"><div class="stat-value num" style="font-size:17px">' + planned + '<small>/7</small></div>' +
        '<div class="stat-label">days planned</div></div>' +
        '<div class="stat" style="padding:9px 10px"><div class="stat-value num" style="font-size:17px">' +
        (w.todos.filter(function (t) { return t.done; }).length) + '<small>/' + w.todos.length + '</small></div>' +
        '<div class="stat-label">weekly goals</div></div></div></div>' +
        '<div class="card"><div class="card-head"><h2>' + icon('check') + 'Weekly goals</h2>' +
        (w.todos.length ? '<span class="pill">' + w.todos.filter(function (t) { return t.done; }).length + '/' + w.todos.length + '</span>' : '') +
        '</div>' +
        Parts.composer('week', key, 'Add a goal for this week…') +
        (w.todos.length ? '<div class="rows">' + w.todos.map(function (t) { return Parts.todoRow(t, 'week', key); }).join('') + '</div>'
          : UI.empty('check', 'No weekly goals yet.')) +
        '</div></div>';

      /* grid */
      h += '<div class="week-grid">' + dates.map(function (k) {
        var st = Store.dayStats(k);
        var d = Store.peekDay(k);
        var todos = d ? d.todos : [];
        var shown = todos.slice(0, 5);
        var extra = todos.length - shown.length;
        var isToday = k === tk;
        return '<div class="day-col' + (isToday ? ' today' : '') + '">' +
          '<button class="day-col-head" data-act="go" data-href="#/day/' + k + '" style="width:100%;text-align:left">' +
          '<b>' + esc(D.DAYS_SHORT[D.weekday(k)]) + '</b>' +
          '<span>' + D.fromKey(k).getDate() + '</span></button>' +
          (todos.length ? '<div class="tiny dim num">' + st.done + '/' + st.total + ' done</div>' : '') +
          shown.map(function (t) {
            return '<button class="mini' + (t.done ? ' done' : '') + '" data-act="todo-toggle" data-scope="day" data-key="' + k +
              '" data-id="' + esc(t.id) + '">' +
              '<span class="tick">' + (t.done ? '✓' : '·') + '</span>' +
              '<span>' + esc(t.text) + '</span></button>';
          }).join('') +
          (extra > 0 ? '<button class="add-mini" data-act="go" data-href="#/day/' + k + '">+' + extra + ' more</button>' : '') +
          '<button class="add-mini" data-act="go" data-href="#/day/' + k + '">+ add task</button>' +
          '</div>';
      }).join('') + '</div>';

      /* review */
      h += '<div class="card"><div class="card-head"><h2>' + icon('note') + 'Week in review</h2>' +
        (w.review && w.review.at ? '<span class="pill pill-ok">reviewed</span>' : '<span class="pill">not yet</span>') +
        '</div>' +
        (w.review && w.review.at
          ? Parts.reviewBody(w.review, 'week')
          : '<p class="small muted">Four questions at the end of the week: what got done, what didn’t, ' +
            'what you would change, and the one thing for next week.</p>' +
            '<div><button class="btn btn-ghost btn-sm" data-act="week-review" data-key="' + key + '">' +
            icon('note') + 'Start the review</button></div>') +
        '</div>';

      return h;
    }
  };
})(window);
