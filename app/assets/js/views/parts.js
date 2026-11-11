/* Planner Pro — shared view fragments.
   Every interactive element carries data-act (+ data-scope/data-key/data-id),
   so one delegated handler in app.js serves every view. */
(function (global) {
  'use strict';
  var esc = UI.esc, icon = UI.icon;

  function editingNow(id) {
    return global.Parts && global.Parts.editingId === id;
  }

  function selecting(key) {
    return global.Parts && global.Parts.selectionKey === key;
  }

  function isSelected(id) {
    return !!(global.Parts && (global.Parts.selectedIds || []).indexOf(id) >= 0);
  }

  function textCell(t, scope, key) {
    var attrs = ' data-scope="' + esc(scope) + '" data-key="' + esc(key) + '" data-id="' + esc(t.id) + '"';
    if (selecting(key)) {
      return '<button class="row-text" data-act="select-toggle"' + attrs + '>' + esc(t.text) + '</button>';
    }
    if (editingNow(t.id)) {
      return '<input class="row-input" type="text" value="' + esc(t.text) + '" data-bind="inline-edit"' +
        attrs + ' aria-label="Edit text" autocomplete="off">';
    }
    return '<button class="row-text" data-act="todo-edit"' + attrs + ' title="Click to edit">' + esc(t.text) + '</button>';
  }

  function metaPills(t) {
    var out = '';
    if (t.recurringId) out += '<span class="pill pill-repeat" title="Repeating task">' + icon('repeat') + '</span>';
    if (t.at) out += '<span class="pill pill-time">' + esc(t.at) + '</span>';
    if (t.est) out += '<span class="pill pill-est">' + esc(UI.duration(t.est)) + '</span>';
    (t.tags || []).forEach(function (tag) {
      out += '<button class="pill pill-tag" data-act="filter-tag" data-tag="' + esc(tag) +
        '" title="Show everything tagged #' + esc(tag) + '">#' + esc(tag) + '</button>';
    });
    return out ? '<span class="row-meta">' + out + '</span>' : '';
  }

  function expandedNow(id) {
    return !!(global.Parts && global.Parts.expandedId === id);
  }

  function subRows(t, scope, key) {
    var subs = t.sub || [];
    var done = subs.filter(function (x) { return x.done; }).length;
    var attrs = ' data-scope="' + esc(scope) + '" data-key="' + esc(key) + '" data-id="' + esc(t.id) + '"';
    var out = '<div class="sub-list">';
    subs.forEach(function (x) {
      out += '<div class="sub-row' + (x.done ? ' done' : '') + '">' +
        '<button class="check small" data-act="sub-toggle"' + attrs + ' data-sub="' + esc(x.id) +
        '" aria-label="Toggle subtask">' + icon('check') + '</button>' +
        '<span class="sub-text">' + esc(x.text) + '</span>' +
        '<button class="icon-btn danger flat" data-act="sub-del"' + attrs + ' data-sub="' + esc(x.id) +
        '" aria-label="Delete subtask">' + icon('x') + '</button></div>';
    });
    out += '<form class="sub-add" data-form="add-sub"' + attrs + '>' +
      '<input type="text" name="text" placeholder="Add a step…" autocomplete="off" aria-label="Add a step">' +
      '</form>';
    out += '</div>';
    return { html: out, done: done, total: subs.length };
  }

  function todoRow(t, scope, key) {
    var attrs = ' data-scope="' + esc(scope) + '" data-key="' + esc(key) + '" data-id="' + esc(t.id) + '"';
    var sel = selecting(key);
    var picked = isSelected(t.id);
    var subs = t.sub || [];
    var subsDone = subs.filter(function (x) { return x.done; }).length;
    var handle = sel
      ? '<button class="select-box' + (picked ? ' on' : '') + '" data-act="select-toggle"' + attrs +
        ' aria-label="' + (picked ? 'Deselect' : 'Select') + '" aria-pressed="' + picked + '">' + icon('check') + '</button>'
      : '<button class="drag" data-act="drag-start"' + attrs + ' title="Drag to reorder" aria-label="Reorder">' +
        '<span></span><span></span><span></span></button>';

    return '<div class="row' + (t.done ? ' done' : '') + (t.prio && !t.done ? ' prio' : '') +
      (picked ? ' picked' : '') + '" data-row-id="' + esc(t.id) + '">' +
      handle +
      '<button class="check" data-act="todo-toggle"' + attrs + ' aria-label="' +
      (t.done ? 'Mark not done' : 'Mark done') + '">' + icon('check') + '</button>' +
      '<div class="row-main">' +
      '<button class="sub-toggle" data-act="row-expand"' + attrs + ' aria-expanded="' + expandedNow(t.id) + '" ' +
      'aria-label="' + (subs.length ? 'Show steps' : 'Add a step') + '">' + (expandedNow(t.id) ? '▾' : '▸') + '</button>' +
      (subs.length ? '<span class="pill pill-sub num">' + subsDone + '/' + subs.length + '</span>' : '') +
      textCell(t, scope, key) + metaPills(t) + '</div>' +
      '<div class="row-actions">' +
      '<button class="icon-btn" data-act="todo-details"' + attrs + ' title="Estimate &amp; repeat" aria-label="Details">' + icon('more') + '</button>' +
      '<button class="icon-btn" data-act="todo-prio"' + attrs + ' title="Priority" aria-label="Priority">' + icon('star') + '</button>' +
      '<button class="icon-btn danger" data-act="todo-del"' + attrs + ' title="Delete" aria-label="Delete">' + icon('trash') + '</button>' +
      '</div></div>' +
      (expandedNow(t.id) ? subRows(t, scope, key).html : '');
  }

  function goalRow(g, scope, key) {
    var attrs = ' data-scope="' + esc(scope) + '" data-key="' + esc(key) + '" data-id="' + esc(g.id) + '"';
    return '<div class="row row-goal' + (g.done ? ' done' : '') + '" data-row-id="' + esc(g.id) + '">' +
      '<span class="drag-spacer" aria-hidden="true"></span>' +
      '<button class="check" data-act="todo-toggle"' + attrs + ' aria-label="Toggle goal">' + icon('check') + '</button>' +
      '<div class="row-main">' + textCell(g, scope, key) + '</div>' +
      '<div class="row-actions">' +
      '<button class="icon-btn danger" data-act="todo-del"' + attrs + ' title="Delete" aria-label="Delete">' + icon('trash') + '</button>' +
      '</div></div>';
  }

  function blockRow(b, dateKey, isNow) {
    return '<div class="block' + (isNow ? ' now' : '') + '">' +
      '<input type="time" value="' + esc(b.start || '') + '" data-bind="block-start" data-key="' + esc(dateKey) +
      '" data-id="' + esc(b.id) + '" aria-label="Start time">' +
      '<input type="text" value="' + esc(b.text || '') + '" placeholder="What\'s happening?" data-bind="block-text" data-key="' +
      esc(dateKey) + '" data-id="' + esc(b.id) + '" aria-label="Block description">' +
      '<button class="icon-btn danger flat" data-act="block-del" data-key="' + esc(dateKey) + '" data-id="' + esc(b.id) +
      '" title="Remove block" aria-label="Remove block">' + icon('x') + '</button></div>';
  }

  function composer(scope, key, placeholder) {
    return '<form class="composer" data-form="add-todo" data-scope="' + esc(scope) + '" data-key="' + esc(key) + '">' +
      '<input type="text" name="text" placeholder="' + esc(placeholder || 'Add a task…') + '" autocomplete="off" aria-label="New task">' +
      '<button class="btn" type="submit" aria-label="Add">' + icon('plus') + '</button></form>';
  }

  function rows(list, scope, key, emptyIcon, emptyText) {
    if (!list.length) return UI.empty(emptyIcon || 'note', emptyText || 'Nothing here yet.');
    return '<div class="rows">' + list.map(function (t) { return todoRow(t, scope, key); }).join('') + '</div>';
  }

  /** A month grid: one dot per planned day, ring for today, tint for the open day. */
  function miniCalendar(monthKey, opts) {
    var D = global.DateUtil;
    var o = opts || {};
    var year = Number(monthKey.slice(0, 4));
    var month = Number(monthKey.slice(5, 7)) - 1;
    var first = new Date(year, month, 1);
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var lead = first.getDay();
    var today = D.todayKey();
    var out = '<div class="mc-head">' +
      '<button class="mc-nav" data-act="cal-prev" aria-label="Previous month">' + icon('left') + '</button>' +
      '<span class="mc-title">' + esc(D.MONTHS[month]) + ' ' + year + '</span>' +
      '<button class="mc-nav" data-act="cal-next" aria-label="Next month">' + icon('right') + '</button>' +
      '</div><div class="mc-grid">';

    D.DAYS_SHORT.forEach(function (d) { out += '<span class="mc-dow">' + d.charAt(0) + '</span>'; });
    for (var i = 0; i < lead; i++) out += '<span class="mc-pad"></span>';

    for (var day = 1; day <= daysInMonth; day++) {
      var key = year + '-' + D.pad(month + 1) + '-' + D.pad(day);
      var st = Store.dayStats(key);
      var cls = 'mc-day';
      if (key === today) cls += ' is-today';
      if (o.selected && key === o.selected) cls += ' is-open';
      out += '<button class="' + cls + '" data-act="cal-day" data-key="' + key + '" title="' + esc(D.prettyDay(key)) + '">' +
        '<span class="mc-num">' + day + '</span>' +
        (st.total ? '<span class="mc-dot' + (st.pct === 100 ? ' full' : '') + '"></span>' : '') +
        '</button>';
    }
    out += '</div>';
    return out;
  }

  /** Rendered review answers, used by the week and day views. */
  function reviewBody(review, kind) {
    if (!review || !review.at) return '';
    var rows = [];
    function row(label, value) {
      if (!value) return;
      rows.push('<div class="review-q"><span class="eyebrow">' + esc(label) + '</span>' +
        '<p class="small" style="white-space:pre-wrap">' + esc(value) + '</p></div>');
    }
    if (kind === 'week') {
      row('What got done', review.done);
      row('Still worth doing', review.stuck);
      row('What changes', review.change);
      if (review.focusNext) {
        rows.push('<div class="review-q"><span class="eyebrow">Next week’s focus</span>' +
          '<p class="small strong">' + esc(review.focusNext) + '</p></div>');
      }
    } else {
      row('What went well', review.went);
      row('What drained you', review.drained);
      if (review.next) {
        rows.push('<div class="review-q"><span class="eyebrow">For tomorrow</span>' +
          '<p class="small strong">' + esc(review.next) + '</p></div>');
      }
    }
    if (!rows.length) return '';
    return '<div class="review-body">' + rows.join('') + '</div>';
  }

  /** "Planned 2h 30m of 8h" with a thin bar; turns amber past capacity. */
  function loadBar(load) {
    if (!load || !load.tasks) return '';
    var pct = Math.min(100, Math.round(load.minutes / load.capacity * 100));
    return '<div class="load' + (load.over ? ' over' : '') + '">' +
      '<div class="load-text tiny">' +
      '<span>Planned <strong>' + esc(UI.duration(load.minutes)) + '</strong> of ' + esc(UI.duration(load.capacity)) + '</span>' +
      '<span class="dim">' + load.tasks + ' estimated</span>' +
      '</div>' +
      '<div class="load-bar"><i style="width:' + pct + '%"></i></div>' +
      (load.over ? '<div class="tiny" style="color:var(--warn)">Over capacity by ' + esc(UI.duration(load.minutes - load.capacity)) + '</div>' : '') +
      '</div>';
  }

  global.Parts = {
    editingId: null, selectionKey: null, selectedIds: [], expandedId: null,
    loadBar: loadBar, reviewBody: reviewBody, miniCalendar: miniCalendar,
    todoRow: todoRow, goalRow: goalRow, blockRow: blockRow,
    composer: composer, rows: rows
  };
})(window);
