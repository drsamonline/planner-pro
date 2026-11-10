/* Planner Pro — shared view fragments.
   Every interactive element carries data-act (+ data-scope/data-key/data-id),
   so one delegated handler in app.js serves every view. */
(function (global) {
  'use strict';
  var esc = UI.esc, icon = UI.icon;

  function todoRow(t, scope, key) {
    var attrs = ' data-scope="' + esc(scope) + '" data-key="' + esc(key) + '" data-id="' + esc(t.id) + '"';
    return '<div class="row' + (t.done ? ' done' : '') + (t.prio && !t.done ? ' prio' : '') + '">' +
      '<button class="check" data-act="todo-toggle"' + attrs + ' aria-label="' +
      (t.done ? 'Mark not done' : 'Mark done') + '">' + icon('check') + '</button>' +
      '<button class="row-text" data-act="todo-edit"' + attrs + ' title="Click to edit">' + esc(t.text) + '</button>' +
      '<div class="row-actions">' +
      '<button class="icon-btn" data-act="todo-prio"' + attrs + ' title="Priority" aria-label="Priority">' + icon('star') + '</button>' +
      '<button class="icon-btn danger" data-act="todo-del"' + attrs + ' title="Delete" aria-label="Delete">' + icon('trash') + '</button>' +
      '</div></div>';
  }

  function goalRow(g, scope, key) {
    var attrs = ' data-scope="' + esc(scope) + '" data-key="' + esc(key) + '" data-id="' + esc(g.id) + '"';
    return '<div class="row' + (g.done ? ' done' : '') + '">' +
      '<button class="check" data-act="todo-toggle"' + attrs + ' aria-label="Toggle goal">' + icon('check') + '</button>' +
      '<button class="row-text" data-act="todo-edit"' + attrs + ' title="Click to edit">' + esc(g.text) + '</button>' +
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

  global.Parts = {
    todoRow: todoRow, goalRow: goalRow, blockRow: blockRow,
    composer: composer, rows: rows
  };
})(window);
