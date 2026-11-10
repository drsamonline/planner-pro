/* Planner Pro — About & shortcuts */
(function (global) {
  'use strict';
  var esc = UI.esc, icon = UI.icon;
  global.Views = global.Views || {};

  var SHORTCUTS = [
    ['Ctrl / ⌘ + K', 'Command palette: search or jump anywhere'],
    ['N', 'New task (quick add)'],
    ['T', 'Jump to today'],
    ['D', 'Day view'],
    ['W', 'Week view'],
    ['Y', 'Year view'],
    ['A', 'Archive'],
    ['/', 'Search'],
    ['1 – 5', 'Switch between the main views'],
    ['Esc', 'Close palette, dialog or search'],
    ['Ctrl / ⌘ + P', 'Print the current view']
  ];

  global.Views.about = {
    title: 'About',
    subtitle: function () { return 'Version 14.0 · offline & local-first'; },

    render: function () {
      var h = '';

      h += '<div class="card"><div class="brand brand-lg"><span class="brand-mark">P</span>' +
        '<div><strong>Planner Pro</strong><small>Day · week · month · year planner</small></div></div>' +
        '<p class="small muted">A planner that behaves like a tool, not a website. It runs entirely in your browser, works with no internet connection, and stores every task and note on this device — no account, no analytics, no server.</p>' +
        '<div class="row-actions">' +
        '<span class="pill">v14.0</span><span class="pill">Offline-first</span><span class="pill">Multi-profile</span><span class="pill">No tracking</span>' +
        '</div></div>';

      h += '<div class="grid g2">' +
        '<div class="card"><div class="card-head"><h2>' + icon('info') + 'Author</h2></div>' +
        '<p class="small"><strong>Dr. Sohil Momin</strong></p>' +
        '<p class="tiny dim">Built as a personal planning tool and released for anyone who wants a calm, private planner.</p>' +
        '<div class="row-actions"><a class="btn btn-ghost btn-sm" href="https://github.com/drsamonline" target="_blank" rel="noopener">GitHub</a>' +
        '<a class="btn btn-ghost btn-sm" href="https://github.com/sponsors/drsamonline" target="_blank" rel="noopener">Sponsor</a></div>' +
        '</div>' +
        '<div class="card"><div class="card-head"><h2>' + icon('lock') + 'License</h2></div>' +
        '<p class="small muted"><strong>Polyform Noncommercial 1.0.0.</strong> Free for personal, academic and other non-commercial use. Commercial use needs a written licence from the author.</p>' +
        '<p class="tiny dim">Third-party material and attribution are listed in ATTRIBUTION.md in the repository.</p>' +
        '</div></div>';

      h += '<div class="card"><div class="card-head"><h2>' + icon('settings') + 'Keyboard shortcuts</h2></div>' +
        '<div class="rows">' + SHORTCUTS.map(function (s) {
          return '<div class="row" style="grid-template-columns:150px 1fr"><kbd class="kbd-hint">' + esc(s[0]) + '</kbd>' +
            '<span class="row-text">' + esc(s[1]) + '</span></div>';
        }).join('') + '</div></div>';

      h += '<div class="card"><div class="card-head"><h2>' + icon('note') + 'How your data works</h2></div>' +
        '<p class="small muted">Data is saved in this browser’s local storage under the key <code>planner_v14</code>. Nothing is uploaded. If you clear browsing data or use a different browser, the planner starts empty — so export a JSON backup from Settings now and then. Version 13 data is migrated automatically on first launch.</p>' +
        '</div>';

      return h;
    }
  };
})(window);
