/* Planner Pro — Today (dashboard) */
(function (global) {
  'use strict';
  var esc = UI.esc, icon = UI.icon, D = global.DateUtil;
  global.Views = global.Views || {};

  function nextBlock(blocks) {
    var nowMin = D.minutesOf(D.nowTime());
    var upcoming = blocks.filter(function (b) { return D.minutesOf(b.start) != null; })
      .map(function (b) { return { b: b, m: D.minutesOf(b.start) }; })
      .sort(function (a, b) { return a.m - b.m; });
    var next = null;
    upcoming.forEach(function (x) { if (x.m >= nowMin && !next) next = x; });
    return next ? next.b : null;
  }

  function blockState(blocks) {
    if (!blocks.length) return 'nothing scheduled';
    var nb = nextBlock(blocks);
    if (nb) return 'next at ' + (nb.start || '');
    return 'no more blocks today';
  }

  function todayActions(tk) {
    var st = Store.dayStats(tk);
    var yesterday = D.addDays(tk, -1);
    var yst = Store.dayStats(yesterday);
    var yOpen = yst.total - yst.done;
    return (yOpen ? '<button class="btn btn-ghost btn-sm" data-act="carry-over" data-from="' + yesterday + '" data-to="' + tk + '">' +
      icon('carry') + 'Bring ' + yOpen + ' from yesterday</button>' : '') +
      (st.done ? '<button class="btn btn-quiet btn-sm" data-act="clear-done" data-key="' + tk + '">' +
        icon('trash') + 'Clear completed</button>' : '');
  }

  global.Views.today = {
    actions: todayActions,
    title: 'Today',
    subtitle: function () { return D.longDay(D.todayKey()); },

    render: function () {
      var u = Store.user();
      var tk = D.todayKey();
      var d = Store.peekDay(tk);
      var st = Store.dayStats(tk);
      var todos = d ? d.todos : [];
      var blocks = d ? d.blocks : [];
      var open = st.total - st.done;
      var streak = Store.streak();
      var bars = Store.weekBars(7);
      var firstName = (u.name || '').split(/\s+/)[0];
      var words = (u.quickNotes || '').trim() ? (u.quickNotes.trim().split(/\s+/).length) : 0;
      var backup = Store.backupStatus();
      var yesterday = D.addDays(tk, -1);
      var yStats = Store.dayStats(yesterday);
      var yOpen = yStats.total - yStats.done;
      var h = '';

      h += '<section class="hero">' +
        '<div><div class="hero-greet">' + esc(D.greeting()) + ', ' + esc(firstName) + '</div>' +
        '<div class="hero-date">' + esc(D.longDay(tk)) + '</div></div>' +
        '<div class="hero-clock" id="clock">' + esc(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) + '</div>' +
        '</section>';

      /* ---- backup nudge ---- */
      if (backup && backup.due) {
        var since = backup.days === null
          ? 'You have not backed up this planner yet.'
          : 'Last backup was ' + backup.days + ' days ago.';
        h += '<div class="notice">' + icon('download') +
          '<div class="notice-text"><strong>' + esc(since) + '</strong>' +
          '<span>Everything lives in this browser. One JSON file keeps it safe.</span></div>' +
          '<button class="btn btn-sm" data-act="export-db">Export backup</button>' +
          '<button class="btn btn-quiet btn-sm" data-act="dismiss-backup">Later</button>' +
          '</div>';
      }

      /* ---- weekly review nudge ---- */
      var due = Store.reviewDue();
      if (due) {
        h += '<div class="notice">' + icon('note') +
          '<div class="notice-text"><strong>It is your review day.</strong>' +
          '<span>Ten minutes on the week now saves a week of drift.</span></div>' +
          '<button class="btn btn-sm" data-act="week-review" data-key="' + due.weekKey + '">Review the week</button>' +
          '<button class="btn btn-quiet btn-sm" data-act="dismiss-review">Later</button>' +
          '</div>';
      }

      /* ---- stat tiles ---- */
      h += '<section class="stats">' +
        '<div class="stat"><div class="stat-top">' + icon('today') + '<span class="eyebrow">Tasks today</span></div>' +
        '<div class="ring-wrap" data-live="ring" data-key="' + tk + '">' + UI.ring(st.pct, st.pct + '%') +
        '<div><div class="stat-value num">' + st.done + '<small>/' + st.total + '</small></div>' +
        '<div class="stat-label">completed</div></div></div></div>' +

        '<div class="stat"><div class="stat-top">' + icon('fire') + '<span class="eyebrow">Streak</span></div>' +
        '<div class="stat-value num">' + streak + '<small> ' + (streak === 1 ? 'day' : 'days') + '</small></div>' +
        '<div class="stat-label">' + (streak > 0 ? 'keep it going' : 'complete a task to start') + '</div></div>' +

        '<div class="stat"><div class="stat-top">' + icon('clock') + '<span class="eyebrow">Time blocks</span></div>' +
        '<div class="stat-value num">' + blocks.length + '</div>' +
        '<div class="stat-label">' + esc(blockState(blocks)) + '</div></div>' +

        '<div class="stat"><div class="stat-top">' + icon('note') + '<span class="eyebrow">Still open</span></div>' +
        '<div class="stat-value num" data-live="open" data-key="' + tk + '">' + open + '</div>' +
        '<div class="stat-label">' + (open ? 'tasks left today' : 'all clear') + '</div></div>' +
        '</section>';

      /* ---- intention ---- */
      h += '<div class="card card-pad"><label class="eyebrow" for="intentionInput">Intention for today</label>' +
        '<input class="intention" id="intentionInput" type="text" value="' + esc(d ? d.intention : '') +
        '" placeholder="One line: what would make today count?" data-bind="day-intention" data-key="' + tk + '"></div>';

      /* ---- main grid: tasks + schedule | notes + trend ---- */
      h += '<div class="grid g-side">';

      h += '<div class="grid" style="gap:var(--gap)">';

      h += '<div class="card"><div class="card-head"><h2>' + icon('day') + 'Today\'s tasks' +
        (st.total ? ' <span class="pill" data-live="today-count" data-key="' + tk + '">' + st.done + '/' + st.total + '</span>' : '') +
        '</h2><button class="btn btn-quiet btn-sm" data-act="go" data-href="#/day/' + tk + '">Open day ' + icon('right') + '</button></div>' +
        Parts.composer('day', tk, 'Add a task and press Enter…') +
        '<div data-live="load" data-key="' + tk + '">' + Parts.loadBar(Store.dayLoad(tk)) + '</div>' +
        Parts.rows(todos, 'day', tk, 'check', 'No tasks yet — add the one thing that matters most.') +
        (todos.length ? '<div class="btn-row" data-live="today-actions" data-key="' + tk + '">' + todayActions(tk) + '</div>' : '') +
        '</div>';

      h += '<div class="card"><div class="card-head"><h2>' + icon('clock') + 'Schedule</h2>' +
        '<button class="btn btn-ghost btn-sm" data-act="block-add" data-key="' + tk + '">' + icon('plus') + 'Block</button></div>' +
        (blocks.length
          ? '<div>' + blocks.slice().sort(function (a, b) {
              return (D.minutesOf(a.start) || 0) - (D.minutesOf(b.start) || 0);
            }).map(function (b) {
              var s = D.minutesOf(b.start), e = D.minutesOf(b.end), n = D.minutesOf(D.nowTime());
              var isNow = s != null && n != null && s <= n && (e != null ? n < e : n < s + 60);
              return Parts.blockRow(b, tk, isNow);
            }).join('') + '</div>'
          : UI.empty('clock', 'Blocks turn a to-do list into a plan.')) +
        '</div>';

      h += '</div>';

      h += '<div class="grid" style="gap:var(--gap)">';

      h += '<div class="card"><div class="card-head"><h2>' + icon('note') + 'Brain dump</h2>' +
        '<span class="tiny dim num">' + words + ' words</span></div>' +
        '<textarea data-bind="quick-notes" placeholder="Anything on your mind — ideas, worries, things to sort later." style="min-height:132px">' +
        esc(u.quickNotes || '') + '</textarea></div>';

      h += '<div class="card"><div class="card-head"><h2>' + icon('week') + 'Last 7 days</h2>' +
        '<button class="btn btn-quiet btn-sm" data-act="go" data-href="#/week/' + D.weekStartKey(tk, u.weekStart) + '">Week ' + icon('right') + '</button></div>' +
        UI.bars(bars) +
        '<div class="tiny dim">' + bars.reduce(function (a, b) { return a + b.stats.done; }, 0) + ' tasks completed this week</div></div>';

      /* month grid, only where the rail is hidden */
      h += '<div class="card mobile-only"><div class="card-head"><h2>' + icon('day') + 'Month</h2></div>' +
        '<div class="mini-cal mobile-cal" id="miniCalMobile"></div></div>';

      h += '</div></div>';

      return h;
    }
  };
})(window);
