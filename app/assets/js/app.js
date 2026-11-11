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
    { id: 'insights', label: 'Insights', icon: 'chart', href: '#/insights' },
    { id: 'search', label: 'Search', icon: 'search', href: '#/search' },
    { id: 'settings', label: 'Settings', icon: 'settings', href: '#/settings' },
    { id: 'about', label: 'About', icon: 'info', href: '#/about' }
  ];
  var TABS = ['today', 'day', 'week', 'year', 'settings'];

  var currentId = 'today';
  var currentParam = '';
  var pendingId = null;
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
    pendingShare = readShare();
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
    pendingId = null;
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
      return '<button class="user-chip" data-pick="' + esc(u.id) + '" type="button">' +
        '<span class="avatar">' + esc(UI.initials(u.name)) + '</span>' +
        '<span class="chip-body"><span class="chip-name">' + esc(u.name) + '</span>' +
        '<span class="chip-meta">' + esc(dayCount(u.user)) + ' days planned</span></span>' +
        '<span class="go">' + icon('right') + '</span></button>';
    }).join('');
  }

  function dayCount(u) {
    return Object.keys((u && u.days) || {}).length;
  }

  function pickUser(id) {
    pendingId = id;
    var u = Store.state().users[id];
    $('lockHint').textContent = 'Enter the PIN for ' + (u ? u.name : 'this profile');
    $('lockUsers').hidden = true;
    $('newUserBox').hidden = true;
    $('pinForm').hidden = false;
    $('lockBack').hidden = false;
    $('pinInput').value = '';
    setTimeout(function () { $('pinInput').focus(); }, 40);
  }

  function backToUsers() {
    pendingId = null;
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
    if (!pendingId || !pin) return;

    var submit = $('pinForm').querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;

    Store.auth(pendingId, pin).then(function (ok) {
      if (submit) submit.disabled = false;
      if (!ok) {
        $('pinInput').value = '';
        UI.toast('Wrong PIN — try again');
        $('pinInput').focus();
        return;
      }
      showApp();
    }).catch(function () {
      if (submit) submit.disabled = false;
      UI.toast('Could not check the PIN on this device');
    });
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
    setTimeout(consumeShare, 350);

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
    cursor = -1;
    // the calendar always follows the view; paging it is a temporary peek
    calMonth = D.monthKey((id === 'day' && D.isKey(currentParam)) ? currentParam : D.todayKey());
    if (selection.key && (id !== 'day' && id !== 'today')) {
      selection = { key: null, ids: [] };
    }
    syncSelection();

    // materialise repeating tasks for whatever days this view shows
    try {
      if (id === 'today') Store.ensureRecurring(D.todayKey());
      else if (id === 'day') Store.ensureRecurring(D.isKey(currentParam) ? currentParam : D.todayKey());
      else if (id === 'week') {
        var wsKey = D.weekStartKey(D.isKey(currentParam) ? currentParam : D.todayKey(), Store.user().weekStart);
        D.weekDates(wsKey).forEach(function (k) { Store.ensureRecurring(k); });
      }
    } catch (e) { /* a broken rule must never block the view */ }

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
    // the floating add button would sit on top of a view's own composer
    $('app').classList.toggle('has-composer', ['today', 'day', 'week', 'year'].indexOf(id) >= 0);
    if (isRoute) window.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
    renderMiniCal();
    if (id === 'insights') {
      var heat = document.querySelector('.heat-scroll');
      if (heat && heat.scrollWidth > heat.clientWidth) heat.scrollLeft = heat.scrollWidth;
    }
    if (id === 'search') {
      var si = $('searchInput');
      if (si) { si.focus(); if (si.value) si.setSelectionRange(si.value.length, si.value.length); }
    }
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
    var keepCursor = cursor;
    renderView(currentId, currentParam, false);
    if (keepCursor >= 0) setCursor(keepCursor);
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

  /* ---------------- drag to reorder ----------------
     Pointer events, no library. The row is moved in the DOM for live feedback and
     the store is rebuilt from the final DOM order on drop. */

  var dragState = null;

  function beginDrag(e, handle) {
    var row = handle.closest('.row');
    if (!row || !row.dataset.rowId) return;
    var list = listFor(handle.dataset.scope, handle.dataset.key);
    var from = -1;
    list.forEach(function (t, i) { if (t.id === handle.dataset.id) from = i; });
    if (from < 0) return;

    dragState = {
      scope: handle.dataset.scope, key: handle.dataset.key, id: handle.dataset.id,
      row: row, parent: row.parentNode, from: from
    };
    row.classList.add('dragging');
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', endDrag, { once: true });
    document.addEventListener('pointercancel', endDrag, { once: true });
    if (e.preventDefault) e.preventDefault();
  }

  function onDragMove(e) {
    if (!dragState) return;
    var rows = Array.prototype.slice.call(dragState.parent.children);
    var target = null;
    for (var i = 0; i < rows.length; i++) {
      var box = rows[i].getBoundingClientRect();
      if (e.clientY < box.top + box.height / 2) { target = rows[i]; break; }
    }
    rows.forEach(function (r) { r.classList.remove('drop-target'); });
    if (!target) {
      dragState.parent.appendChild(dragState.row);
    } else if (target !== dragState.row) {
      dragState.parent.insertBefore(dragState.row, target);
      target.classList.add('drop-target');
    }
  }

  function endDrag() {
    document.removeEventListener('pointermove', onDragMove);
    if (!dragState) return;
    var st = dragState;
    dragState = null;
    st.row.classList.remove('dragging');
    Array.prototype.forEach.call(st.parent.children, function (r) { r.classList.remove('drop-target'); });

    var order = Array.prototype.map.call(st.parent.children, function (r) { return r.dataset.rowId; });
    var list = listFor(st.scope, st.key);
    var byId = {};
    list.forEach(function (t) { byId[t.id] = t; });
    var reordered = order.map(function (id) { return byId[id]; }).filter(Boolean);
    list.forEach(function (t) { if (reordered.indexOf(t) < 0) reordered.push(t); });

    var changed = reordered.some(function (t, i) { return !list[i] || t.id !== list[i].id; });
    if (changed) {
      list.length = 0;
      reordered.forEach(function (t) { list.push(t); });
      Store.saveNow();
      announce('Reordered');
    }
    refresh();
  }

  function moveRow(rowEl, delta) {
    var btn = rowEl && rowEl.querySelector('[data-act="todo-toggle"]');
    if (!btn) return;
    var list = listFor(btn.dataset.scope, btn.dataset.key);
    var index = -1;
    list.forEach(function (t, i) { if (t.id === btn.dataset.id) index = i; });
    var next = index + delta;
    if (index < 0 || next < 0 || next >= list.length) return;
    var item = list.splice(index, 1)[0];
    list.splice(next, 0, item);
    Store.saveNow();
    cursor = next;
    refresh();
  }

  /* ---------------- keyboard cursor over the task list ---------------- */

  var cursor = -1;

  function currentRows() {
    return Array.prototype.slice.call(document.querySelectorAll('#view .rows .row'));
  }

  function setCursor(i) {
    var rows = currentRows();
    if (!rows.length) { cursor = -1; return; }
    cursor = Math.max(0, Math.min(i, rows.length - 1));
    rows.forEach(function (r, j) { r.classList.toggle('cursor', j === cursor); });
    if (rows[cursor] && rows[cursor].scrollIntoView) rows[cursor].scrollIntoView({ block: 'nearest' });
  }

  function cursorRow() { return currentRows()[cursor] || null; }

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

  /* ---------------- task details: estimate & repeat ---------------- */

  function weekdayChecks(selected) {
    return D.DAYS_SHORT.map(function (name, i) {
      return '<label style="display:inline-flex;gap:5px;align-items:center;margin:0 10px 6px 0;cursor:pointer">' +
        '<input type="checkbox" data-day="' + i + '"' + (selected.indexOf(i) >= 0 ? ' checked' : '') + '>' +
        '<span class="tiny">' + name + '</span></label>';
    }).join('');
  }

  function readRepeatChoice(root) {
    var choice = root.querySelector('#detRepeat').value;
    if (choice === 'none') return null;
    if (choice === 'custom') {
      var days = [];
      Array.prototype.forEach.call(root.querySelectorAll('[data-day]'), function (el) {
        if (el.checked) days.push(Number(el.dataset.day));
      });
      if (!days.length) return { repeat: 'custom', days: [] };
      return { repeat: 'custom', days: days };
    }
    if (choice === 'weekly') return { repeat: 'custom', days: [D.weekday(D.todayKey())] };
    return { repeat: choice, days: [] };
  }

  function actTodoDetails(el) {
    var f = findItem(el.dataset.scope, el.dataset.key, el.dataset.id);
    if (!f) return;
    var t = f.item;
    var rule = t.recurringId ? Store.recurring().filter(function (r) { return r.id === t.recurringId; })[0] : null;
    var choice = rule ? (rule.repeat === 'custom' ? 'custom' : rule.repeat) : 'none';
    var days = rule && rule.days ? rule.days : [];

    UI.openModal({
      title: 'Task details',
      body: '<p class="small" style="margin-bottom:10px">' + esc(t.text) + '</p>' +
        '<div class="field"><label for="detEst">Estimate (minutes)</label>' +
        '<input type="number" id="detEst" min="0" max="1440" step="5" value="' + (t.est || '') + '" placeholder="e.g. 45"></div>' +
        '<div class="field" style="margin-top:12px"><label for="detRepeat">Repeat</label>' +
        '<select id="detRepeat">' +
        '<option value="none"' + (choice === 'none' ? ' selected' : '') + '>Does not repeat</option>' +
        '<option value="daily"' + (choice === 'daily' ? ' selected' : '') + '>Every day</option>' +
        '<option value="weekdays"' + (choice === 'weekdays' ? ' selected' : '') + '>Weekdays (Mon–Fri)</option>' +
        '<option value="weekly"' + (choice === 'weekly' ? ' selected' : '') + '>Every ' + D.DAYS[D.weekday(D.todayKey())] + '</option>' +
        '<option value="custom"' + (choice === 'custom' ? ' selected' : '') + '>Specific days…</option>' +
        '</select></div>' +
        '<div id="detDays" style="margin-top:8px;' + (choice === 'custom' ? '' : 'display:none') + '">' +
        weekdayChecks(days) + '</div>',
      actions: [
        { label: 'Cancel', value: null, cls: 'btn-ghost' },
        {
          label: 'Save', value: 'save', cls: 'btn', onClick: function () {
            var est = Number($('detEst').value || 0);
            if (est < 0 || est > 1440) { UI.toast('Estimate must be 0–1440 minutes'); return false; }
            t.est = est || 0;

            var picked = readRepeatChoice(document.getElementById('modalBody'));
            if (!picked) {
              if (t.recurringId) {
                Store.removeRecurring(t.recurringId);
                delete t.recurringId;
              }
            } else {
              if (t.recurringId) {
                var existing = Store.recurring().filter(function (r) { return r.id === t.recurringId; })[0];
                if (existing) {
                  existing.repeat = picked.repeat;
                  existing.days = picked.days;
                  existing.est = t.est;
                  existing.text = t.text;
                  existing.at = t.at || '';
                  existing.tags = (t.tags || []).slice();
                  existing.prio = !!t.prio;
                  Store.saveNow();
                }
              } else {
                var created = Store.addRecurring({
                  text: t.text, repeat: picked.repeat, days: picked.days,
                  prio: !!t.prio, at: t.at || '', tags: (t.tags || []).slice(),
                  est: t.est, from: D.addDays(D.todayKey(), 1)
                });
                if (created) t.recurringId = created.id;
              }
            }
            Store.saveNow();
            refresh();
            UI.toast(picked ? 'Repeats ' + Store.repeatLabel({ repeat: picked.repeat, days: picked.days }) : 'Details saved');
          }
        }
      ],
      onMount: function (body) {
        var select = body.querySelector('#detRepeat');
        select.addEventListener('change', function () {
          body.querySelector('#detDays').style.display = select.value === 'custom' ? '' : 'none';
        });
      }
    });
  }

  /* ---------------- mini calendar ---------------- */

  var calMonth = null;

  function currentMonthKey() {
    if (!calMonth) {
      var k = (currentId === 'day' && D.isKey(currentParam)) ? currentParam : D.todayKey();
      calMonth = D.monthKey(k);
    }
    return calMonth;
  }

  function renderMiniCal() {
    var key = currentMonthKey();
    var selected = (currentId === 'day' && D.isKey(currentParam)) ? currentParam : D.todayKey();
    var html = global.Parts.miniCalendar(key, { selected: selected });
    ['miniCal', 'miniCalMobile'].forEach(function (id) {
      var host = $(id);
      if (host) host.innerHTML = html;
    });
  }

  function calShift(delta) {
    var key = currentMonthKey();
    var year = Number(key.slice(0, 4));
    var month = Number(key.slice(5, 7)) - 1 + delta;
    var d = new Date(year, month, 1);
    calMonth = d.getFullYear() + '-' + D.pad(d.getMonth() + 1);
    renderMiniCal();
  }

  /* ---------------- share target ----------------
     Chrome on Android can hand a share straight to the app: the manifest
     declares a GET share target, so the text arrives as query parameters. */

  var pendingShare = null;

  function readShare() {
    var params = new URLSearchParams(location.search);
    var text = (params.get('text') || '').trim();
    var title = (params.get('title') || '').trim();
    var url = (params.get('url') || '').trim();
    if (!text && !title && !url) return null;
    var body = [text, title, url].filter(function (x) { return x; }).join(' ').trim();
    if (!body) return null;
    try { history.replaceState({}, '', location.pathname + location.hash); } catch (e) { /* file:// */ }
    return body.slice(0, 300);
  }

  function consumeShare() {
    if (!pendingShare) return;
    var text = pendingShare;
    pendingShare = null;
    quickAddModal(text);
  }

  /* ---------------- subtasks ---------------- */

  function actRowExpand(el) {
    var id = el.dataset.id;
    global.Parts.expandedId = (global.Parts.expandedId === id) ? null : id;
    refresh();
  }

  function findSub(scope, key, id, subId) {
    var f = findItem(scope, key, id);
    if (!f) return null;
    var sub = (f.item.sub || []).filter(function (x) { return x.id === subId; })[0];
    return sub ? { item: f.item, sub: sub } : null;
  }

  function actSubToggle(el) {
    var found = findSub(el.dataset.scope, el.dataset.key, el.dataset.id, el.dataset.sub);
    if (!found) return;
    found.sub.done = !found.sub.done;
    Store.saveNow();
    refresh();
  }

  function actSubDel(el) {
    var f = findItem(el.dataset.scope, el.dataset.key, el.dataset.id);
    if (!f || !f.item.sub) return;
    f.item.sub = f.item.sub.filter(function (x) { return x.id !== el.dataset.sub; });
    Store.saveNow();
    refresh();
  }

  function addSub(form) {
    var f = findItem(form.dataset.scope, form.dataset.key, form.dataset.id);
    if (!f) return;
    var input = form.querySelector('input[name="text"]');
    var text = (input.value || '').trim();
    if (!text) return;
    if (!Array.isArray(f.item.sub)) f.item.sub = [];
    f.item.sub.push({ id: Store.uid(), text: text, done: false });
    global.Parts.expandedId = f.item.id;
    Store.saveNow();
    input.value = '';
    refresh();
    var again = document.querySelector('form[data-form="add-sub"][data-id="' + f.item.id + '"] input');
    if (again) again.focus();
  }

  /* ---------------- data health ---------------- */

  function actHealth() {
    var report = Store.healthCheck();
    if (!report) return;
    var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };
    var body = '<div class="review-stats tiny">' +
      '<span><strong>' + report.days + '</strong> ' + (report.days === 1 ? 'day' : 'days') + '</span>' +
      '<span><strong>' + report.todos + '</strong> ' + (report.todos === 1 ? 'task' : 'tasks') + '</span>' +
      '<span><strong>' + report.trash + '</strong> in trash</span>' +
      '<span><strong>' + UI.fmtBytes(report.size) + '</strong> stored</span>' +
      '</div>' +
      (report.clean
        ? '<p class="small" style="margin-top:12px">No problems found. Ids are intact, no duplicates, no dangling repeats.</p>'
        : '<ul class="health-list">' + report.issues.map(function (i) {
          return '<li><strong>' + i.count + '</strong> · ' + esc(i.label) + '</li>';
        }).join('') + '</ul>');

    UI.openModal({
      title: 'Data health',
      body: body,
      actions: [
        { label: 'Close', value: null, cls: 'btn-ghost' },
        {
          label: report.clean ? 'Nothing to fix' : 'Repair', value: 'fix',
          cls: report.clean ? 'btn-ghost' : 'btn',
          onClick: function () {
            if (report.clean) return;
            var fixed = Store.repair();
            refresh();
            UI.toast('Fixed ' + (fixed.ids + fixed.dupes + fixed.orphans + fixed.trash) + ' record(s)');
          }
        }
      ]
    });
  }

  /* ---------------- CSV import ---------------- */

  /** Minimal RFC-4180 parser: quotes, escaped quotes, embedded newlines. */
  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = '';
    var quoted = false;
    var src = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (var i = 0; i < src.length; i++) {
      var c = src[i];
      if (quoted) {
        if (c === '"') {
          if (src[i + 1] === '"') { field += '"'; i++; }
          else quoted = false;
        } else field += c;
      } else if (c === '"') {
        quoted = true;
      } else if (c === ',') {
        row.push(field); field = '';
      } else if (c === '\n') {
        row.push(field); field = '';
        rows.push(row); row = [];
      } else field += c;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); });
  }

  function actImportCsv() {
    UI.openModal({
      title: 'Import tasks from CSV',
      body: '<p class="small">Columns: <code>date, text, done, tags</code> — a header row is optional. ' +
        'Dates must be <code>YYYY-MM-DD</code>. Tasks already on that day with the same text are skipped.</p>' +
        '<div class="field" style="margin-top:12px"><label for="csvText">Paste CSV</label>' +
        '<textarea id="csvText" style="min-height:120px" placeholder="2026-11-12,Call the clinic,false,health&#10;2026-11-12,Write notes,true,"></textarea></div>' +
        '<input type="file" id="csvFile" accept=".csv,text/csv" style="margin-top:10px">',
      actions: [
        { label: 'Cancel', value: null, cls: 'btn-ghost' },
        {
          label: 'Import', value: 'go', cls: 'btn', onClick: function () {
            var text = ($('csvText').value || '').trim();
            if (!text) { UI.toast('Paste some CSV first'); return false; }
            runCsvImport(text);
          }
        }
      ],
      onMount: function (body) {
        var file = body.querySelector('#csvFile');
        if (!file) return;
        file.addEventListener('change', function () {
          var f = file.files && file.files[0];
          if (!f) return;
          var reader = new FileReader();
          reader.onload = function (ev) { $('csvText').value = ev.target.result; };
          reader.readAsText(f);
        });
      }
    });
  }

  function runCsvImport(text) {
    var rows = parseCsv(text);
    if (!rows.length) { UI.toast('That file has no rows'); return; }

    var header = rows[0].map(function (c) { return String(c).trim().toLowerCase(); });
    var hasHeader = header.indexOf('date') >= 0 && header.indexOf('text') >= 0;
    var idx = hasHeader
      ? { date: header.indexOf('date'), text: header.indexOf('text'), done: header.indexOf('done'), tags: header.indexOf('tags') }
      : { date: 0, text: 1, done: 2, tags: 3 };

    var parsed = [];
    rows.slice(hasHeader ? 1 : 0).forEach(function (r) {
      var date = String(r[idx.date] || '').trim();
      var text = String(r[idx.text] || '').trim();
      if (!D.isKey(date) || !text) return;
      var doneRaw = idx.done >= 0 ? String(r[idx.done] || '').trim().toLowerCase() : '';
      var tagsRaw = idx.tags >= 0 ? String(r[idx.tags] || '') : '';
      parsed.push({
        date: date,
        text: text,
        done: ['1', 'true', 'yes', 'x', 'done'].indexOf(doneRaw) >= 0,
        tags: tagsRaw.split(/[\s,;]+/).map(function (t) { return t.replace(/^#/, '').trim(); })
          .filter(function (t) { return t; })
      });
    });

    if (!parsed.length) { UI.toast('No usable rows — check the date column'); return; }
    var res = Store.importRows(parsed);
    UI.closeModal(null);
    refresh();
    UI.toast('Imported ' + res.tasks + ' task' + (res.tasks === 1 ? '' : 's') + ' across ' + res.days + ' day' + (res.days === 1 ? '' : 's'));
  }

  /* ---------------- panic blur ---------------- */

  /* Track focus from the events themselves: document.hasFocus() is unreliable
     when the window is blurred by another app rather than by navigation. */
  var windowFocused = true;

  function applyPanic(focused) {
    if (typeof focused === 'boolean') windowFocused = focused;
    var u = Store.user();
    var on = !!(u && u.settings && u.settings.panicBlur);
    document.body.classList.toggle('panic', on && !windowFocused);
  }

  /* ---------------- focus timer ----------------
     In memory on purpose: a timer that survives a reload is a lie about what a
     timer is. Closing the app ends the session. */

  var focus = null;          // { endsAt, remaining, total, label, paused }
  var focusTicker = null;

  function renderFocusChip() {
    var chip = $('focusChip');
    if (!chip) return;
    if (!focus) { chip.hidden = true; return; }
    chip.hidden = false;
    chip.classList.toggle('paused', !!focus.paused);
    var left = focus.paused ? focus.remaining : Math.max(0, focus.endsAt - Date.now());
    var secs = Math.ceil(left / 1000);
    $('focusTime').textContent = D.pad(Math.floor(secs / 60)) + ':' + D.pad(secs % 60);
    var pauseBtn = $('focusPause');
    if (pauseBtn) pauseBtn.textContent = focus.paused ? '▶' : '❙❙';
  }

  function startFocus(minutes, label) {
    var mins = Number(minutes) || 25;
    focus = {
      endsAt: Date.now() + mins * 60000,
      remaining: mins * 60000,
      total: mins * 60000,
      paused: false,
      label: label || 'Focus'
    };
    if (focusTicker) clearInterval(focusTicker);
    focusTicker = setInterval(tickFocus, 1000);
    renderFocusChip();
    UI.toast(mins + ' minutes of focus — ' + focus.label);
  }

  function tickFocus() {
    if (!focus || focus.paused) return;
    if (Date.now() >= focus.endsAt) {
      var label = focus.label;
      stopFocus();
      UI.toast('Focus block done — ' + label);
      return;
    }
    renderFocusChip();
  }

  function pauseFocus() {
    if (!focus) return;
    if (focus.paused) {
      focus.endsAt = Date.now() + focus.remaining;
      focus.paused = false;
    } else {
      focus.remaining = Math.max(0, focus.endsAt - Date.now());
      focus.paused = true;
    }
    renderFocusChip();
  }

  function stopFocus() {
    if (focusTicker) { clearInterval(focusTicker); focusTicker = null; }
    focus = null;
    renderFocusChip();
  }

  /** Which block is happening now, for the Focus button's label. */
  function currentBlockLabel(key) {
    var d = Store.peekDay(key);
    if (!d) return 'Focus';
    var now = D.minutesOf(D.nowTime());
    var live = (d.blocks || []).filter(function (b) {
      var s = D.minutesOf(b.start);
      var e = D.minutesOf(b.end) || (s != null ? s + 60 : null);
      return s != null && now != null && s <= now && now < e;
    })[0];
    if (live && live.text) return live.text;
    var next = (d.blocks || []).filter(function (b) {
      var s = D.minutesOf(b.start);
      return s != null && now != null && s >= now;
    }).sort(function (a, b) { return D.minutesOf(a.start) - D.minutesOf(b.start); })[0];
    return (next && next.text) ? next.text : 'Focus';
  }

  /* ---------------- swipe between days ---------------- */

  var swipeStart = null;

  function onSwipeStart(e) {
    if (currentId !== 'day' && currentId !== 'today') { swipeStart = null; return; }
    var t = e.target;
    if (!t || !t.closest) { swipeStart = null; return; }
    if (t.closest('input, textarea, select, [data-act="drag-start"], .heat-scroll')) { swipeStart = null; return; }
    swipeStart = { x: e.clientX, y: e.clientY };
  }

  function onSwipeEnd(e) {
    if (!swipeStart) return;
    var dx = e.clientX - swipeStart.x;
    var dy = e.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) < 60 || Math.abs(dy) > 45) return;
    var key = currentId === 'today' ? D.todayKey() : currentParam;
    if (!D.isKey(key)) return;
    actGo('#/day/' + D.addDays(key, dx < 0 ? 1 : -1));
  }

  /* ---------------- Markdown vault ---------------- */

  function vaultFiles() {
    var u = Store.user();
    var files = [];
    var days = Object.keys(u.days).sort();

    days.forEach(function (k) {
      var d = u.days[k];
      var lines = ['# ' + D.longDay(k), ''];
      if (d.intention) lines.push('> ' + d.intention, '');
      if ((d.todos || []).length) {
        lines.push('## Tasks', '');
        d.todos.forEach(function (t) {
          var meta = [];
          if (t.at) meta.push(t.at);
          if (t.est) meta.push(UI.duration(t.est));
          (t.tags || []).forEach(function (tag) { meta.push('#' + tag); });
          if (t.recurringId) meta.push('↻');
          lines.push('- [' + (t.done ? 'x' : ' ') + '] ' + t.text + (meta.length ? '  _(' + meta.join(' · ') + ')_' : ''));
          (t.sub || []).forEach(function (x) {
            lines.push('  - [' + (x.done ? 'x' : ' ') + '] ' + x.text);
          });
        });
        lines.push('');
      }
      if ((d.blocks || []).length) {
        lines.push('## Schedule', '');
        d.blocks.slice().sort(function (a, b) { return (D.minutesOf(a.start) || 0) - (D.minutesOf(b.start) || 0); })
          .forEach(function (b) {
            lines.push('- **' + (b.start || '--:--') + (b.end ? '–' + b.end : '') + '** ' + (b.text || ''));
          });
        lines.push('');
      }
      if (d.notes) lines.push('## Notes', '', d.notes, '');
      if (d.review && d.review.at) {
        lines.push('## Review', '');
        if (d.review.went) lines.push('- **Went well:** ' + d.review.went);
        if (d.review.drained) lines.push('- **Drained:** ' + d.review.drained);
        if (d.review.next) lines.push('- **For tomorrow:** ' + d.review.next);
        lines.push('');
      }
      files.push({ name: 'days/' + k + '.md', content: lines.join('\n') });
    });

    Object.keys(u.weeks).sort().forEach(function (k) {
      var w = u.weeks[k];
      var lines = ['# Week of ' + D.prettyDay(k), ''];
      if (w.focus) lines.push('**Focus:** ' + w.focus, '');
      if ((w.todos || []).length) {
        lines.push('## Goals', '');
        w.todos.forEach(function (t) { lines.push('- [' + (t.done ? 'x' : ' ') + '] ' + t.text); });
        lines.push('');
      }
      if (w.review && w.review.at) {
        lines.push('## Review', '');
        if (w.review.done) lines.push('### What got done', '', w.review.done, '');
        if (w.review.stuck) lines.push('### Still worth doing', '', w.review.stuck, '');
        if (w.review.change) lines.push('### What changes', '', w.review.change, '');
        if (w.review.focusNext) lines.push('**Next week’s focus:** ' + w.review.focusNext, '');
      }
      files.push({ name: 'weeks/' + k + '.md', content: lines.join('\n') });
    });

    files.push({
      name: 'README.md',
      content: [
        '# ' + u.name + ' — Planner Pro export',
        '',
        'Exported ' + D.longDay(D.todayKey()) + ' from Planner Pro ' + 'v14.8.0' + '.',
        '',
        '- `days/` — one note per planned day, named `YYYY-MM-DD.md`',
        '- `weeks/` — one note per week, named by its first day',
        '',
        'Tasks are Markdown checkboxes, so most editors (Obsidian, Logseq, iA Writer)',
        'render them as a real list. Times, estimates and #tags sit in the trailing',
        'italics so they never get in the way of the sentence.',
        '',
        'Nothing here is uploaded anywhere. The planner stores everything in the',
        'browser it runs in; this folder is the readable copy you own.',
        '',
        'Licence: PolyForm Noncommercial 1.0.0 — https://github.com/drsamonline/planner-pro'
      ].join('\n')
    });

    return files;
  }

  function actExportVault() {
    var files = vaultFiles();
    if (!files.length) { UI.toast('Nothing to export yet'); return; }
    try {
      var blob = global.PlannerZip.build(files);
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'planner-vault-' + D.todayKey() + '.zip';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
      Store.markExported();
      UI.toast('Vault exported — ' + files.length + ' notes');
      refresh();
    } catch (err) {
      UI.toast('Could not build the archive');
    }
  }

  /* ---------------- reviews ---------------- */

  function actWeekReview(weekKey) {
    var key = D.isKey(weekKey)
      ? D.weekStartKey(weekKey, Store.user().weekStart)
      : D.weekStartKey(D.todayKey(), Store.user().weekStart);
    var w = Store.week(key, true);
    var sum = Store.weekSummary(key);
    var existing = w.review || {};
    var doneSeed = (existing.done !== undefined)
      ? existing.done
      : sum.completedText.slice(0, 25).map(function (t) { return '· ' + t; }).join('\n');
    var nextWeek = D.addDays(key, 7);

    UI.openModal({
      title: 'Week in review',
      body: '<div class="review-stats tiny">' +
        '<span><strong>' + sum.tasksDone + '</strong> tasks done of ' + sum.tasksTotal + '</span>' +
        '<span><strong>' + sum.daysPlanned + '</strong>/7 days planned</span>' +
        '<span><strong>' + sum.goalsDone + '</strong>/' + sum.goalsTotal + ' weekly goals</span>' +
        '</div>' +
        '<div class="field" style="margin-top:12px"><label for="rvDone">What actually got done?</label>' +
        '<textarea id="rvDone" style="min-height:74px">' + esc(doneSeed) + '</textarea></div>' +
        '<div class="field" style="margin-top:10px"><label for="rvStuck">What did not happen — still worth doing?</label>' +
        '<textarea id="rvStuck" style="min-height:64px">' + esc(existing.stuck || '') + '</textarea></div>' +
        '<div class="field" style="margin-top:10px"><label for="rvChange">What will you change next week?</label>' +
        '<textarea id="rvChange" style="min-height:64px">' + esc(existing.change || '') + '</textarea></div>' +
        '<div class="field" style="margin-top:10px"><label for="rvFocus">One thing for next week (becomes its focus)</label>' +
        '<input type="text" id="rvFocus" value="' + esc(existing.focusNext || '') + '" placeholder="If only one thing gets done…"></div>',
      actions: [
        { label: 'Cancel', value: null, cls: 'btn-ghost' },
        {
          label: 'Save review', value: 'save', cls: 'btn', onClick: function () {
            w.review = {
              at: Date.now(),
              done: $('rvDone').value.trim(),
              stuck: $('rvStuck').value.trim(),
              change: $('rvChange').value.trim(),
              focusNext: $('rvFocus').value.trim()
            };
            if (w.review.focusNext) {
              var nw = Store.week(nextWeek, true);
              if (!nw.focus) nw.focus = w.review.focusNext;
            }
            Store.saveNow();
            refresh();
            UI.toast(w.review.focusNext ? 'Reviewed · next week’s focus set' : 'Week reviewed');
          }
        }
      ]
    });
  }

  function actDayReview(key) {
    var k = D.isKey(key) ? key : D.todayKey();
    var d = Store.day(k, true);
    var existing = d.review || {};
    UI.openModal({
      title: 'Review ' + (D.relative(k) || D.prettyDay(k)),
      body: '<div class="field"><label for="drWent">What went well?</label>' +
        '<textarea id="drWent" style="min-height:64px">' + esc(existing.went || '') + '</textarea></div>' +
        '<div class="field" style="margin-top:10px"><label for="drDrained">What drained you?</label>' +
        '<textarea id="drDrained" style="min-height:64px">' + esc(existing.drained || '') + '</textarea></div>' +
        '<div class="field" style="margin-top:10px"><label for="drNext">One thing for tomorrow</label>' +
        '<input type="text" id="drNext" value="' + esc(existing.next || '') + '" placeholder="Small enough to actually do"></div>',
      actions: [
        { label: 'Cancel', value: null, cls: 'btn-ghost' },
        {
          label: 'Save', value: 'save', cls: 'btn', onClick: function () {
            var went = $('drWent').value.trim();
            var drained = $('drDrained').value.trim();
            var next = $('drNext').value.trim();
            if (!went && !drained && !next) { UI.toast('Nothing to save yet'); return false; }
            d.review = { at: Date.now(), went: went, drained: drained, next: next };
            if (next) {
              var tomorrow = Store.day(D.addDays(k, 1), true);
              var exists = tomorrow.todos.some(function (t) { return t.text.toLowerCase() === next.toLowerCase(); });
              if (!exists) tomorrow.todos.push({ id: Store.uid(), text: next, done: false });
            }
            Store.saveNow();
            refresh();
            UI.toast(next ? 'Reviewed · added to tomorrow' : 'Day reviewed');
          }
        }
      ]
    });
  }

  /* ---------------- bulk selection ---------------- */

  var selection = { key: null, ids: [] };

  function syncSelection() {
    global.Parts.selectionKey = selection.key;
    global.Parts.selectedIds = selection.ids.slice();
  }

  function selectStart(key) {
    selection = { key: key, ids: [] };
    syncSelection();
    refresh();
  }

  function selectCancel() {
    selection = { key: null, ids: [] };
    syncSelection();
    refresh();
  }

  function selectToggle(el) {
    var id = el.dataset.id;
    if (selection.key !== el.dataset.key) { selection = { key: el.dataset.key, ids: [] }; }
    var at = selection.ids.indexOf(id);
    if (at >= 0) selection.ids.splice(at, 1);
    else selection.ids.push(id);
    syncSelection();
    refresh();
  }

  function selectAll(key) {
    var d = Store.day(key, true);
    selection = { key: key, ids: d.todos.map(function (t) { return t.id; }) };
    syncSelection();
    refresh();
  }

  function bulkDelete() {
    var key = selection.key;
    var ids = selection.ids.slice();
    if (!ids.length) return;
    var d = Store.day(key, true);
    var removed = [];
    d.todos.forEach(function (t, i) { if (ids.indexOf(t.id) >= 0) removed.push({ item: t, index: i }); });
    d.todos = d.todos.filter(function (t) { return ids.indexOf(t.id) < 0; });
    var entry = Store.trashAdd({
      kind: 'items', scope: 'day', key: key, items: removed,
      text: removed.length + ' task' + (removed.length > 1 ? 's' : '')
    });
    selection = { key: null, ids: [] };
    syncSelection();
    Store.saveNow();
    refresh();
    UI.toast('Deleted ' + removed.length + ' task' + (removed.length > 1 ? 's' : ''),
      { action: function () { undoEntry(entry); } });
  }

  function bulkMove() {
    var key = selection.key;
    var ids = selection.ids.slice();
    if (!ids.length) return;
    var suggested = D.addDays(key, 1);
    UI.openModal({
      title: 'Move ' + ids.length + ' task' + (ids.length > 1 ? 's' : ''),
      body: '<div class="field"><label for="bulkDate">To</label>' +
        '<input type="date" id="bulkDate" value="' + suggested + '"></div>' +
        '<p class="tiny dim" style="margin-top:10px">Estimates, times and tags move with the task.</p>',
      actions: [
        { label: 'Cancel', value: null, cls: 'btn-ghost' },
        {
          label: 'Move', value: 'go', cls: 'btn', onClick: function () {
            var to = $('bulkDate').value;
            if (!D.isKey(to)) { UI.toast('Pick a date'); return false; }
            if (to === key) { UI.toast('Pick a different day'); return false; }
            var moved = Store.moveTodos(key, ids, to);
            selection = { key: null, ids: [] };
            syncSelection();
            refresh();
            UI.toast('Moved ' + moved + ' to ' + D.prettyDay(to));
          }
        }
      ]
    });
  }

  /* ---------------- templates ---------------- */

  function templatesModal(dayKey) {
    var list = Store.templates();
    var body = '<div class="stack">' +
      (list.length
        ? list.map(function (tpl) {
          return '<div class="year-item" style="padding:9px 10px">' +
            '<div style="min-width:0"><div class="small strong truncate">' + esc(tpl.name) + '</div>' +
            '<div class="tiny dim">' + tpl.blocks.length + ' blocks · ' + tpl.todos.length + ' tasks</div></div>' +
            '<span class="spacer"></span>' +
            '<button class="btn btn-ghost btn-sm" data-act="template-apply" data-id="' + esc(tpl.id) + '" data-key="' + esc(dayKey) + '">Apply</button>' +
            '<button class="icon-btn flat danger" data-act="template-delete" data-id="' + esc(tpl.id) + '" aria-label="Delete template">' + icon('x') + '</button>' +
            '</div>';
        }).join('')
        : UI.empty('note', 'No templates yet. Build a day once, save it here, reuse it.'));
    body += '</div>' +
      '<div class="field" style="margin-top:14px"><label for="tplName">Save this day as a template</label>' +
      '<input type="text" id="tplName" placeholder="e.g. Clinic day" autocomplete="off"></div>';

    UI.openModal({
      title: 'Templates',
      body: body,
      actions: [
        { label: 'Close', value: null, cls: 'btn-ghost' },
        {
          label: 'Save this day', value: 'save', cls: 'btn', onClick: function () {
            var name = ($('tplName').value || '').trim();
            if (!name) { UI.toast('Give the template a name'); return false; }
            var d = Store.day(dayKey, true);
            if (!d.blocks.length && !d.todos.length) { UI.toast('This day is empty'); return false; }
            Store.addTemplate({
              name: name,
              blocks: d.blocks.map(function (b) { return { start: b.start, end: b.end || '', text: b.text }; }),
              todos: d.todos.filter(function (t) { return !t.recurringId; }).map(function (t) {
                return { text: t.text, prio: !!t.prio, est: t.est || 0, at: t.at || '', tags: (t.tags || []).slice() };
              })
            });
            UI.toast('Template saved');
            setTimeout(function () { templatesModal(dayKey); }, 120);
          }
        }
      ]
    });
  }

  function applyTemplate(id, dayKey) {
    var tpl = Store.templates().filter(function (t) { return t.id === id; })[0];
    if (!tpl) return;
    var d = Store.day(dayKey, true);
    var existing = {};
    d.todos.forEach(function (t) { existing[t.text.toLowerCase()] = 1; });
    var added = 0;
    tpl.blocks.forEach(function (b) {
      d.blocks.push({ id: Store.uid(), start: b.start || '', end: b.end || '', text: b.text || '' });
    });
    tpl.todos.forEach(function (t) {
      if (existing[t.text.toLowerCase()]) return;
      d.todos.push({
        id: Store.uid(), text: t.text, done: false, prio: !!t.prio,
        est: t.est || 0, at: t.at || '', tags: (t.tags || []).slice()
      });
      added++;
    });
    Store.saveNow();
    UI.closeModal(null);
    refresh();
    UI.toast('Applied “' + tpl.name + '”' + (added ? ' · ' + added + ' tasks' : ''));
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
    if (!cur || !next) { UI.toast('Enter the current and the new PIN'); return; }
    UI.toast('Updating…');
    Store.changePin(cur, next).then(function (res) {
      if (!res.ok) { UI.toast(res.error); return; }
      $('curPin').value = '';
      $('newPin').value = '';
      UI.toast('PIN updated');
    }).catch(function () { UI.toast('Could not update the PIN'); });
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
    if (d.review && d.review.at) {
      lines.push('', '## Review');
      if (d.review.went) lines.push('', '**What went well:** ' + d.review.went);
      if (d.review.drained) lines.push('', '**What drained you:** ' + d.review.drained);
      if (d.review.next) lines.push('', '**For tomorrow:** ' + d.review.next);
    }
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
      d.todos.forEach(function (t) {
        out.push('- [' + (t.done ? 'x' : ' ') + '] ' + t.text);
        (t.sub || []).forEach(function (x) { out.push('  - [' + (x.done ? 'x' : ' ') + '] ' + x.text); });
      });
      d.blocks.forEach(function (b) { out.push('- ' + (b.start || '--:--') + ' — ' + (b.text || '')); });
      if (d.notes) out.push('', d.notes);
      if (d.review && d.review.at) {
        out.push('', '**Review**');
        if (d.review.went) out.push('- Went well: ' + d.review.went);
        if (d.review.drained) out.push('- Drained: ' + d.review.drained);
        if (d.review.next) out.push('- For tomorrow: ' + d.review.next);
      }
      out.push('');
    });
    Object.keys(u.weeks).sort().forEach(function (k) {
      var w = u.weeks[k];
      if (!w.focus && !(w.todos || []).length) return;
      out.push('## Week of ' + D.prettyDay(k));
      if (w.focus) out.push('', '**Focus:** ' + w.focus);
      (w.todos || []).forEach(function (t) { out.push('- [' + (t.done ? 'x' : ' ') + '] ' + t.text); });
      if (w.review && w.review.at) {
        out.push('', '**Review**');
        if (w.review.done) out.push('- Got done: ' + w.review.done.replace(/\n/g, ' '));
        if (w.review.stuck) out.push('- Still worth doing: ' + w.review.stuck.replace(/\n/g, ' '));
        if (w.review.change) out.push('- What changes: ' + w.review.change.replace(/\n/g, ' '));
        if (w.review.focusNext) out.push("- Next week's focus: " + w.review.focusNext);
      }
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

  /* ---------------- encrypted backups ---------------- */

  function actExportEncrypted() {
    if (!global.PlannerCrypto || !PlannerCrypto.supported()) {
      UI.toast('This browser cannot encrypt backups');
      return;
    }
    UI.openModal({
      title: 'Encrypted backup',
      body: '<p class="small">Choose a passphrase. It is never stored anywhere — if you lose it, ' +
        'the backup cannot be opened again.</p>' +
        '<div class="field" style="margin-top:12px"><label for="encPass">Passphrase</label>' +
        '<input type="password" id="encPass" autocomplete="new-password" placeholder="at least 6 characters"></div>' +
        '<div class="field" style="margin-top:10px"><label for="encPass2">Repeat it</label>' +
        '<input type="password" id="encPass2" autocomplete="new-password"></div>',
      actions: [
        { label: 'Cancel', value: null, cls: 'btn-ghost' },
        {
          label: 'Encrypt & download', value: 'go', cls: 'btn', onClick: function () {
            var a = $('encPass').value || '';
            var b = $('encPass2').value || '';
            if (a.length < 6) { UI.toast('Use at least 6 characters'); return false; }
            if (a !== b) { UI.toast('The two passphrases differ'); return false; }
            setTimeout(function () { runEncryptedExport(a); }, 80);
          }
        }
      ]
    });
  }

  function runEncryptedExport(passphrase) {
    UI.toast('Encrypting…');
    global.PlannerCrypto.encrypt(Store.state(), passphrase).then(function (envelope) {
      UI.download('planner-backup-' + D.todayKey() + '.planner', JSON.stringify(envelope, null, 2), 'application/json');
      Store.markExported();
      UI.toast('Encrypted backup downloaded');
      refresh();
    }).catch(function (err) {
      UI.toast(err && err.message ? err.message : 'Could not encrypt the backup');
    });
  }

  function actImportEncrypted() {
    var input = $('importEncFile');
    if (input) input.click();
  }

  function handleEncryptedFile(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      var text = ev.target.result;
      e.target.value = '';
      if (!global.PlannerCrypto || !PlannerCrypto.isEnvelope(text)) {
        UI.toast('That file is not an encrypted Planner Pro backup');
        return;
      }
      UI.openModal({
        title: 'Restore encrypted backup',
        body: '<p class="small">Enter the passphrase this backup was made with.</p>' +
          '<div class="field" style="margin-top:12px"><label for="decPass">Passphrase</label>' +
          '<input type="password" id="decPass" autocomplete="current-password"></div>',
        actions: [
          { label: 'Cancel', value: null, cls: 'btn-ghost' },
          {
            label: 'Decrypt', value: 'go', cls: 'btn', onClick: function () {
              var pass = $('decPass').value || '';
              if (!pass) { UI.toast('Enter the passphrase'); return false; }
              setTimeout(function () { runEncryptedImport(text, pass); }, 80);
            }
          }
        ]
      });
    };
    reader.readAsText(file);
  }

  function runEncryptedImport(text, passphrase) {
    UI.toast('Decrypting…');
    global.PlannerCrypto.decrypt(text, passphrase).then(function (data) {
      if (!data || !data.users) { UI.toast('That backup contains no profiles'); return; }
      return UI.confirm({
        title: 'Replace all data?',
        message: 'The decrypted backup will replace every profile and plan on this device.',
        ok: 'Restore', danger: true
      }).then(function (yes) {
        if (!yes) return;
        var res = Store.importJSON(JSON.stringify(data));
        if (!res.ok) { UI.toast(res.error); return; }
        UI.toast('Backup restored');
        showApp();
        refresh();
      });
    }).catch(function (err) {
      UI.toast(err && err.message ? err.message : 'Could not decrypt the backup');
    });
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

  /**
   * "Call the clinic tomorrow 4pm #health" →
   *   { text: 'Call the clinic', dateKey, time: '16:00', tags: ['health'], prio: false }
   */
  function parseQuickAdd(raw) {
    var text = String(raw || '');
    var tags = [];
    var prio = false;

    text = text.replace(/#([\w-]+)/g, function (m, tag) { tags.push(tag); return ' '; });
    if (/!!/.test(text)) prio = true;
    text = text.replace(/!!/g, ' ');

    var time = null;
    var withMeridiem = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (withMeridiem) {
      var hour = Number(withMeridiem[1]) % 12;
      if (/pm/i.test(withMeridiem[3])) hour += 12;
      time = D.pad(hour) + ':' + (withMeridiem[2] || '00');
      text = text.replace(withMeridiem[0], ' ');
    } else {
      var clock = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
      if (clock) {
        time = D.pad(Number(clock[1])) + ':' + clock[2];
        text = text.replace(clock[0], ' ');
      }
    }

    var est = 0;
    var span;
    if ((span = text.match(/\b(\d{1,2})\s*(?:h|hr|hrs|hour|hours)\b/i))) {
      est += Number(span[1]) * 60;
      text = text.replace(span[0], ' ');
    }
    if ((span = text.match(/\b(\d{1,3})\s*(?:m|min|mins|minute|minutes)\b/i))) {
      est += Number(span[1]);
      text = text.replace(span[0], ' ');
    }

    var dateKey = null;
    var lower = text.toLowerCase();
    var weekday = lower.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/);
    if (weekday) {
      var parsed = parseDateQuery(weekday[0].trim());
      if (parsed) { dateKey = parsed; text = text.slice(0, weekday.index) + text.slice(weekday.index + weekday[0].length); }
    }
    if (!dateKey) {
      var words = ['today', 'tomorrow', 'yesterday'];
      for (var i = 0; i < words.length; i++) {
        var at = text.toLowerCase().indexOf(words[i]);
        if (at >= 0) {
          dateKey = parseDateQuery(words[i]);
          text = text.slice(0, at) + text.slice(at + words[i].length);
          break;
        }
      }
    }
    if (!dateKey) {
      var dayMonth = text.toLowerCase().match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/) ||
        text.toLowerCase().match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/);
      if (dayMonth) {
        var parsed2 = parseDateQuery(dayMonth[0]);
        if (parsed2) { dateKey = parsed2; text = text.slice(0, dayMonth.index) + text.slice(dayMonth.index + dayMonth[0].length); }
      }
    }

    return {
      text: text.replace(/\s+/g, ' ').trim(),
      dateKey: dateKey, time: time, tags: tags, prio: prio, est: est
    };
  }

  function quickAddPreview(raw) {
    var box = $('qaPreview');
    if (!box) return;
    var parsed = parseQuickAdd(raw);
    if (!parsed.text && !parsed.dateKey && !parsed.time) {
      box.className = 'tiny dim';
      box.textContent = 'Type a date, a time or #tag — they are picked out automatically.';
      return;
    }
    var bits = [];
    if (parsed.dateKey) bits.push('<span class="pill">' + esc(D.relative(parsed.dateKey) || D.prettyDay(parsed.dateKey)) + '</span>');
    if (parsed.time) bits.push('<span class="pill pill-time">' + esc(parsed.time) + '</span>');
    parsed.tags.forEach(function (t) { bits.push('<span class="pill pill-tag">#' + esc(t) + '</span>'); });
    if (parsed.est) bits.push('<span class="pill pill-est">' + esc(UI.duration(parsed.est)) + '</span>');
    if (parsed.prio) bits.push('<span class="pill pill-warn">priority</span>');
    box.className = 'tiny';
    box.innerHTML = '<span class="dim">Saves as:</span> ' + esc(parsed.text || '—') +
      (bits.length ? ' ' + bits.join(' ') : '');
  }

  function quickAddModal(prefill) {
    var tk = D.todayKey();
    UI.openModal({
      title: 'Quick add',
      body: '<div class="field"><label for="qaText">Task</label>' +
        '<input type="text" id="qaText" placeholder="Call the clinic tomorrow 4pm #health" autocomplete="off" ' +
        'value="' + esc(prefill || '') + '"></div>' +
        '<div id="qaPreview" class="tiny dim" style="margin-top:8px">' +
        'Type a date, a time or #tag — they are picked out automatically.</div>' +
        '<div class="field" style="margin-top:12px"><label for="qaDate">Day (overrides the text)</label>' +
        '<input type="date" id="qaDate" value=""></div>' +
        '<div class="field" style="margin-top:12px"><label for="qaRepeat">Repeat</label>' +
        '<select id="qaRepeat">' +
        '<option value="none">Does not repeat</option>' +
        '<option value="daily">Every day</option>' +
        '<option value="weekdays">Weekdays (Mon–Fri)</option>' +
        '<option value="weekly">Every ' + D.DAYS[D.weekday(D.todayKey())] + '</option>' +
        '</select></div>' +
        '<label style="display:flex;gap:9px;align-items:center;margin-top:10px;cursor:pointer">' +
        '<input type="checkbox" id="qaPrio"><span class="small">Mark as priority</span></label>',
      actions: [
        { label: 'Cancel', value: null, cls: 'btn-ghost' },
        {
          label: 'Add task', value: 'add', cls: 'btn', onClick: function () {
            var raw = ($('qaText').value || '').trim();
            if (!raw) { UI.toast('Type a task first'); return false; }
            var parsed = parseQuickAdd(raw);
            var key = ($('qaDate').value || parsed.dateKey || tk);
            var todo = {
              id: Store.uid(),
              text: parsed.text || raw,
              done: false,
              prio: $('qaPrio').checked || parsed.prio
            };
            if (parsed.time) todo.at = parsed.time;
            if (parsed.tags.length) todo.tags = parsed.tags;
            if (parsed.est) todo.est = parsed.est;

            var repeat = ($('qaRepeat') || {}).value || 'none';
            if (repeat !== 'none') {
              var rule = Store.addRecurring({
                text: todo.text,
                repeat: repeat === 'weekly' ? 'custom' : repeat,
                days: repeat === 'weekly' ? [D.weekday(key)] : [],
                prio: todo.prio, at: todo.at || '', tags: todo.tags || [],
                est: todo.est || 0, from: D.addDays(key, 1)
              });
              if (rule) todo.recurringId = rule.id;
            }

            Store.day(key, true).todos.push(todo);
            Store.saveNow();
            var bits = [D.relative(key) || D.prettyDay(key)];
            if (parsed.time) bits.push('at ' + parsed.time);
            if (parsed.est) bits.push(UI.duration(parsed.est));
            if (parsed.tags.length) bits.push(parsed.tags.map(function (t) { return '#' + t; }).join(' '));
            if (repeat !== 'none') bits.push('repeats ' + repeat);
            UI.toast('Added to ' + bits.join(' · '));
            refresh();
          }
        }
      ],
      onMount: function (body) {
        var input = body.querySelector('input');
        input.addEventListener('input', function () { quickAddPreview(input.value); });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); var b = document.querySelectorAll('#modalActions .btn'); b[b.length - 1].click(); }
        });
      }
    });
  }

  /* ---------------- copy another day into this one ---------------- */

  function actDuplicateDay(targetKey) {
    var suggested = D.addDays(targetKey, -1);
    UI.openModal({
      title: 'Copy a day',
      body: '<div class="field"><label for="dupDate">Copy from</label>' +
        '<input type="date" id="dupDate" value="' + suggested + '"></div>' +
        '<label style="display:flex;gap:9px;align-items:center;margin-top:12px;cursor:pointer">' +
        '<input type="checkbox" id="dupBlocks" checked><span class="small">Time blocks</span></label>' +
        '<label style="display:flex;gap:9px;align-items:center;margin-top:6px;cursor:pointer">' +
        '<input type="checkbox" id="dupTasks" checked><span class="small">Tasks (added unchecked)</span></label>' +
        '<label style="display:flex;gap:9px;align-items:center;margin-top:6px;cursor:pointer">' +
        '<input type="checkbox" id="dupIntention"><span class="small">Intention line</span></label>' +
        '<p class="tiny dim" style="margin-top:10px">Only into ' + esc(D.prettyDay(targetKey)) + '. Existing items are kept.</p>',
      actions: [
        { label: 'Cancel', value: null, cls: 'btn-ghost' },
        {
          label: 'Copy', value: 'copy', cls: 'btn', onClick: function () {
            var from = $('dupDate').value;
            if (!D.isKey(from)) { UI.toast('Pick a date to copy from'); return false; }
            if (from === targetKey) { UI.toast('Pick a different day'); return false; }
            var src = Store.peekDay(from);
            if (!src) { UI.toast('That day is empty'); return false; }

            var dst = Store.day(targetKey, true);
            var existing = {};
            dst.todos.forEach(function (t) { existing[t.text.toLowerCase()] = 1; });
            var added = 0;

            if ($('dupBlocks').checked) {
              (src.blocks || []).forEach(function (b) {
                dst.blocks.push({ id: Store.uid(), start: b.start, end: b.end || '', text: b.text });
              });
            }
            if ($('dupTasks').checked) {
              (src.todos || []).forEach(function (t) {
                if (existing[t.text.toLowerCase()]) return;
                dst.todos.push({
                  id: Store.uid(), text: t.text, done: false, prio: !!t.prio,
                  at: t.at || '', tags: (t.tags || []).slice()
                });
                added++;
              });
            }
            if ($('dupIntention').checked && src.intention && !dst.intention) {
              dst.intention = src.intention;
            }
            Store.saveNow();
            refresh();
            UI.toast('Copied from ' + D.prettyDay(from));
          }
        }
      ]
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
      { label: 'Go to Insights', hint: 'I', icon: 'chart', run: function () { actGo('#/insights/' + new Date().getFullYear()); } },
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

    /* ---- swipe between days ---- */
    document.addEventListener('pointerdown', onSwipeStart);
    document.addEventListener('pointerup', onSwipeEnd);

    /* ---- drag handle ---- */
    document.addEventListener('pointerdown', function (e) {
      var handle = e.target.closest ? e.target.closest('[data-act="drag-start"]') : null;
      if (handle) beginDrag(e, handle);
    });

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
        case 'lock': Store.lock(); stopFocus(); showLock(); break;
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
        case 'export-encrypted': actExportEncrypted(); break;
        case 'import-encrypted': actImportEncrypted(); break;
        case 'import-db': actImportDb(); break;
        case 'export-md': UI.download('planner-export-' + D.todayKey() + '.md', allMarkdown(), 'text/markdown;charset=utf-8'); UI.toast('Markdown exported'); break;
        case 'export-day': actExportDay(ds.key); break;
        case 'export-ics': actExportIcs(ds.days); break;
        case 'dismiss-backup': Store.snoozeBackup(3); refresh(); UI.toast('We will remind you in 3 days'); break;
        case 'trash-restore': actTrashRestore(ds.id); break;
        case 'trash-delete': actTrashDelete(ds.id); break;
        case 'trash-empty': actTrashEmpty(); break;
        case 'duplicate-day': actDuplicateDay(ds.key); break;
        case 'cal-prev': calShift(-1); break;
        case 'cal-next': calShift(1); break;
        case 'cal-day': actGo('#/day/' + ds.key); break;
        case 'row-expand': actRowExpand(el); break;
        case 'sub-toggle': actSubToggle(el); break;
        case 'sub-del': actSubDel(el); break;
        case 'data-health': actHealth(); break;
        case 'import-csv': actImportCsv(); break;
        case 'focus-start': startFocus(ds.minutes || 25, currentBlockLabel(ds.key)); break;
        case 'focus-pause': pauseFocus(); break;
        case 'focus-stop': stopFocus(); break;
        case 'export-vault': actExportVault(); break;
        case 'week-review': actWeekReview(ds.key); break;
        case 'day-review': actDayReview(ds.key); break;
        case 'dismiss-review': Store.snoozeReview(); refresh(); UI.toast('Hidden until tomorrow'); break;
        case 'select-start': selectStart(ds.key); break;
        case 'select-cancel': selectCancel(); break;
        case 'select-toggle': selectToggle(el); break;
        case 'select-all': selectAll(ds.key); break;
        case 'bulk-delete': bulkDelete(); break;
        case 'bulk-move': bulkMove(); break;
        case 'todo-details': actTodoDetails(el); break;
        case 'filter-tag': actGo('#/search/' + encodeURIComponent(ds.tag)); break;
        case 'templates': templatesModal(ds.key || D.todayKey()); break;
        case 'template-apply': applyTemplate(ds.id, ds.key); break;
        case 'template-delete':
          Store.removeTemplate(ds.id);
          UI.toast('Template deleted');
          templatesModal(currentParam || D.todayKey());
          break;
        case 'recurring-toggle': Store.toggleRecurring(ds.id); refresh(); break;
        case 'recurring-delete':
          Store.removeRecurring(ds.id);
          refresh();
          UI.toast('Repeating task removed');
          break;
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
      if (form.dataset.form === 'add-sub') { addSub(form); return; }
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
      if (t.dataset && t.dataset.file === 'import-encrypted') { handleEncryptedFile(e); return; }
      if (!b) return;

      if (b === 'day-date') { actGo('#/day/' + (t.value || D.todayKey())); return; }
      if (b === 'theme') { Store.setTheme(t.value); applyTheme(); refresh(); UI.toast('Theme updated'); return; }
      if (b === 'week-start') { Store.user().weekStart = Number(t.value); Store.saveNow(); refresh(); return; }
      if (b === 'auto-archive') { Store.user().settings.autoArchive = t.checked; Store.saveNow(); return; }
      if (b === 'capacity') { Store.setCapacity(t.value); refresh(); return; }
      if (b === 'review-day') { Store.setReviewDay(Number(t.value)); refresh(); return; }
      if (b === 'require-pin') { Store.user().settings.requirePin = t.checked; Store.saveNow(); return; }
      if (b === 'panic-blur') {
        Store.user().settings.panicBlur = t.checked;
        Store.saveNow();
        applyPanic(windowFocused);
        return;
      }
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

        // task-list cursor
        if (k === 'j') { e.preventDefault(); setCursor(cursor + 1); return; }
        if (k === 'k') { e.preventDefault(); setCursor(cursor < 0 ? 0 : cursor - 1); return; }
        if (k === 'x') {
          var rowToggle = cursorRow();
          if (rowToggle) { e.preventDefault(); rowToggle.querySelector('.check').click(); }
          return;
        }
        if (k === 'e') {
          var rowEdit = cursorRow();
          if (rowEdit) { e.preventDefault(); var txt = rowEdit.querySelector('.row-text'); if (txt) txt.click(); }
          return;
        }
        if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          var rowMove = cursorRow();
          if (rowMove) { e.preventDefault(); moveRow(rowMove, e.key === 'ArrowUp' ? -1 : 1); }
          return;
        }
        if (k === 't') { actGo('#/today'); return; }
        if (k === 'd') { actGo('#/day/' + D.todayKey()); return; }
        if (k === 'w') { actGo('#/week/' + D.weekStartKey(D.todayKey(), Store.user().weekStart)); return; }
        if (k === 'y') { actGo('#/year/' + new Date().getFullYear()); return; }
        if (k === 'a') { actGo('#/archive'); return; }
        if (k === 'i') { actGo('#/insights/' + new Date().getFullYear()); return; }
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
    window.addEventListener('blur', function () { applyPanic(false); });
    window.addEventListener('focus', function () { applyPanic(true); });
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
  global.PlannerDebug = {
    icsFor: icsFor, parseDateQuery: parseDateQuery, icsEsc: icsEsc,
    parseQuickAdd: parseQuickAdd, moveRow: moveRow,
    vaultFiles: vaultFiles, startFocus: startFocus, stopFocus: stopFocus, parseCsv: parseCsv,
    readShare: readShare, openQuickAdd: quickAddModal,
    focusState: function () { return focus; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
