/* Planner Pro — shared view fragments.
   Every interactive element carries data-act (+ data-scope/data-key/data-id),
   so one delegated handler in app.js serves every view. */
(function (global) {
  'use strict';
  var esc = UI.esc, icon = UI.icon;

  function editingNow(id) {
    return global.Parts && global.Parts.editingId === id;
  }

  function textCell(t, scope, key) {
    var attrs = ' data-scope="' + esc(scope) + '" data-key="' + esc(key) + '" data-id="' + esc(t.id) + '"';
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

  function todoRow(t, scope, key) {
    var attrs = ' data-scope="' + esc(scope) + '" data-key="' + esc(key) + '" data-id="' + esc(t.id) + '"';
    return '<div class="row' + (t.done ? ' done' : '') + (t.prio && !t.done ? ' prio' : '') + '" data-row-id="' + esc(t.id) + '">' +
      '<button class="drag" data-act="drag-start"' + attrs + ' title="Drag to reorder" aria-label="Reorder">' +
      '<span></span><span></span><span></span></button>' +
      '<button class="check" data-act="todo-toggle"' + attrs + ' aria-label="' +
      (t.done ? 'Mark not done' : 'Mark done') + '">' + icon('check') + '</button>' +
      '<div class="row-main">' + textCell(t, scope, key) + metaPills(t) + '</div>' +
      '<div class="row-actions">' +
      '<button class="icon-btn" data-act="todo-details"' + attrs + ' title="Estimate &amp; repeat" aria-label="Details">' + icon('more') + '</button>' +
      '<button class="icon-btn" data-act="todo-prio"' + attrs + ' title="Priority" aria-label="Priority">' + icon('star') + '</button>' +
      '<button class="icon-btn danger" data-act="todo-del"' + attrs + ' title="Delete" aria-label="Delete">' + icon('trash') + '</button>' +
      '</div></div>';
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
    editingId: null, loadBar: loadBar,
    todoRow: todoRow, goalRow: goalRow, blockRow: blockRow,
    composer: composer, rows: rows
  };
})(window);
