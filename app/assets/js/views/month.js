/* Planner Pro — Month view: the whole month as a grid of days. */
(function (global) {
  'use strict';
  var esc = UI.esc, icon = UI.icon, D = global.DateUtil;
  global.Views = global.Views || {};

  function monthOf(p) {
    return /^\d{4}-\d{2}$/.test(String(p || '')) ? String(p) : D.monthKey(D.todayKey());
  }

  global.Views.month = {
    title: 'Month',
    subtitle: function (p) { return 'The month as a grid'; },

    render: function (p) {
      var u = Store.user();
      var mk = monthOf(p);
      var year = Number(mk.slice(0, 4));
      var month = Number(mk.slice(5, 7)) - 1;
      var ws = u.weekStart === 0 ? 0 : 1;
      var today = D.todayKey();
      var thisMonth = D.monthKey(today);
      var m = Store.month(mk, true);

      var first = new Date(year, month, 1);
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var lead = (first.getDay() - ws + 7) % 7;

      var prev = new Date(year, month - 1, 1);
      var next = new Date(year, month + 1, 1);
      var prevKey = prev.getFullYear() + '-' + D.pad(prev.getMonth() + 1);
      var nextKey = next.getFullYear() + '-' + D.pad(next.getMonth() + 1);

      var total = 0, done = 0;
      var h = '';

      /* header */
      h += '<div class="datebar">' +
        '<button class="icon-btn" data-act="go" data-href="#/month/' + prevKey + '" aria-label="Previous month">' + icon('left') + '</button>' +
        '<strong style="padding:0 6px;font-size:15px">' + esc(D.MONTHS[month]) + ' ' + year + '</strong>' +
        '<button class="icon-btn" data-act="go" data-href="#/month/' + nextKey + '" aria-label="Next month">' + icon('right') + '</button>' +
        (mk === thisMonth ? '<span class="pill pill-ok">This month</span>' :
          '<button class="btn btn-ghost btn-sm" data-act="go" data-href="#/month/' + thisMonth + '">This month</button>') +
        '<span class="spacer"></span>' +
        '<button class="btn btn-ghost btn-sm" data-act="print">' + icon('print') + '<span class="btn-label">Print</span></button>' +
        '</div>';

      /* focus line */
      if (m.focus) {
        h += '<div class="card card-pad"><span class="eyebrow">Focus of the month</span>' +
          '<p class="small" style="margin-top:4px">' + esc(m.focus) + '</p></div>';
      }

      /* grid */
      h += '<div class="card month-card">';
      h += '<div class="mcal-dows">';
      D.DAYS_SHORT.forEach(function (name, i) {
        var idx = (i + ws) % 7;
        h += '<span class="month-dow">' + esc(D.DAYS_SHORT[idx].slice(0, 3)) + '</span>';
      });
      h += '</div><div class="mcal-grid">';
      for (var i = 0; i < lead; i++) h += '<span class="mcell is-pad"></span>';

      for (var day = 1; day <= daysInMonth; day++) {
        var key = year + '-' + D.pad(month + 1) + '-' + D.pad(day);
        var d = Store.peekDay(key);
        var todos = (d && d.todos) || [];
        var blocks = (d && d.blocks) || [];
        var dDone = todos.filter(function (t) { return t.done; }).length;
        total += todos.length;
        done += dDone;

        var cls = 'mcell';
        if (key === today) cls += ' is-today';
        if (d && d.intention) cls += ' has-intention';

        h += '<button class="' + cls + '" data-act="go" data-href="#/day/' + key + '" ' +
          'aria-label="' + esc(D.prettyDay(key)) + '">' +
          '<span class="mcell-num">' + day + (blocks.length ? '<i class="mcell-block"></i>' : '') + '</span>' +
          (todos.length
            ? '<span class="mcell-list">' + todos.slice(0, 3).map(function (t) {
              return '<span class="mcell-task' + (t.done ? ' done' : '') + '">' + esc(t.text) + '</span>';
            }).join('') +
              (todos.length > 3 ? '<span class="mcell-more">+' + (todos.length - 3) + ' more</span>' : '') + '</span>'
            : '') +
          (todos.length ? '<span class="mcell-count">' + dDone + '/' + todos.length + '</span>' : '') +
          '</button>';
      }
      h += '</div></div>';

      h += '<div class="card card-pad"><div class="insight-foot">' +
        '<span class="tiny dim">' + done + ' of ' + total + ' tasks done in ' +
        esc(D.MONTHS[month]) + (total ? ' · ' + Math.round(done / total * 100) + '%' : '') + '</span>' +
        '<span class="insight-foot-actions">' +
        '<button class="btn btn-ghost btn-sm" data-act="go" data-href="#/year/' + year + '">' + icon('year') + 'Year goals</button>' +
        '<button class="btn btn-quiet btn-sm" data-act="go" data-href="#/insights/' + year + '">' + icon('chart') + 'Insights</button>' +
        '</span></div></div>';

      return h;
    }
  };
})(window);
