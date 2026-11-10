/* Planner Pro — UI primitives: escape, toast, modal, download, small renderers */
(function (global) {
  'use strict';

  var toastEl = null;
  var toastTimer = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function icon(name, cls) {
    return '<svg class="i ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  }

  function toast(msg) {
    if (!toastEl) toastEl = document.getElementById('toast');
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/);
    return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  /* ---------------- modal ---------------- */
  var modalEl, modalTitle, modalBody, modalActions;
  var modalResolve = null;

  function initModal() {
    modalEl = document.getElementById('modal');
    modalTitle = document.getElementById('modalTitle');
    modalBody = document.getElementById('modalBody');
    modalActions = document.getElementById('modalActions');
    modalEl.addEventListener('mousedown', function (e) {
      if (e.target === modalEl) closeModal(null);
    });
  }

  function closeModal(value) {
    if (!modalEl || modalEl.hidden) return;
    modalEl.hidden = true;
    var r = modalResolve;
    modalResolve = null;
    if (r) r(value);
  }

  /**
   * openModal({title, body, actions:[{label, value, cls}], onMount})
   * Resolves with the clicked action's value (or null when dismissed).
   */
  function openModal(opts) {
    if (!modalEl) initModal();
    opts = opts || {};
    modalTitle.textContent = opts.title || '';
    modalBody.innerHTML = opts.body || '';
    modalActions.innerHTML = '';
    (opts.actions || [{ label: 'Close', value: null, cls: 'btn-ghost' }]).forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'btn ' + (a.cls || 'btn-ghost');
      b.textContent = a.label;
      b.type = 'button';
      b.addEventListener('click', function () {
        if (typeof a.onClick === 'function') {
          var res = a.onClick();
          if (res === false) return;
        }
        closeModal(a.value === undefined ? a.label : a.value);
      });
      modalActions.appendChild(b);
    });
    modalEl.hidden = false;
    if (typeof opts.onMount === 'function') opts.onMount(modalBody);
    var first = modalBody.querySelector('input, textarea, select') || modalActions.querySelector('button');
    if (first) setTimeout(function () { first.focus(); }, 30);
    return new Promise(function (resolve) { modalResolve = resolve; });
  }

  function confirm(opts) {
    return openModal({
      title: opts.title || 'Are you sure?',
      body: '<p>' + esc(opts.message || '') + '</p>',
      actions: [
        { label: opts.cancel || 'Cancel', value: false, cls: 'btn-ghost' },
        { label: opts.ok || 'Confirm', value: true, cls: opts.danger ? 'btn-danger' : 'btn' }
      ]
    });
  }

  /* ---------------- downloads ---------------- */
  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);   // Firefox needs the node in the document
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 500);
  }

  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  /* ---------------- small renderers ---------------- */
  function ring(pct, label) {
    var p = Math.max(0, Math.min(100, Math.round(pct)));
    return '<div class="ring" style="--p:' + p + '" role="img" aria-label="' + p + '% complete">' +
      '<b>' + (label != null ? esc(label) : p + '%') + '</b></div>';
  }

  function bars(items) {
    var max = 1;
    items.forEach(function (i) { if (i.stats.total > max) max = i.stats.total; });
    return '<div class="bars">' + items.map(function (i) {
      var h = i.stats.total ? Math.max(6, Math.round(i.stats.done / max * 100)) : 0;
      var cls = i.stats.total && i.stats.done === i.stats.total ? ' full' : '';
      return '<div class="bar' + (i.today ? ' today' : '') + '" title="' + esc(global.DateUtil.shortDay(i.key)) +
        ': ' + i.stats.done + '/' + i.stats.total + ' done">' +
        '<div class="bar-track"><div class="bar-fill' + cls + '" style="height:' + h + '%"></div></div>' +
        '<span>' + esc(global.DateUtil.fromKey(i.key).getDate()) + '</span></div>';
    }).join('') + '</div>';
  }

  function highlight(text, q) {
    var safe = esc(text);
    if (!q) return safe;
    var needle = esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      return safe.replace(new RegExp('(' + needle + ')', 'ig'), '<mark>$1</mark>');
    } catch (e) { return safe; }
  }

  function empty(iconName, text) {
    return '<div class="empty">' + icon(iconName) + '<p>' + esc(text) + '</p></div>';
  }

  global.UI = {
    esc: esc, icon: icon, toast: toast, initials: initials,
    openModal: openModal, closeModal: closeModal, confirm: confirm, initModal: initModal,
    download: download, fmtBytes: fmtBytes, ring: ring, bars: bars,
    highlight: highlight, empty: empty
  };
})(window);
