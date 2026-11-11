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
        '<div class="btn-row">' +
        '<button class="btn btn-quiet btn-sm" data-act="focus-start" data-key="' + key + '" data-minutes="25" title="Start a 25-minute focus block">' + icon('clock') + 'Focus</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="block-add" data-key="' + key + '">' + icon('plus') + 'Block</button>' +
        '</div></div>' +
        (d.blocks.length
          ? '<div>' + d.blocks.slice().sort(function (a, b) {
              return (D.minutesOf(a.start) || 0) - (D.minutesOf(b.start) || 0);
            }).map(function (b) { return Parts.blockRow(b, key, false); }).join('') + '</div>'
          : UI.empty('clock', 'Blocks turn a to-do list into a plan.')) +
        '</div>' +
        '<div class="card"><div class="card-head"><h2>' + icon('paperclip') + 'Attachments</h2>' +
        '<span class="pill num">' + ((d.files || []).length || '0') + '</span></div>' +
        (Store.attachmentsSupported()
          ? '<div class="attach-list">' +
            ((d.files || []).length
              ? (d.files || []).map(function (f) {
                return '<div class="attach">' +
                  '<span class="attach-icon">' + icon(f.type.indexOf('image/') === 0 ? 'image' : 'note') + '</span>' +
                  '<button class="attach-name" data-act="attach-open" data-key="' + key + '" data-id="' + esc(f.id) + '">' +
                  esc(f.name) + '</button>' +
                  '<span class="tiny dim">' + UI.fmtBytes(f.size) + '</span>' +
                  '<button class="icon-btn danger flat" data-act="attach-del" data-key="' + key + '" data-id="' + esc(f.id) +
                  '" aria-label="Remove attachment">' + icon('x') + '</button></div>';
              }).join('')
              : '<p class="tiny dim">Scan a referral, drop a PDF, keep the receipt. Files stay in this browser.</p>') +
            '</div>' +
            '<label class="btn btn-ghost btn-sm" style="margin-top:8px;cursor:pointer">' + icon('upload') + 'Add a file' +
            '<input type="file" data-file="attach" data-key="' + key + '" multiple hidden></label>'
          : '<p class="tiny dim">Attachments need IndexedDB, which this browser is not giving the app.</p>') +
        '</div>' +
        '<div class="card"><div class="card-head"><h2>' + icon('note') + 'Notes &amp; reflection</h2>' +
        '<button class="btn btn-quiet btn-sm" data-act="day-review" data-key="' + key + '">' +
        (d.review && d.review.at ? 'Edit review' : 'Review day') + '</button></div>' +
        '<textarea data-bind="day-notes" data-key="' + key + '" placeholder="How did it go? What will you do differently?" style="min-height:120px">' +
        esc(d.notes || '') + '</textarea>' +
        Parts.reviewBody(d.review, 'day') + '</div>' +
        '</div>';

      h += '</div>';
      return h;
    }
  };
})(window);
