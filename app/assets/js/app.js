/* Planner Pro — app controller: boot, lock screen, router, actions, palette */
(function (global) {
  'use strict';

  var D = DateUtil, esc = UI.esc, icon = UI.icon;
  var $ = function (id) { return document.getElementById(id); };

  var NAV = [
    { id: 'today', label: 'Today', icon: 'today', href: '#/today' },
    { id: 'day', label: 'Day', icon: 'day', href: '#/day' },
    { id: 'week', label: 'Week', icon: 'week', href: '#/week' },
    { id: 'year', label: 'Year', icon: 'year', href: '#/year' },
    { id: 'archive', label: 'Archive', icon: 'archive', href: '#/archive' },
    { id: 'search', label: 'Search', icon: 'search', href: '#/search' },
    { id: 'settings', label: 'Settings', icon: 'settings', href: '#/settings' },
    { id: 'about', label: 'About', icon: 'info', href: '#/about' }
  ];
  var TABS = ['today', 'day', 'week', 'year', 'settings'];

  var currentId = 'today';
  var currentParam = '';
  var pendingPin = null;
  var installPrompt = null;
  var clockTimer = null;
  var palIndex = 0;
  var palItems = [];
  var saveTimer = null;

  /* ======================================================================
     boot
     ====================================================================== */
  function boot() {
    Store.load();
    UI.initModal();
    Store.on(onStoreEvent);
    bindEvents();
    applyTheme();
    var active = Store.state().activeUser;
    var activeUser = active ? Store.state().users[active] : null;
    if (active && activeUser && activeUser.settings.requirePin === false) showApp();
    else if (active) { showLock(); pickUser(active); }
    else showLock();
    registerSW();
    $('railSub').textContent = 'v' + Store.VERSION;
  }

  function onStoreEvent(type) {
    if (type === 'saving') setSaved('Saving…');
    else if (type === 'saved') setSaved('Saved');
    else if (type === 'error') {
      setSaved('Not saved');
      UI.toast('Could not save — storage may be full. Export a backup from Settings.');
    }
  }

  /** Announce a result to assistive tech without moving focus. */
  function announce(text) {
    var el = $('liveRegion');
    if (!el) return;
    el.textContent = '';
    setTimeout(function () { el.textContent = text; }, 40);
  }

  function setSaved(text) {
    var el = $('saveDot');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { el.classList.remove('show'); }, 1400);
  }

  /* ======================================================================
     theme
     ====================================================================== */
  function resolvedTheme() {
    var u = Store.user();
    var t = (u && u.theme) || 'midnight';
    if (t === 'system') {
      return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'midnight';
    }
    return t;
  }

  function applyTheme() {
    var t = resolvedTheme();
    document.documentElement.setAttribute('data-theme', t);
    document.body.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#F4F5F8' : (t === 'ocean' ? '#05201F' : '#0B1220'));
  }

  /* ======================================================================
     lock screen
     ====================================================================== */
  function showLock() {
    $('app').hidden = true;
    $('lockScreen').hidden = false;
    $('pinForm').hidden = true;
    $('lockBack').hidden = true;
    $('lockUsers').hidden = false;
    $('newUserBox').hidden = false;
    pendingPin = null;
    renderLockUsers();
  }

  function renderLockUsers() {
    var list = $('lockUsers');
    var users = Store.users();
    if (!users.length) {
      $('lockHint').textContent = 'Create your first profile — everything stays on this device.';
      list.innerHTML = '';
      $('newUserBox').open = true;
      return;
    }
    $('lockHint').textContent = 'Choose a profile';
    list.innerHTML = users.map(function (u) {
      return '<button class="user-chip" data-pick="' + esc(u.pin) + '" type="button">' +
        '<span class="avatar">' + esc(UI.initials(u.name)) + '</span>' +
        '<span class="chip-body"><span class="chip-name">' + esc(u.name) + '</span>' +
        '<span class="chip-meta">' + esc(dayCount(u.user)) + ' days planned</span></span>' +
        '<span class="go">' + icon('right') + '</span></button>';
    }).join('');
  }

  function dayCount(u) {
    return Object.keys((u && u.days) || {}).length;
  }

  function pickUser(pin) {
    pendingPin = pin;
    var u = Store.state().users[pin];
    $('lockHint').textContent = 'Enter the PIN for ' + (u ? u.name : 'this profile');
    $('lockUsers').hidden = true;
    $('newUserBox').hidden = true;
    $('pinForm').hidden = false;
    $('lockBack').hidden = false;
    $('pinInput').value = '';
    setTimeout(function () { $('pinInput').focus(); }, 40);
  }

  function backToUsers() {
    pendingPin = null;
    $('lockUsers').hidden = false;
    $('newUserBox').hidden = false;
    $('pinForm').hidden = true;
    $('lockBack').hidden = true;
    $('pinInput').value = '';
    renderLockUsers();
  }

  function tryUnlock(e) {
    if (e) e.preventDefault();
    var pin = ($('pinInput').value || '').trim();
    if (!pendingPin) return;
    if (pin !== pendingPin) {
      $('pinInput').value = '';
      UI.toast('Wrong PIN — try again');
      $('pinInput').focus();
      return;
    }
    Store.auth(pendingPin);
    showApp();
  }

  function createProfile() {
    var name = ($('newUserName').value || '').trim();
    var pin = ($('newUserPin').value || '').trim();
    if (!name) { UI.toast('Add your name first'); return; }
    if (!/^\d{4}$/.test(pin)) { UI.toast('PIN must be exactly 4 digits'); return; }
    var res = Store.addUser(name, pin);
    if (!res.ok) { UI.toast(res.error); return; }
    $('newUserName').value = '';
    $('newUserPin').value = '';
    showApp();
    UI.toast('Welcome, ' + name.split(' ')[0]);
  }

  /* ======================================================================
     app shell
     ====================================================================== */
  function showApp() {
    var u = Store.user();
    if (!u) { showLock(); return; }

    $('lockScreen').hidden = true;
    $('app').hidden = false;
    $('railName').textContent = u.name;
    $('railAvatar').textContent = UI.initials(u.name);
    $('railSince').textContent = 'Since ' + new Date(u.createdAt || Date.now()).getFullYear();
    applyTheme();
    buildNav();

    var archived = Store.autoArchive();
    if (archived.length) UI.toast('Archived ' + archived.join(', '));

    if (!location.hash || location.hash === '#' || location.hash === '#/') location.hash = '#/today';
    else route();

    startClock();
  }

  function buildNav() {
    var u = Store.user();
    var openToday = Store.dayStats(D.todayKey());
    var badge = (openToday.total - openToday.done) || '';
    $('railNav').innerHTML = NAV.map(function (n) {
      return '<button class="nav-item" data-act="go" data-href="' + n.href + '" data-nav="' + n.id + '">' +
        icon(n.icon) + '<span>' + n.label + '</span>' +
        (n.id === 'today' && badge ? '<span class="nav-badge">' + badge + '</span>' : '') + '</button>';
    }).join('');
    $('tabbar').innerHTML = TABS.map(function (id) {
      var n = NAV.filter(function (x) { return x.id === id; })[0];
      return '<button class="tab" data-act="go" data-href="' + n.href + '" data-nav="' + n.id + '">' +
        icon(n.icon) + '<span>' + n.label + '</span></button>';
    }).join('');
    setActiveNav(currentId);
  }

  function setActiveNav(id) {
    document.querySelectorAll('[data-nav]').forEach(function (el) {
      if (el.dataset.nav === id) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    });
  }

  function startClock() {
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(function () {
      var el = $('clock');
      if (el) el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, 15000);
  }

  /* ======================================================================
     router
     ====================================================================== */
  function parseHash() {
    var raw = (location.hash || '').replace(/^#\/?/, '');
    var parts = raw.split('/').filter(function (x) { return x !== ''; });
    var id = parts[0] || 'today';
    if (!global.Views[id]) id = 'today';
    return { id: id, param: parts.slice(1).join('/') };
  }

  function route() {
    if (!Store.user()) { showLock(); return; }
    var p = parseHash();
    renderView(p.id, p.param, true);
  }

  function renderView(id, param, isRoute) {
    var view = global.Views[id];
    if (!view) { id = 'today'; view = global.Views.today; }
    currentId = id;
    currentParam = param || '';

    var host = $('view');
    try {
      host.innerHTML = view.render(currentParam);
    } catch (err) {
      host.innerHTML = '<div class="card"><h2>Something went wrong in this view</h2><p class="small muted">' +
        esc(String(err && err.message || err)) + '</p><button class="btn btn-ghost" data-act="go" data-href="#/today">Back to today</button></div>';
      if (global.console) console.error(err);
    }

    $('pageTitle').textContent = view.title || id;
    var sub = (typeof view.subtitle === 'function') ? view.subtitle(currentParam) : (view.subtitle || '');
    $('pageSub').textContent = sub || '';
    document.title = (view.title || 'Planner') + ' · Planner Pro';
    setActiveNav(id);
    buildNavBadge();
    if (isRoute) window.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
    if (id === 'search') { var si = $('searchInput'); if (si) si.focus(); }
  }

  function buildNavBadge() {
    var badgeEl = $('railNav') && $('railNav').querySelector('[data-nav="today"] .nav-badge');
    if (!badgeEl) return;
    var st = Store.dayStats(D.todayKey());
    var open = st.total - st.done;
    badgeEl.textContent = open || '';
    badgeEl.style.display = open ? '' : 'none';
  }

  function refresh(focus) {
    renderView(currentId, currentParam, false);
    if (focus) {
      var sel = 'form[data-form="add-todo"][data-scope="' + focus.scope + '"][data-key="' + focus.key + '"] input';
      var el = document.querySelector(sel);
      if (el) { el.focus(); }
    }
  }

  /* ======================================================================
     item helpers
     ====================================================================== */
  function listFor(scope, key) {
    if (scope === 'day') return Store.day(key, true).todos;
    if (scope === 'week') return Store.week(key, true).todos;
    if (scope === 'month') return Store.month(key, true).goals;
    if (scope === 'year') return Store.year(key, true).goals;
    return [];
  }

  function findItem(scope, key, id) {
    var list = listFor(scope, key);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return { item: list[i], list: list, index: i };
    return null;
  }

  /* ======================================================================
     actions
     ====================================================================== */
  function actGo(href) {
    if (!href) return;
    // bare routes resolve to the current day / week / year so the URL is always shareable
    if (href === '#/day') href = '#/day/' + D.todayKey();
    else if (href === '#/week') href = '#/week/' + D.weekStartKey(D.todayKey(), (Store.user() || {}).weekStart);
    else if (href === '#/year') href = '#/year/' + new Date().getFullYear();
    if (location.hash === href) route();
    else location.hash = href;
  }

  function actTodoToggle(el) {
    var f = findItem(el.dataset.scope, el.dataset.key, el.dataset.id);
    if (!f) return;
    f.item.done = !f.item.done;
    Store.save();
    refresh();
  }

  function actTodoPrio(el) {
    var f = findItem(el.dataset.scope, el.dataset.key, el.dataset.id);
    if (!f) return;
    f.item.prio = !f.item.prio;
    Store.save();
    refresh();
  }

  function short(text, n) {
    text = String(text || '');
    return text.length > (n || 34) ? text.slice(0, (n || 34) - 1) + '…' : text;
  }

  /** Put a trashed entry back where it came from. */
  function restoreEntry(entry) {
    if (!entry) return;
    if (entry.kind === 'item' || entry.kind === 'items') {
      var list = listFor(entry.scope, entry.key);
      var items = (entry.items || [{ item: entry.item, index: entry.index }]).slice()
        .sort(function (a, b) { return a.index - b.index; });
      items.forEach(function (x) {
        list.splice(Math.min(x.index, list.length), 0, x.item);
      });
    } else if (entry.kind === 'block') {
      var d = Store.day(entry.key, true);
      d.blocks.splice(Math.min(entry.index, d.blocks.length), 0, entry.item);
    } else if (entry.kind === 'carry') {
      var t = Store.day(entry.to, true);
      t.todos = t.todos.filter(function (x) { return entry.ids.indexOf(x.id) < 0; });
    }
    Store.saveNow();
  }

  function undoEntry(entry) {
    if (!entry) return;
    Store.trashRemove(entry.id);
    restoreEntry(entry);
    refresh();
    UI.toast('Restored');
  }

  function actTodoDel(el) {
    var f = findItem(el.dataset.scope, el.dataset.key, el.dataset.id);
    if (!f) return;
    var removed = f.list.splice(f.index, 1)[0];
    var entry = Store.trashAdd({
      kind: 'item', scope: el.dataset.scope, key: el.dataset.key,
      item: removed, index: f.index, text: removed.text
    });
    Store.save();
    refresh();
    announce('Deleted ' + removed.text);
    UI.toast('Deleted “' + short(removed.text) + '”', { action: function () { undoEntry(entry); } });
  }

  function actTodoEdit(el) {
    global.Parts.editingId = el.dataset.id;
    refresh();
    var input = document.querySelector('.row-input');
    if (input) { input.focus(); input.select(); }
  }

  function commitInline(el, cancel) {
    if (!global.Parts.editingId) return;
    var scope = el.dataset.scope, key = el.dataset.key, id = el.dataset.id;
    var value = (el.value || '').trim();
    var f = findItem(scope, key, id);
    global.Parts.editingId = null;
    if (f && !cancel && value) {
      f.item.text = value;
      Store.saveNow();
    }
    refresh();
  }

  /* ---------------- trash ---------------- */

  function actTrashRestore(id) {
    var entry = Store.trashRemove(id);
    if (!entry) return;
    restoreEntry(entry);
    refresh();
    UI.toast('Restored');
  }

  function actTrashDelete(id) {
    Store.trashRemove(id);
    refresh();
    UI.toast('Removed for good');
  }

  function actTrashEmpty() {
    var n = Store.trash().length;
    if (!n) { UI.toast('Trash is already empty'); return; }
    UI.confirm({
      title: 'Empty the trash?',
      message: n + ' deleted item' + (n > 1 ? 's' : '') + ' will be removed permanently. This cannot be undone.',
      ok: 'Empty trash', danger: true
    }).then(function (yes) {
      if (!yes) return;
      Store.trashEmpty();
      refresh();
      UI.toast('Trash emptied');
    });
  }

  function actBlockAdd(key) {
    var d = Store.day(key, true);
    d.blocks.push({ id: Store.uid(), start: D.nowTime(), end: '', text: '' });
    Store.save();
    refresh();
    var inputs = document.querySelectorAll('[data-bind="block-text"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }

  function actBlockDel(el) {
    var d = Store.day(el.dataset.key, true);
    var index = -1;
    var removed = null;
    d.blocks.forEach(function (b, i) { if (b.id === el.dataset.id) { index = i; removed = b; } });
    if (!removed) return;
    d.blocks.splice(index, 1);
    var entry = Store.trashAdd({
      kind: 'block', key: el.dataset.key, item: removed, index: index,
      text: removed.text || removed.start
    });
    Store.save();
    refresh();
    UI.toast('Block removed', { action: function () { undoEntry(entry); } });
  }

  function actCarryOver(from, to) {
    var src = Store.day(from, true);
    var dst = Store.day(to, true);
    var ids = [];
    src.todos.forEach(function (t) {
      if (!t.done) {
        var id = Store.uid();
        dst.todos.push({ id: id, text: t.text, done: false, prio: !!t.prio, carried: true });
        ids.push(id);
      }
    });
    if (!ids.length) { UI.toast('Nothing to carry over'); return; }
    var entry = Store.trashAdd({ kind: 'carry', to: to, ids: ids, text: ids.length + ' carried tasks' });
    Store.saveNow();
    refresh();
    UI.toast('Moved ' + ids.length + ' unfinished task' + (ids.length > 1 ? 's' : '') + ' to ' + D.prettyDay(to),
      { action: function () { undoEntry(entry); } });
  }

  function actClearDone(key) {
    var d = Store.day(key, true);
    var removed = [];
    d.todos.forEach(function (t, i) { if (t.done) removed.push({ item: t, index: i }); });
    if (!removed.length) { UI.toast('Nothing completed yet'); return; }
    d.todos = d.todos.filter(function (t) { return !t.done; });
    var entry = Store.trashAdd({
      kind: 'items', scope: 'day', key: key, items: removed,
      text: removed.length + ' completed task' + (removed.length > 1 ? 's' : '')
    });
    Store.saveNow();
    refresh();
    UI.toast('Cleared ' + removed.length + ' completed', { action: function () { undoEntry(entry); } });
  }

  function actMonthGoalAdd(key) {
    UI.openModal({
      title: 'Goal for ' + D.monthLabel(key),
      body: '<div class="field"><label for="mgText">Goal</label><input type="text" id="mgText" placeholder="What should this month achieve?"></div>',
      actions: [
        { label: 'Cancel', value: null, cls: 'btn-ghost' },
        {
          label: 'Add goal', value: 'add', cls: 'btn', onClick: function () {
            var v = ($('mgText').value || '').trim();
            if (!v) { UI.toast('Type a goal first'); return false; }
            Store.month(key, true).goals.push({ id: Store.uid(), text: v, done: false });
            Store.saveNow();
            refresh();
            UI.toast('Goal added to ' + D.monthLabel(key));
          }
        }
      ],
      onMount: function (body) {
        body.querySelector('input').addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); var b = document.querySelectorAll('#modalActions .btn'); b[b.length - 1].click(); }
        });
      }
    });
  }

  function actArchiveYear(y) {
    var n = Store.archiveYear(y);
    if (!n) { UI.toast('Nothing to archive in ' + y); return; }
    UI.toast('Archived ' + y + ' (' + n + ' records)');
    actGo('#/archive/' + y);
    refresh();
  }

  function actArchiveExport(y) {
    var u = Store.user();
    if (!u.archives[y]) return;
    UI.download('planner-archive-' + y + '.json', JSON.stringify(u.archives[y], null, 2), 'application/json');
    UI.toast('Archive ' + y + ' exported');
  }

  function actArchiveRestore(y) {
    UI.confirm({
      title: 'Restore ' + y + '?',
      message: 'This moves ' + y + ' back into the live planner and removes it from the archive list.',
      ok: 'Restore'
    }).then(function (yes) {
      if (!yes) return;
      var n = Store.restoreArchive(y);
      UI.toast('Restored ' + n + ' records');
      actGo('#/year/' + y);
      refresh();
    });
  }

  function actArchiveDelete(y) {
    UI.confirm({
      title: 'Delete archive ' + y + '?',
      message: 'This permanently removes ' + y + ' from this device. Export it first if you might need it.',
      ok: 'Delete', danger: true
    }).then(function (yes) {
      if (!yes) return;
      Store.removeArchive(y);
      UI.toast('Archive ' + y + ' deleted');
      actGo('#/archive');
      refresh();
    });
  }

  function actChangePin() {
    var cur = ($('curPin').value || '').trim();
    var next = ($('newPin').value || '').trim();
    var res = Store.changePin(cur, next);
    if (!res.ok) { UI.toast(res.error); return; }
    $('curPin').value = '';
    $('newPin').value = '';
    UI.toast('PIN updated');
  }

  function actDeleteProfile() {
    var u = Store.user();
    UI.confirm({
      title: 'Delete “' + u.name + '”?',
      message: 'All days, weeks, goals and archives for this profile will be removed from this device.',
      ok: 'Delete profile', danger: true
    }).then(function (yes) {
      if (!yes) return;
      Store.removeUser(Store.state().activeUser);
      showLock();
      UI.toast('Profile deleted');
    });
  }

  function actExportDay(key) {
    var d = Store.day(key, true);
    var lines = ['# ' + D.longDay(key), ''];
    if (d.intention) lines.push('**Intention:** ' + d.intention, '');
    lines.push('## Tasks', '');
    if (!d.todos.length) lines.push('_No tasks._');
    d.todos.forEach(function (t) { lines.push('- [' + (t.done ? 'x' : ' ') + '] ' + t.text + (t.prio ? ' _(priority)_' : '')); });
    if (d.blocks.length) {
      lines.push('', '## Schedule', '');
      d.blocks.slice().sort(function (a, b) { return (D.minutesOf(a.start) || 0) - (D.minutesOf(b.start) || 0); })
        .forEach(function (b) { lines.push('- **' + (b.start || '--:--') + '** — ' + (b.text || '')); });
    }
    if (d.notes) lines.push('', '## Notes', '', d.notes);
    UI.download('planner-' + key + '.md', lines.join('\n'), 'text/markdown;charset=utf-8');
    UI.toast('Day exported as Markdown');
  }

  /* ---------------- calendar export (ICS) ---------------- */

  function icsStamp() {
    return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  function icsTime(minutes) {
    return D.pad(Math.floor(minutes / 60)) + D.pad(minutes % 60) + '00';
  }

  function icsEsc(text) {
    return String(text == null ? '' : text)
      .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  /** RFC 5545 folds lines longer than 75 octets. */
  function icsFold(line) {
    if (line.length <= 74) return line;
    var out = line.slice(0, 74);
    var rest = line.slice(74);
    while (rest.length) {
      out += '\r\n ' + rest.slice(0, 73);
      rest = rest.slice(73);
    }
    return out;
  }

  function icsFor(keys) {
    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Planner Pro//Planner Pro 14//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Planner Pro'
    ];
    var events = 0;
    keys.forEach(function (key) {
      var day = Store.peekDay(key);
      if (!day) return;
      (day.blocks || []).forEach(function (b) {
        var start = D.minutesOf(b.start);
        if (start == null || !b.text) return;
        var end = D.minutesOf(b.end);
        if (end == null || end <= start) end = start + 60;
        var dt = key.replace(/-/g, '');
        lines.push('BEGIN:VEVENT');
        lines.push('UID:' + b.id + '@planner-pro');
        lines.push('DTSTAMP:' + icsStamp());
        lines.push('DTSTART:' + dt + 'T' + icsTime(start));
        lines.push('DTEND:' + dt + 'T' + icsTime(end));
        lines.push(icsFold('SUMMARY:' + icsEsc(b.text)));
        if (day.intention) lines.push(icsFold('DESCRIPTION:' + icsEsc(day.intention)));
        lines.push('END:VEVENT');
        events++;
      });
    });
    lines.push('END:VCALENDAR');
    return events ? lines.join('\r\n') : '';
  }

  function actExportIcs(days) {
    var keys = String(days || D.todayKey()).split(',').filter(function (k) { return D.isKey(k); });
    var content = icsFor(keys);
    if (!content) {
      UI.toast('No time blocks to export — add a block first');
      return;
    }
    var name = keys.length > 1
      ? 'planner-week-' + keys[0] + '.ics'
      : 'planner-day-' + keys[0] + '.ics';
    UI.download(name, content, 'text/calendar;charset=utf-8');
    UI.toast('Calendar file downloaded');
  }

  function allMarkdown() {
    var u = Store.user();
    var out = ['# Planner Pro export — ' + u.name, '', 'Exported ' + D.longDay(D.todayKey()), ''];
    var days = Object.keys(u.days).sort();
    out.push('## Days (' + days.length + ')', '');
    days.forEach(function (k) {
      var d = u.days[k];
      if (!d.todos.length && !d.notes && !d.intention && !d.blocks.length) return;
      out.push('### ' + D.longDay(k));
      if (d.intention) out.push('', '_' + d.intention + '_');
      d.todos.forEach(function (t) { out.push('- [' + (t.done ? 'x' : ' ') + '] ' + t.text); });
      d.blocks.forEach(function (b) { out.push('- ' + (b.start || '--:--') + ' — ' + (b.text || '')); });
      if (d.notes) out.push('', d.notes);
      out.push('');
    });
    Object.keys(u.weeks).sort().forEach(function (k) {
      var w = u.weeks[k];
      if (!w.focus && !(w.todos || []).length) return;
      out.push('## Week of ' + D.prettyDay(k));
      if (w.focus) out.push('', '**Focus:** ' + w.focus);
      (w.todos || []).forEach(function (t) { out.push('- [' + (t.done ? 'x' : ' ') + '] ' + t.text); });
      out.push('');
    });
    Object.keys(u.years).sort().forEach(function (k) {
      var y = u.years[k];
      out.push('## ' + k + (y.theme ? ' — ' + y.theme : ''));
      (y.goals || []).forEach(function (g) { out.push('- [' + (g.done ? 'x' : ' ') + '] ' + g.text); });
      out.push('');
    });
    if (u.quickNotes) out.push('## Brain dump', '', u.quickNotes, '');
    return out.join('\n');
  }

  function actExportDb() {
    UI.download('planner-backup-' + D.todayKey() + '.json', Store.exportJSON(), 'application/json');
    Store.markExported();
    UI.toast('Backup downloaded');
    refresh();
  }

  function actImportDb() {
    var input = $('importFile');
    if (input) input.click();
  }

  function handleImportFile(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      UI.confirm({
        title: 'Replace all data?',
        message: 'Importing replaces every profile and plan currently in this browser with the contents of the backup.',
        ok: 'Import', danger: true
      }).then(function (yes) {
        if (!yes) { e.target.value = ''; return; }
        var res = Store.importJSON(ev.target.result);
        e.target.value = '';
        if (!res.ok) { UI.toast(res.error); return; }
        UI.toast('Backup imported');
        showApp();
        refresh();
      });
    };
    reader.readAsText(file);
  }

  function actInstall() {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then(function (c) {
        if (c.outcome === 'accepted') UI.toast('Installing…');
        installPrompt = null;
      });
    } else {
      UI.toast('Use your browser menu → “Install app” / “Add to Home Screen”.');
    }
  }

  function quickAddModal() {
    var tk = D.todayKey();
    UI.openModal({
      title: 'Quick add',
      body: '<div class="field"><label for="qaText">Task</label>' +
        '<input type="text" id="qaText" placeholder="What needs doing?" autocomplete="off"></div>' +
        '<div class="field" style="margin-top:10px"><label for="qaDate">Day</label>' +
        '<input type="date" id="qaDate" value="' + tk + '"></div>' +
        '<label style="display:flex;gap:9px;align-items:center;margin-top:10px;cursor:pointer">' +
        '<input type="checkbox" id="qaPrio"><span class="small">Mark as priority</span></label>',
      actions: [
        { label: 'Cancel', value: null, cls: 'btn-ghost' },
        {
          label: 'Add task', value: 'add', cls: 'btn', onClick: function () {
            var text = ($('qaText').value || '').trim();
            if (!text) { UI.toast('Type a task first'); return false; }
            var key = $('qaDate').value || tk;
            Store.day(key, true).todos.push({ id: Store.uid(), text: text, done: false, prio: $('qaPrio').checked });
            Store.saveNow();
            UI.toast('Added to ' + D.prettyDay(key));
            refresh();
          }
        }
      ],
      onMount: function (body) {
        var input = body.querySelector('input');
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); var b = document.querySelectorAll('#modalActions .btn'); b[b.length - 1].click(); }
        });
      }
    });
  }

  function accountModal() {
    var u = Store.user();
    var users = Store.users();
    var body = '<div class="brand" style="margin-bottom:12px"><span class="avatar">' + esc(UI.initials(u.name)) + '</span>' +
      '<div><strong>' + esc(u.name) + '</strong><small>' + Object.keys(u.days).length + ' days · ' +
      Store.streak() + ' day streak</small></div></div>' +
      '<div class="stack">' +
      '<button class="btn btn-ghost" data-act="go" data-href="#/settings">' + icon('settings') + 'Settings &amp; backup</button>' +
      '<button class="btn btn-ghost" data-act="lock">' + icon('lock') + 'Lock &amp; switch profile</button>' +
      '</div>' +
      (users.length > 1 ? '<p class="tiny dim" style="margin-top:10px">' + users.length + ' profiles on this device: ' +
        esc(users.map(function (x) { return x.name; }).join(', ')) + '</p>' : '');
    UI.openModal({ title: 'Account', body: body, actions: [{ label: 'Close', value: null, cls: 'btn-ghost' }] });
  }

  /* ======================================================================
     palette
     ====================================================================== */
  function paletteCommands() {
    var cmds = [
      { label: 'Quick add task', hint: 'N', icon: 'plus', run: function () { quickAddModal(); } },
      { label: 'Go to Today', hint: 'T', icon: 'today', run: function () { actGo('#/today'); } },
      { label: 'Go to Day', hint: 'D', icon: 'day', run: function () { actGo('#/day/' + D.todayKey()); } },
      { label: 'Go to Week', hint: 'W', icon: 'week', run: function () { actGo('#/week/' + D.weekStartKey(D.todayKey(), Store.user().weekStart)); } },
      { label: 'Go to Year', hint: 'Y', icon: 'year', run: function () { actGo('#/year/' + new Date().getFullYear()); } },
      { label: 'Go to Archive', hint: 'A', icon: 'archive', run: function () { actGo('#/archive'); } },
      { label: 'Settings', icon: 'settings', run: function () { actGo('#/settings'); } },
      { label: 'Switch theme', icon: 'theme', run: function () { cycleTheme(); } },
      { label: 'Export backup', icon: 'download', run: actExportDb },
      { label: 'Export everything as Markdown', icon: 'note', run: function () { UI.download('planner-export.md', allMarkdown(), 'text/markdown'); } },
      { label: 'Print this view', icon: 'print', run: function () { window.print(); } },
      { label: 'Lock app', icon: 'lock', run: function () { Store.lock(); showLock(); } }
    ];
    return cmds;
  }

  var MONTH_WORDS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  function dateFromMonthDay(monthIndex, day) {
    if (monthIndex < 0 || day < 1 || day > 31) return null;
    var y = new Date().getFullYear();
    var key = y + '-' + D.pad(monthIndex + 1) + '-' + D.pad(day);
    if (D.monthKey(key) !== y + '-' + D.pad(monthIndex + 1)) return null;   // 31 Feb, etc.
    // a date far in the past probably means next year
    if (D.diffDays(key, D.todayKey()) < -180) {
      key = (y + 1) + '-' + D.pad(monthIndex + 1) + '-' + D.pad(day);
    }
    return key;
  }

  /** "tomorrow", "next friday", "24 dec", "dec 24", "2026-12-24" → date key */
  function parseDateQuery(raw) {
    var q = String(raw || '').trim().toLowerCase();
    if (!q) return null;
    var today = D.todayKey();

    if (q === 'today' || q === 'now') return today;
    if (q === 'tomorrow' || q === 'tmr' || q === 'tmrw') return D.addDays(today, 1);
    if (q === 'yesterday') return D.addDays(today, -1);
    if (/^\d{4}-\d{2}-\d{2}$/.test(q)) return D.isKey(q) ? q : null;

    var wd = q.match(/^(?:next|this|on)?\s*(sun|mon|tue|wed|thu|fri|sat)[a-z]*$/);
    if (wd) {
      var names = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
      var delta = (names[wd[1]] - D.weekday(today) + 7) % 7;
      return D.addDays(today, delta === 0 ? 7 : delta);
    }

    var a = q.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,})$/);
    if (a) return dateFromMonthDay(MONTH_WORDS.indexOf(a[2].slice(0, 3)), Number(a[1]));

    var b = q.match(/^([a-z]{3,})\s+(\d{1,2})(?:st|nd|rd|th)?$/);
    if (b) return dateFromMonthDay(MONTH_WORDS.indexOf(b[1].slice(0, 3)), Number(b[2]));

    return null;
  }

  function openPalette() {
    $('palette').hidden = false;
    $('paletteInput').value = '';
    renderPalette('');
    setTimeout(function () { $('paletteInput').focus(); }, 20);
  }

  function closePalette() {
    $('palette').hidden = true;
  }

  function renderPalette(q) {
    q = (q || '').trim();
    var lower = q.toLowerCase();
    var cmds = paletteCommands().filter(function (c) {
      return !lower || c.label.toLowerCase().indexOf(lower) >= 0;
    });
    var jump = parseDateQuery(q);

    var results = [];
    if (q.length >= 2) {
      try {
        results = (global.Views.search.collect ? global.Views.search.collect(q) : []).slice(0, 8);
      } catch (e) { results = []; }
    }

    palItems = [];
    var h = '';

    if (jump) {
      var jumpLabel = D.relative(jump) || D.prettyDay(jump);
      palItems.push({ run: function () { actGo('#/day/' + jump); } });
      h += '<div class="pal-group">Jump to a date</div>' +
        '<button class="pal-item" data-pal="0" aria-selected="false">' + icon('day') +
        '<span>Open ' + esc(jumpLabel) + '</span><small>' + esc(jump) + '</small></button>';
    }

    if (cmds.length) {
      h += '<div class="pal-group">Commands</div>';
      cmds.forEach(function (c) {
        var idx = palItems.length;
        palItems.push({ run: c.run });
        h += '<button class="pal-item" data-pal="' + idx + '" aria-selected="false">' + icon(c.icon) +
          '<span>' + esc(c.label) + '</span>' + (c.hint ? '<small>' + esc(c.hint) + '</small>' : '') + '</button>';
      });
    }
    if (results.length) {
      h += '<div class="pal-group">Your data</div>';
      results.forEach(function (r) {
        var idx = palItems.length;
        palItems.push({ run: function () { actGo(r.href); } });
        h += '<button class="pal-item" data-pal="' + idx + '" aria-selected="false">' + icon('search') +
          '<span class="truncate">' + esc(r.title) + '</span><small>' + esc(r.kind) + '</small></button>';
      });
    }
    if (!palItems.length) h = UI.empty('search', 'No commands or notes match “' + q + '”.');
    $('paletteList').innerHTML = h;
    palIndex = 0;
    highlightPalette();
  }

  function highlightPalette() {
    var items = $('paletteList').querySelectorAll('.pal-item');
    items.forEach(function (el, i) { el.setAttribute('aria-selected', i === palIndex ? 'true' : 'false'); });
    var active = items[palIndex];
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
  }

  function runPalette(i) {
    var item = palItems[i];
    closePalette();
    if (item && typeof item.run === 'function') setTimeout(item.run, 10);
  }

  /* ======================================================================
     theme cycle
     ====================================================================== */
  function cycleTheme() {
    var next = Store.cycleTheme();
    applyTheme();
    var label = (Store.THEMES.filter(function (t) { return t.id === next; })[0] || {}).label || next;
    UI.toast('Theme: ' + label);
    refresh();
  }

  /* ======================================================================
     events
     ====================================================================== */
  function bindEvents() {
    /* ---- lock screen ---- */
    $('lockUsers').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-pick]');
      if (btn) pickUser(btn.dataset.pick);
    });
    $('pinForm').addEventListener('submit', tryUnlock);
    $('lockBack').addEventListener('click', backToUsers);
    $('createUserBtn').addEventListener('click', createProfile);
    $('newUserPin').addEventListener('keydown', function (e) { if (e.key === 'Enter') createProfile(); });

    /* ---- clicks ---- */
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]');
      if (!el) return;
      var act = el.dataset.act;
      var ds = el.dataset;

      switch (act) {
        case 'go': actGo(ds.href); break;
        case 'palette': openPalette(); break;
        case 'quick-add': quickAddModal(); break;
        case 'account': accountModal(); break;
        case 'lock': Store.lock(); showLock(); break;
        case 'cycle-theme': cycleTheme(); break;
        case 'todo-toggle': actTodoToggle(el); break;
        case 'todo-prio': actTodoPrio(el); break;
        case 'todo-del': actTodoDel(el); break;
        case 'todo-edit': actTodoEdit(el); break;
        case 'block-add': actBlockAdd(ds.key); break;
        case 'block-del': actBlockDel(el); break;
        case 'carry-over': actCarryOver(ds.from, ds.to); break;
        case 'clear-done': actClearDone(ds.key); break;
        case 'month-goal-add': actMonthGoalAdd(ds.key); break;
        case 'archive-year': actArchiveYear(ds.year); break;
        case 'archive-last-year': actArchiveYear(String(new Date().getFullYear() - 1)); break;
        case 'archive-export': actArchiveExport(ds.year); break;
        case 'archive-restore': actArchiveRestore(ds.year); break;
        case 'archive-delete': actArchiveDelete(ds.year); break;
        case 'export-db': actExportDb(); break;
        case 'import-db': actImportDb(); break;
        case 'export-md': UI.download('planner-export-' + D.todayKey() + '.md', allMarkdown(), 'text/markdown;charset=utf-8'); UI.toast('Markdown exported'); break;
        case 'export-day': actExportDay(ds.key); break;
        case 'export-ics': actExportIcs(ds.days); break;
        case 'dismiss-backup': Store.snoozeBackup(3); refresh(); UI.toast('We will remind you in 3 days'); break;
        case 'trash-restore': actTrashRestore(ds.id); break;
        case 'trash-delete': actTrashDelete(ds.id); break;
        case 'trash-empty': actTrashEmpty(); break;
        case 'change-pin': actChangePin(); break;
        case 'delete-profile': actDeleteProfile(); break;
        case 'install': actInstall(); break;
        case 'print': window.print(); break;
        case 'theme-set': Store.setTheme(ds.theme); applyTheme(); refresh(); break;
        default: break;
      }
    });

    /* ---- forms ---- */
    document.addEventListener('submit', function (e) {
      var form = e.target.closest('form[data-form]');
      if (!form) return;
      e.preventDefault();
      if (form.dataset.form === 'add-todo') {
        var input = form.querySelector('input[name="text"]');
        var text = (input.value || '').trim();
        if (!text) return;
        var scope = form.dataset.scope, key = form.dataset.key;
        listFor(scope, key).push({ id: Store.uid(), text: text, done: false, prio: false });
        Store.save();
        input.value = '';
        refresh({ scope: scope, key: key });
      }
    });

    /* ---- input / change ---- */
    document.addEventListener('input', function (e) {
      var t = e.target;

      if (t.id === 'searchInput') {
        var box = $('searchResults');
        if (box) box.innerHTML = global.Views.search.results(t.value);
        return;
      }

      var b = t.dataset && t.dataset.bind;
      if (!b) return;
      var key = t.dataset.key;
      var val = t.type === 'checkbox' ? t.checked : t.value;

      switch (b) {
        case 'day-intention': Store.day(key, true).intention = val; Store.save(); break;
        case 'day-notes': Store.day(key, true).notes = val; Store.save(); break;
        case 'quick-notes': Store.user().quickNotes = val; Store.save(); break;
        case 'week-focus': Store.week(key, true).focus = val; Store.save(); break;
        case 'year-theme': Store.year(key, true).theme = val; Store.save(); break;
        case 'block-start':
        case 'block-text': {
          var day = Store.day(key, true);
          var blk = day.blocks.filter(function (x) { return x.id === t.dataset.id; })[0];
          if (blk) {
            if (b === 'block-start') blk.start = val; else blk.text = val;
            Store.save();
          }
          break;
        }
        case 'user-name':
          if (val.trim()) {
            Store.renameUser(val);
            $('railName').textContent = val.trim();
            $('railAvatar').textContent = UI.initials(val.trim());
          }
          break;
        default: break;
      }
    });

    document.addEventListener('change', function (e) {
      var t = e.target;
      var b = t.dataset && t.dataset.bind;
      if (t.dataset && t.dataset.file === 'import') { handleImportFile(e); return; }
      if (!b) return;

      if (b === 'day-date') { actGo('#/day/' + (t.value || D.todayKey())); return; }
      if (b === 'theme') { Store.setTheme(t.value); applyTheme(); refresh(); UI.toast('Theme updated'); return; }
      if (b === 'week-start') { Store.user().weekStart = Number(t.value); Store.saveNow(); refresh(); return; }
      if (b === 'auto-archive') { Store.user().settings.autoArchive = t.checked; Store.saveNow(); return; }
      if (b === 'require-pin') { Store.user().settings.requirePin = t.checked; Store.saveNow(); return; }
      if (b === 'block-start' || b === 'block-text') {
        var day = Store.day(t.dataset.key, true);
        var blk = day.blocks.filter(function (x) { return x.id === t.dataset.id; })[0];
        if (blk) { if (b === 'block-start') blk.start = t.value; else blk.text = t.value; Store.save(); }
      }
    });

    /* ---- inline edit loses focus ---- */
    document.addEventListener('focusout', function (e) {
      if (e.target && e.target.classList && e.target.classList.contains('row-input') && global.Parts.editingId) {
        commitInline(e.target, false);
      }
    });

    /* ---- palette ---- */
    $('paletteInput').addEventListener('input', function (e) { renderPalette(e.target.value); });
    $('palette').addEventListener('click', function (e) {
      if (e.target === $('palette')) { closePalette(); return; }
      var item = e.target.closest('[data-pal]');
      if (item) runPalette(Number(item.dataset.pal));
    });
    $('paletteInput').addEventListener('keydown', function (e) {
      var items = $('paletteList').querySelectorAll('.pal-item');
      if (e.key === 'ArrowDown') { e.preventDefault(); palIndex = Math.min(palIndex + 1, items.length - 1); highlightPalette(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); palIndex = Math.max(palIndex - 1, 0); highlightPalette(); }
      else if (e.key === 'Enter') { e.preventDefault(); runPalette(palIndex); }
      else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    });

    /* ---- modal scrim ---- */
    $('modal').addEventListener('click', function (e) { if (e.target === $('modal')) UI.closeModal(null); });

    /* ---- keyboard ---- */
    document.addEventListener('keydown', function (e) {
      var typing = e.target && (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable);

      if (e.target && e.target.classList && e.target.classList.contains('row-input')) {
        if (e.key === 'Enter') { e.preventDefault(); commitInline(e.target, false); return; }
        if (e.key === 'Escape') { e.preventDefault(); commitInline(e.target, true); return; }
      }

      if (e.key === 'Escape') {
        if (!$('palette').hidden) { closePalette(); return; }
        if (!$('modal').hidden) { UI.closeModal(null); return; }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openPalette();
        return;
      }
      if (!$('app').hidden && !typing) {
        var k = e.key.toLowerCase();
        if (k === 'n') { e.preventDefault(); quickAddModal(); return; }
        if (k === 't') { actGo('#/today'); return; }
        if (k === 'd') { actGo('#/day/' + D.todayKey()); return; }
        if (k === 'w') { actGo('#/week/' + D.weekStartKey(D.todayKey(), Store.user().weekStart)); return; }
        if (k === 'y') { actGo('#/year/' + new Date().getFullYear()); return; }
        if (k === 'a') { actGo('#/archive'); return; }
        if (k === '/') { e.preventDefault(); actGo('#/search'); return; }
        if (/^[1-5]$/.test(k)) {
          var id = TABS[Number(k) - 1];
          if (id) actGo(id === 'today' ? '#/today' : '#/' + id);
        }
      }
    });

    /* ---- lifecycle ---- */
    window.addEventListener('hashchange', route);
    window.addEventListener('beforeunload', function () { Store.saveNow(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) Store.saveNow();
      else if (Store.user()) refresh();
    });
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: light)');
      var onChange = function () { if (Store.user() && Store.user().theme === 'system') { applyTheme(); } };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
    }
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      installPrompt = e;
      var b = $('installBtn');
      if (b) b.textContent = 'Install app';
    });
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        reg.addEventListener('updatefound', function () {
          var next = reg.installing;
          if (!next) return;
          next.addEventListener('statechange', function () {
            if (next.state === 'installed' && navigator.serviceWorker.controller) {
              UI.toast('A new version is ready', {
                actionLabel: 'Reload',
                duration: 15000,
                action: function () {
                  next.postMessage('skipWaiting');
                  setTimeout(function () { location.reload(); }, 250);
                }
              });
            }
          });
        });
        // look for a new build once the app has settled
        setTimeout(function () { reg.update().catch(function () {}); }, 5000);
      }).catch(function () { /* offline still works from the file system */ });
    });
  }

  /* Exposed for the end-to-end suite: pure helpers with no side effects. */
  global.PlannerDebug = { icsFor: icsFor, parseDateQuery: parseDateQuery, icsEsc: icsEsc };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
