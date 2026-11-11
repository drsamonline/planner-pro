/* Planner Pro — Day view */
(function (global) {
  'use strict';
  var esc = UI.esc, icon = UI.icon, D = global.DateUtil;
  global.Views = global.Views || {};

  global.Views.day = {
    title: 'Day',
    subtitle: function (p) { return D.longDay(p || D.todayKey()); },

    render: function (p) {
      var key = D.isKey(p) ? p : D.todayKey();
      var u = Store.user();
      var d = Store.day(key, true);
      var st = Store.dayStats(key);
      var prev = D.addDays(key, -1);
      var next = D.addDays(key, 1);
      var prevOpen = Store.dayStats(prev).total - Store.dayStats(prev).done;
      var rel = D.relative(key);
      var h = '';

      h += '<div class="datebar">' +
        '<button class="icon-btn" data-act="go" data-href="#/day/' + prev + '" aria-label="Previous day">' + icon('left') + '</button>' +
        '<input type="date" value="' + esc(key) + '" data-bind="day-date" aria-label="Pick a date">' +
        '<button class="icon-btn" data-act="go" data-href="#/day/' + next + '" aria-label="Next day">' + icon('right') + '</button>' +
        '<span class="pill">' + esc(rel || D.DAYS[D.weekday(key)]) + '</span>' +
        '<span class="spacer"></span>' +
        (rel === 'Today' ? '' : '<button class="btn btn-ghost btn-sm" data-act="go" data-href="#/day/' + D.todayKey() + '">Today</button>') +
        '<button class="btn btn-ghost btn-sm" data-act="print" title="Print this day">' + icon('print') + '<span class="btn-label">Print</span></button>' +
        '<button class="btn btn-ghost btn-sm" data-act="export-day" data-key="' + key + '">' + icon('download') + '<span class="btn-label">Markdown</span></button>' +
        '<button class="btn btn-ghost btn-sm" data-act="export-ics" data-days="' + key + '" title="Export to a calendar app">' + icon('clock') + '<span class="btn-label">Calendar</span></button>' +
        '<button class="btn btn-ghost btn-sm" data-act="duplicate-day" data-key="' + key + '" title="Copy blocks and tasks from another day">' + icon('carry') + '<span class="btn-label">Copy day</span></button>' +
        '<button class="btn btn-ghost btn-sm" data-act="templates" data-key="' + key + '" title="Save or apply a day template">' + icon('note') + '<span class="btn-label">Templates</span></button>' +
        '</div>';

      h += '<div class="card card-pad"><input class="intention" type="text" value="' + esc(d.intention || '') +
        '" placeholder="Set the intention for this day…" data-bind="day-intention" data-key="' + key + '" aria-label="Daily intention"></div>';

      h += '<div class="grid g-side">';

      /* tasks */
      var selecting = global.Parts.selectionKey === key;
      var picked = selecting ? (global.Parts.selectedIds || []).length : 0;

      h += '<div class="card"><div class="card-head"><h2>' + icon('check') + 'To-do</h2>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
        (st.total ? '<span class="pill' + (st.pct === 100 ? ' pill-ok' : '') + '">' + st.done + '/' + st.total + ' · ' + st.pct + '%</span>' : '') +
        (st.total ? (selecting
          ? '<button class="btn btn-quiet btn-sm" data-act="select-cancel">Done</button>'
          : '<button class="btn btn-quiet btn-sm" data-act="select-start" data-key="' + key + '">Select</button>') : '') +
        '</div></div>' +
        Parts.composer('day', key, 'What needs doing?') +
        Parts.loadBar(Store.dayLoad(key)) +
        Parts.rows(d.todos, 'day', key, 'check', 'Empty list. Add a task above — or enjoy the quiet.') +
        (selecting
          ? '<div class="bulk-bar">' +
            '<span class="small strong num">' + picked + ' selected</span>' +
            '<button class="btn btn-quiet btn-sm" data-act="select-all" data-key="' + key + '">Select all</button>' +
            '<span class="spacer"></span>' +
            '<button class="btn btn-ghost btn-sm" data-act="bulk-move"' + (picked ? '' : ' disabled') + '>' + icon('carry') + 'Move…</button>' +
            '<button class="btn btn-danger btn-sm" data-act="bulk-delete"' + (picked ? '' : ' disabled') + '>' + icon('trash') + 'Delete</button>' +
            '</div>'
          : '<div class="btn-row">' +
            (prevOpen ? '<button class="btn btn-ghost btn-sm" data-act="carry-over" data-from="' + prev + '" data-to="' + key + '">' +
              icon('carry') + 'Carry ' + prevOpen + ' unfinished</button>' : '') +
            (st.done ? '<button class="btn btn-quiet btn-sm" data-act="clear-done" data-key="' + key + '">' + icon('trash') + 'Clear completed</button>' : '') +
            '</div>') +
        '</div>';

      /* schedule + notes */
      h += '<div class="grid" style="gap:var(--gap)">' +
        '<div class="card"><div class="card-head"><h2>' + icon('clock') + 'Schedule</h2>' +
        '<button class="btn btn-ghost btn-sm" data-act="block-add" data-key="' + key + '">' + icon('plus') + 'Block</button></div>' +
        (d.blocks.length
          ? '<div>' + d.blocks.slice().sort(function (a, b) {
              return (D.minutesOf(a.start) || 0) - (D.minutesOf(b.start) || 0);
            }).map(function (b) { return Parts.blockRow(b, key, false); }).join('') + '</div>'
          : UI.empty('clock', 'Blocks turn a to-do list into a plan.')) +
        '</div>' +
        '<div class="card"><div class="card-head"><h2>' + icon('note') + 'Notes &amp; reflection</h2></div>' +
        '<textarea data-bind="day-notes" data-key="' + key + '" placeholder="How did it go? What will you do differently?" style="min-height:150px">' +
        esc(d.notes || '') + '</textarea></div>' +
        '</div>';

      h += '</div>';
      return h;
    }
  };
})(window);
