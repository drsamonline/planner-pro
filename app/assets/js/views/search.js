/* Planner Pro — Search across every note, task and goal */
(function (global) {
  'use strict';
  var esc = UI.esc, icon = UI.icon, D = global.DateUtil;
  global.Views = global.Views || {};

  var MAX = 60;

  function collect(q) {
    var u = Store.user();
    var raw = String(q || '').trim();
    var tagOnly = raw.charAt(0) === '#';
    var needle = (tagOnly ? raw.slice(1) : raw).toLowerCase();
    var out = [];
    var seen = 0;

    function hit(kind, title, sub, href, body, tags) {
      if (seen >= MAX) return;
      var list = (tags || []).map(function (t) { return String(t).toLowerCase(); });
      if (tagOnly) {
        if (list.indexOf(needle) < 0) return;
      } else {
        var hay = (title + ' ' + (sub || '') + ' ' + (body || '') + ' ' + list.join(' ')).toLowerCase();
        if (hay.indexOf(needle) < 0) return;
      }
      seen++;
      out.push({ kind: kind, title: title, sub: sub, href: href, body: body });
    }

    Object.keys(u.days).forEach(function (k) {
      var d = u.days[k];
      d.todos.forEach(function (t) {
        hit('Task', t.text, D.prettyDay(k) + (t.done ? ' · done' : ''), '#/day/' + k, '', t.tags);
      });
      if (d.intention) hit('Intention', d.intention, D.prettyDay(k), '#/day/' + k, '');
      if (d.notes) hit('Note', d.notes.slice(0, 90), D.prettyDay(k), '#/day/' + k, d.notes);
      d.blocks.forEach(function (b) {
        if (b.text) hit('Block', b.text, D.prettyDay(k) + ' · ' + (b.start || ''), '#/day/' + k, '');
      });
    });

    Object.keys(u.weeks).forEach(function (k) {
      var w = u.weeks[k];
      if (w.focus) hit('Weekly focus', w.focus, 'Week of ' + D.prettyDay(k), '#/week/' + k, '');
      (w.todos || []).forEach(function (t) {
        hit('Weekly goal', t.text, 'Week of ' + D.prettyDay(k), '#/week/' + k, '');
      });
    });

    Object.keys(u.months).forEach(function (k) {
      var m = u.months[k];
      if (m.focus) hit('Monthly focus', m.focus, D.monthLabel(k), '#/year/' + k.slice(0, 4), '');
      (m.goals || []).forEach(function (g) {
        hit('Monthly goal', g.text, D.monthLabel(k), '#/year/' + k.slice(0, 4), '');
      });
    });

    Object.keys(u.years).forEach(function (k) {
      var y = u.years[k];
      if (y.theme) hit('Year theme', y.theme, k, '#/year/' + k, '');
      (y.goals || []).forEach(function (g) {
        hit('Year goal', g.text, k, '#/year/' + k, '');
      });
    });

    if (u.quickNotes) hit('Brain dump', u.quickNotes.slice(0, 90), 'Dashboard notes', '#/today', u.quickNotes, []);

    return out;
  }

  function resultsHTML(q) {
    q = (q || '').trim();
    if (q.length < 2) {
      return UI.empty('search', 'Type at least two characters. Everything you have written is searchable — tasks, notes, goals, blocks.');
    }
    var found = collect(q);
    if (!found.length) {
      return UI.empty('search', 'No matches for “' + q + '”.');
    }
    var groups = {};
    found.forEach(function (f) {
      groups[f.kind] = groups[f.kind] || [];
      groups[f.kind].push(f);
    });
    var h = '<div class="card card-flush">';
    Object.keys(groups).forEach(function (kind) {
      h += '<div class="card-pad" style="padding-bottom:4px"><span class="eyebrow">' + esc(kind) + ' · ' + groups[kind].length + '</span></div>';
      h += '<div style="padding:0 14px 8px">' + groups[kind].map(function (f) {
        return '<button class="hit" data-act="go" data-href="' + esc(f.href) + '">' +
          '<span class="strong">' + UI.highlight(f.title, q) + '</span>' +
          '<span class="hit-meta">' + esc(f.sub || '') + '</span></button>';
      }).join('') + '</div>';
    });
    h += '</div>';
    return h;
  }

  global.Views.search = {
    title: 'Search',
    subtitle: function (p) { return p ? 'Tagged #' + p : 'Find anything you wrote, in one place'; },

    render: function (p) {
      var initial = p ? '#' + p : '';
      return '<div class="card"><div class="composer">' +
        '<input type="search" id="searchInput" data-live="search" placeholder="Search tasks, notes, goals… or type #tag" ' +
        'value="' + esc(initial) + '" autocomplete="off" autofocus>' +
        '</div></div>' +
        '<div id="searchResults">' + resultsHTML(initial) + '</div>';
    },

    results: resultsHTML,
    collect: collect
  };
})(window);
