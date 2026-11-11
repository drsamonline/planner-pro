/* Planner Pro — Settings */
(function (global) {
  'use strict';
  var esc = UI.esc, icon = UI.icon, D = global.DateUtil;
  global.Views = global.Views || {};

  function kindLabel(kind) {
    if (kind === 'items') return 'Completed tasks';
    if (kind === 'block') return 'Time block';
    if (kind === 'carry') return 'Carried tasks';
    return 'Task';
  }

  function ago(at) {
    var mins = Math.round((Date.now() - (at || 0)) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    var hours = Math.round(mins / 60);
    if (hours < 24) return hours + ' h ago';
    var days = Math.round(hours / 24);
    return days + (days === 1 ? ' day ago' : ' days ago');
  }

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
        '<div class="field"><label for="setCapacity">Daily capacity (minutes)</label>' +
        '<input type="number" id="setCapacity" min="30" max="1440" step="30" value="' + (u.capacityMin || 480) + '" data-bind="capacity"></div>' +
        '<div class="field"><label for="setReview">Weekly review on</label>' +
        '<select id="setReview" data-bind="review-day">' +
        '<option value="-1"' + (u.reviewDay === -1 ? ' selected' : '') + '>Off</option>' +
        D.DAYS.map(function (name, i) {
          return '<option value="' + i + '"' + (u.reviewDay === i ? ' selected' : '') + '>' + esc(name) + '</option>';
        }).join('') +
        '</select></div>' +
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
        '<input type="file" id="importEncFile" accept=".planner,application/json" data-file="import-encrypted" hidden>' +
        '<button class="btn btn-ghost" data-act="export-md">' + icon('note') + 'Export all as Markdown</button>' +
        '<div style="border-top:1px solid var(--line);margin:6px 0 2px"></div>' +
        '<p class="tiny dim" style="margin:0">Encrypted backup — AES-256, unlocked with a passphrase. Safe to keep in cloud storage. There is no recovery if you forget it.</p>' +
        '<div class="btn-row">' +
        '<button class="btn btn-ghost btn-sm" data-act="export-encrypted">' + icon('lock') + 'Encrypted backup</button>' +
        '<button class="btn btn-quiet btn-sm" data-act="import-encrypted">' + icon('upload') + 'Restore encrypted</button>' +
        '</div>' +
        '</div>' +

        '<div class="card"><div class="card-head"><h2>' + icon('info') + 'App</h2></div>' +
        '<p class="small muted">Planner Pro works fully offline. Install it for a home-screen icon and instant launch.</p>' +
        '<button class="btn btn-ghost" data-act="install" id="installBtn">' + icon('download') + 'Install app</button>' +
        '<p class="tiny dim" id="installHint">On iPhone/iPad use Share → “Add to Home Screen”.</p>' +
        '<div class="btn-row" style="margin-top:6px">' +
        '<button class="btn btn-quiet btn-sm" data-act="go" data-href="#/about">' + icon('info') + 'About &amp; shortcuts</button>' +
        '</div></div>' +
        '</div>';

      /* repeating tasks */
      var rules = Store.recurring();
      h += '<div class="card"><div class="card-head"><h2>' + icon('repeat') + 'Repeating tasks</h2>' +
        '<span class="pill num">' + rules.length + '</span></div>' +
        '<p class="tiny dim">Repeats are created when you open a day, so a missed day fills itself in.</p>' +
        (rules.length
          ? '<div class="rows">' + rules.map(function (r) {
            return '<div class="row row-goal' + (r.active === false ? ' done' : '') + '">' +
              '<span class="drag-spacer"></span>' +
              '<button class="check' + (r.active === false ? '' : ' on') + '" data-act="recurring-toggle" data-id="' + esc(r.id) +
              '" aria-label="Pause or resume">' + icon('check') + '</button>' +
              '<div class="row-main"><span class="row-text" style="cursor:default">' + esc(r.text) + '</span>' +
              '<span class="row-meta"><span class="pill pill-repeat">' + esc(Store.repeatLabel(r)) + '</span>' +
              (r.est ? '<span class="pill pill-est">' + esc(UI.duration(r.est)) + '</span>' : '') + '</span></div>' +
              '<div class="btn-row">' +
              '<button class="icon-btn danger" data-act="recurring-delete" data-id="' + esc(r.id) + '" aria-label="Delete repeat">' +
              icon('trash') + '</button></div></div>';
          }).join('') + '</div>'
          : UI.empty('repeat', 'Nothing repeats yet. Set it on a task, or in quick add.')) +
        '</div>';

      /* recently deleted */
      var trash = Store.trash();
      h += '<div class="card"><div class="card-head"><h2>' + icon('trash') + 'Recently deleted</h2>' +
        '<span class="pill num">' + trash.length + '</span></div>' +
        '<p class="tiny dim">Deletions stay here for ' + Store.TRASH_DAYS + ' days, then clear themselves.</p>' +
        (trash.length
          ? '<div class="rows">' + trash.slice(0, 25).map(function (e) {
            return '<div class="row" style="grid-template-columns:minmax(0,1fr) auto">' +
              '<div style="min-width:0"><div class="row-text">' + esc(e.text || 'Item') + '</div>' +
              '<div class="tiny dim">' + esc(kindLabel(e.kind)) + ' · ' + esc(ago(e.at)) + '</div></div>' +
              '<div class="btn-row">' +
              '<button class="btn btn-quiet btn-sm" data-act="trash-restore" data-id="' + esc(e.id) + '">Restore</button>' +
              '<button class="icon-btn danger" data-act="trash-delete" data-id="' + esc(e.id) + '" aria-label="Remove for good">' +
              icon('x') + '</button></div></div>';
          }).join('') + '</div>' +
          '<div class="btn-row"><button class="btn btn-ghost btn-sm" data-act="trash-empty">' + icon('trash') + 'Empty trash</button></div>'
          : UI.empty('trash', 'Nothing deleted yet — deletes land here first.')) +
        '</div>';

      /* danger */
      h += '<div class="card"><div class="card-head"><h2 style="color:var(--bad)">Danger zone</h2></div>' +
        '<p class="small muted">Deleting this profile removes its days, weeks, goals and archives from this device. Export a backup first.</p>' +
        '<div class="btn-row"><button class="btn btn-danger" data-act="delete-profile">Delete profile “' + esc(u.name) + '”</button>' +
        '<button class="btn btn-ghost" data-act="account">Switch profile</button></div>' +
        '</div>';

      return h;
    }
  };
})(window);
