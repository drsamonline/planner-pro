/* Planner Pro — Settings */
(function (global) {
  'use strict';
  var esc = UI.esc, icon = UI.icon, D = global.DateUtil;
  global.Views = global.Views || {};

  global.Views.settings = {
    title: 'Settings',
    subtitle: function () { return 'Profile, appearance, data'; },

    render: function () {
      var u = Store.user();
      var usage = Store.usage();
      var h = '';

      /* profile */
      h += '<div class="grid g2">' +
        '<div class="card"><div class="card-head"><h2>' + icon('settings') + 'Profile</h2>' +
        '<span class="pill">' + esc(u.name) + '</span></div>' +
        '<div class="field"><label for="setName">Display name</label>' +
        '<input type="text" id="setName" value="' + esc(u.name) + '" data-bind="user-name" maxlength="40"></div>' +
        '<div class="field"><label for="setTheme">Theme</label>' +
        '<select id="setTheme" data-bind="theme">' + Store.THEMES.map(function (t) {
          return '<option value="' + t.id + '"' + (u.theme === t.id ? ' selected' : '') + '>' + esc(t.label) + '</option>';
        }).join('') + '</select></div>' +
        '<div class="field"><label for="setWeekStart">Week starts on</label>' +
        '<select id="setWeekStart" data-bind="week-start">' +
        '<option value="1"' + (u.weekStart === 1 ? ' selected' : '') + '>Monday</option>' +
        '<option value="0"' + (u.weekStart === 0 ? ' selected' : '') + '>Sunday</option>' +
        '</select></div>' +
        '<label style="display:flex;gap:9px;align-items:center;margin:0;cursor:pointer">' +
        '<input type="checkbox" data-bind="require-pin"' + (u.settings.requirePin ? ' checked' : '') + '>' +
        '<span class="small">Ask for PIN when the app opens</span></label>' +
        '<label style="display:flex;gap:9px;align-items:center;margin:0;cursor:pointer">' +
        '<input type="checkbox" data-bind="auto-archive"' + (u.settings.autoArchive ? ' checked' : '') + '>' +
        '<span class="small">Auto-archive finished years</span></label>' +
        '</div>' +

        '<div class="card"><div class="card-head"><h2>' + icon('lock') + 'PIN</h2></div>' +
        '<p class="tiny dim">Your PIN keeps family members out of your profile. It is stored on this device only — there is no server to reset it.</p>' +
        '<div class="field"><label for="curPin">Current PIN</label>' +
        '<input type="password" id="curPin" inputmode="numeric" maxlength="4" autocomplete="current-password" placeholder="••••"></div>' +
        '<div class="field"><label for="newPin">New PIN</label>' +
        '<input type="password" id="newPin" inputmode="numeric" maxlength="4" autocomplete="new-password" placeholder="••••"></div>' +
        '<button class="btn" data-act="change-pin">Update PIN</button>' +
        '<button class="btn btn-quiet btn-sm" data-act="lock">' + icon('lock') + 'Lock app now</button>' +
        '</div></div>';

      /* data */
      h += '<div class="grid g2">' +
        '<div class="card"><div class="card-head"><h2>' + icon('download') + 'Backup &amp; restore</h2>' +
        '<span class="pill num">' + UI.fmtBytes(usage.bytes) + '</span></div>' +
        '<p class="tiny dim">Everything lives in this browser. Clearing site data deletes it — export a backup regularly, or keep the JSON in your cloud drive.</p>' +
        '<button class="btn" data-act="export-db">' + icon('download') + 'Export database (.json)</button>' +
        '<button class="btn btn-ghost" data-act="import-db">' + icon('upload') + 'Import database (.json)</button>' +
        '<input type="file" id="importFile" accept="application/json,.json" data-file="import" hidden>' +
        '<button class="btn btn-ghost" data-act="export-md">' + icon('note') + 'Export all as Markdown</button>' +
        '</div>' +

        '<div class="card"><div class="card-head"><h2>' + icon('info') + 'App</h2></div>' +
        '<p class="small muted">Planner Pro works fully offline. Install it for a home-screen icon and instant launch.</p>' +
        '<button class="btn btn-ghost" data-act="install" id="installBtn">' + icon('download') + 'Install app</button>' +
        '<p class="tiny dim" id="installHint">On iPhone/iPad use Share → “Add to Home Screen”.</p>' +
        '<div class="row-actions" style="margin-top:6px">' +
        '<button class="btn btn-quiet btn-sm" data-act="go" data-href="#/about">' + icon('info') + 'About &amp; shortcuts</button>' +
        '</div></div>' +
        '</div>';

      /* danger */
      h += '<div class="card"><div class="card-head"><h2 style="color:var(--bad)">Danger zone</h2></div>' +
        '<p class="small muted">Deleting this profile removes its days, weeks, goals and archives from this device. Export a backup first.</p>' +
        '<div class="row-actions"><button class="btn btn-danger" data-act="delete-profile">Delete profile “' + esc(u.name) + '”</button>' +
        '<button class="btn btn-ghost" data-act="account">Switch profile</button></div>' +
        '</div>';

      return h;
    }
  };
})(window);
