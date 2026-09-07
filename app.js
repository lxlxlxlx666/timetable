// app.js — 李翔课表 PWA 主逻辑
(function () {
  'use strict';
  const C = window.TimetableCore;

  const LS_SETTINGS = 'lixi.timetable.settings.v1';
  const LS_TEACHER = 'lixi.timetable.teacherFix.v1';

  let data = null;            // courses.json
  let settings = null;        // {week1Date, totalWeeks}
  let teacherFix = {};        // key -> 校对后的教师名
  let displayWeek = 1;        // 当前显示的周
  let autoWeek = 0;           // 今天是第几周
  let today = null;           // 今天本地日期
  let selectedCourse = null;

  const $ = (id) => document.getElementById(id);

  // ---------- 存储 ----------
  function defaultSettings() {
    return { week1Date: '2026-09-07', totalWeeks: 20 };
  }
  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(LS_SETTINGS)) || {};
      return { ...defaultSettings(), ...s };
    } catch { return defaultSettings(); }
  }
  function saveSettings() {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
  }
  function loadTeacherFix() {
    try { teacherFix = JSON.parse(localStorage.getItem(LS_TEACHER)) || {}; } catch { teacherFix = {}; }
  }
  function courseKey(c) { return `${c.day}|${c.secFrom}-${c.secTo}|${c.name}|${c.type}`; }
  function teacherName(c) {
    const k = courseKey(c);
    return (k in teacherFix && teacherFix[k]) ? teacherFix[k] : (c.teacher || '');
  }
  // 某节次的作息时间（来自 meta.periods，可能缺失）
  function getPeriod(sec) {
    const ps = (data && data.meta && data.meta.periods) || [];
    return ps.find(p => p.sec === sec) || null;
  }
  // 课程节次区间对应的起止时间，如 1-2 → "8:00-9:40"
  function timeRange(from, to) {
    const s = getPeriod(from), e = getPeriod(to);
    if (!s || !e) return '';
    return `${s.start}-${e.end}`;
  }

  // ---------- 数据加载 ----------
  function load() {
    return fetch('./data.json', { cache: 'no-cache' })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(j => { data = j; });
  }

  // ---------- 渲染 ----------
  const TYPE_MEAN = { '★': '讲课', '○': '实验', '●': '实践', '◇': '上机', '◆': '讨论' };

  function renderHeader() {
    $('titleName').textContent = (data.meta.student || '') + '课表';
    $('semester').textContent = data.meta.semester || '';
  }

  function renderStatus() {
    const w1 = C.parseDate(settings.week1Date);
    const auto = autoWeek;
    $('curWeek').textContent = `第${displayWeek}周`;
    $('weekTotal').textContent = `/ ${settings.totalWeeks} 周`;
    const rng = C.weekRange(settings.week1Date, displayWeek);
    $('dateRange').textContent = rng
      ? `${rng.mon.getMonth() + 1}月${rng.mon.getDate()}日 – ${rng.sun.getMonth() + 1}月${rng.sun.getDate()}日`
      : '';
    // 状态条
    const st = $('todayStatus');
    if (auto < 1) {
      const left = w1 ? Math.ceil((w1 - today) / 86400000) : 0;
      st.textContent = left > 0 ? `距离开学还有 ${left} 天（${settings.week1Date}）` : '本学期尚未开始';
    } else {
      const d = C.DAY_CN[today.getDay()];
      const same = displayWeek === auto;
      st.textContent = `今天 ${today.getMonth() + 1}月${today.getDate()}日 星期${d} · 第${auto}周` +
        (same ? '' : `（正在查看第${displayWeek}周）`);
    }
    $('backToday').classList.toggle('hidden', !(auto >= 1 && displayWeek !== auto));
  }

  function colDate(dayIdx) {
    const rng = C.weekRange(settings.week1Date, displayWeek);
    if (!rng) return null;
    const d = new Date(rng.mon);
    d.setDate(d.getDate() + dayIdx);
    return d;
  }

  function buildLegend() {
    const lg = data.meta.legend || '';
    $('legend').innerHTML = '';
    // 从 meta.legend "★: 讲课 ○: 实验 …" 生成色点
    const pairs = lg.split(/\s+/).filter(Boolean);
    for (const p of pairs) {
      const m = p.match(/^([★○●◇◆])\s*[:：]\s*(.+)$/);
      if (!m) continue;
      const span = document.createElement('span');
      span.className = 'lg';
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = typeColor(m[1]);
      span.appendChild(dot);
      span.appendChild(document.createTextNode(`${m[1]} ${m[2]}`));
      $('legend').appendChild(span);
    }
    if (!$('legend').children.length) {
      for (const [t, mean] of Object.entries(TYPE_MEAN)) {
        const span = document.createElement('span');
        span.className = 'lg';
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = typeColor(t);
        span.appendChild(dot);
        span.appendChild(document.createTextNode(`${t} ${mean}`));
        $('legend').appendChild(span);
      }
    }
  }

  function typeColor(t) {
    switch (t) {
      case '★': return '#2563eb';
      case '○': return '#ea580c';
      case '●': return '#059669';
      case '◇': return '#7c3aed';
      case '◆': return '#0d9488';
      default: return '#64748b';
    }
  }

  function renderGrid() {
    const grid = $('grid');
    grid.innerHTML = '';
    const rows = Math.max(13, ...data.courses.map(c => c.secTo || 0));
    const isAutoWeek = autoWeek >= 1 && displayWeek === autoWeek;
    const todayIdx = (today.getDay() + 6) % 7; // 周一=0

    // 时间轴列
    const timeCol = document.createElement('div');
    timeCol.className = 'col timecol';
    // 表头占位，与星期列表头同高（保持各行对齐）
    const ph = document.createElement('div');
    ph.className = 'colhead timehead';
    timeCol.appendChild(ph);
    const tb = document.createElement('div');
    tb.className = 'colbody';
    tb.style.setProperty('--rows', rows);
    for (let i = 1; i <= rows; i++) {
      const n = document.createElement('div');
      n.className = 'secnum';
      n.style.top = ((i - 1) * 46) + 'px';
      const sn = document.createElement('b');
      sn.className = 'snum';
      sn.textContent = i;
      n.appendChild(sn);
      const p = getPeriod(i);
      if (p) {
        const st = document.createElement('span');
        st.className = 'stime';
        st.textContent = p.start;
        n.appendChild(st);
      }
      tb.appendChild(n);
    }
    timeCol.appendChild(tb);
    grid.appendChild(timeCol);

    // 星期列
    for (let d = 0; d < 7; d++) {
      const col = document.createElement('div');
      col.className = 'col' + (isAutoWeek && d === todayIdx ? ' today' : '');
      const head = document.createElement('div');
      head.className = 'colhead';
      const b = document.createElement('b');
      b.textContent = data.meta.periodNames[d];
      head.appendChild(b);
      const dt = colDate(d);
      if (dt) {
        const s = document.createElement('span');
        s.className = 'dt';
        s.textContent = `${dt.getMonth() + 1}/${dt.getDate()}`;
        head.appendChild(s);
      }
      col.appendChild(head);

      const body = document.createElement('div');
      body.className = 'colbody';
      body.style.setProperty('--rows', rows);
      const dayCourses = data.courses
        .filter(c => c.day === d && C.inWeek(c.weekRule, displayWeek))
        .sort((a, b) => (a.secFrom || 0) - (b.secFrom || 0));

      if (!dayCourses.length) {
        const e = document.createElement('div');
        e.className = 'empty-day';
        e.textContent = '无课';
        body.appendChild(e);
      }
      for (const c of dayCourses) {
        const from = c.secFrom || 1;
        const to = Math.max(from, c.secTo || from);
        const card = document.createElement('div');
        card.className = 'course' + ((to - from + 1) <= 2 ? ' compact' : '');
        card.dataset.type = c.type || '';
        card.style.top = ((from - 1) * 46 + 3) + 'px';
        card.style.height = ((to - from + 1) * 46 - 6) + 'px';
        card.setAttribute('role', 'button');
        card.tabIndex = 0;

        const secl = document.createElement('div');
        secl.className = 'cseclabel';
        secl.textContent = `第${from}-${to}节`;
        const tr = timeRange(from, to);
        if (tr) secl.textContent += ` · ${tr}`;
        card.appendChild(secl);

        const nm = document.createElement('div');
        nm.className = 'cname';
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = c.type || '·';
        nm.appendChild(badge);
        nm.appendChild(document.createTextNode(c.name));
        card.appendChild(nm);

        if (c.location) {
          const loc = document.createElement('div');
          loc.className = 'cloc';
          loc.textContent = c.location;
          card.appendChild(loc);
        }
        const tn = teacherName(c);
        if (tn) {
          const tc = document.createElement('div');
          tc.className = 'cteacher';
          tc.textContent = tn;
          card.appendChild(tc);
        }
        if (c.weekText) {
          const wh = document.createElement('div');
          wh.className = 'weekhint';
          wh.textContent = c.weekText;
          card.appendChild(wh);
        }

        card.addEventListener('click', () => openDetail(c));
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter') openDetail(c); });
        body.appendChild(card);
      }
      col.appendChild(body);
      grid.appendChild(col);
    }

    // 空周提示 + 集中周提示
    const anyShown = data.courses.some(c => C.inWeek(c.weekRule, displayWeek));
    const hints = [];
    if (!anyShown) hints.push('本周没有排课（考试周 / 机动周可能为空）。');
    const specials = data.courses.filter(c => c.weekRule && c.weekRule.from === c.weekRule.to && c.weekRule.from !== displayWeek);
    if (specials.length) {
      const names = [...new Set(specials.map(c => `${c.name}${c.type}`))].join('、');
      const weeks = [...new Set(specials.map(c => c.weekRule.from))].join('、');
      hints.push(`注意：${names} 为集中周课程，仅在对应周（第${weeks}周）出现，切到该周即可查看。`);
    }
    $('hint').textContent = hints.join('');
  }

  // ---------- 详情 ----------
  function openDetail(c) {
    selectedCourse = c;
    $('dName').textContent = `${c.name}${c.type ? '（' + (TYPE_MEAN[c.type] || c.type) + '）' : ''}`;
    const meta = $('dMeta');
    meta.innerHTML = '';
    const chips = [
      data.meta.periodNames[c.day] + ' 第' + (c.secFrom || '?') + '-' + (c.secTo || '?') + '节',
      timeRange(c.secFrom, c.secTo) || null,
      c.weekText || C.weekTextOf(c.weekRule) || '每周',
    ].filter(Boolean);
    for (const t of chips) {
      const s = document.createElement('span');
      s.className = 'chips';
      s.textContent = t;
      meta.appendChild(s);
    }
    const tn = teacherName(c);
    $('dTeacher').textContent = tn || '（未知，可点击校对）';
    $('dTeacher').dataset.raw = c.teacherRaw || c.teacher || '';
    $('dLoc').textContent = c.location || '—';
    $('dCampus').textContent = c.campus || '—';
    $('dRaw').textContent = c.detail || '';
    $('detailOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeDetail() {
    $('detailOverlay').classList.add('hidden');
    document.body.style.overflow = '';
    selectedCourse = null;
  }

  function beginEditTeacher() {
    const c = selectedCourse;
    if (!c) return;
    const el = $('dTeacher');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'frow';
    input.style.display = 'inline-block';
    input.style.width = 'auto';
    input.style.margin = '0 6px 0 0';
    input.style.padding = '4px 8px';
    input.value = teacherName(c) || '';
    input.placeholder = '输入正确教师名';
    el.replaceWith(input);
    input.focus();
    input.select();
    const done = () => {
      const fix = input.value.trim();
      teacherFix[courseKey(c)] = fix;
      localStorage.setItem(LS_TEACHER, JSON.stringify(teacherFix));
      const span = document.createElement('span');
      span.id = 'dTeacher';
      span.textContent = fix || '（未知，可点击校对）';
      span.dataset.raw = c.teacherRaw || '';
      input.replaceWith(span);
      $('editTeacher').classList.remove('hidden');
      renderGrid(); // 刷新卡片上的教师名
    };
    const cancel = () => {
      const span = document.createElement('span');
      span.id = 'dTeacher';
      span.textContent = teacherName(c) || '（未知，可点击校对）';
      span.dataset.raw = c.teacherRaw || '';
      input.replaceWith(span);
      $('editTeacher').classList.remove('hidden');
    };
    input.addEventListener('blur', done);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { input.removeEventListener('blur', done); cancel(); }
    });
  }

  // ---------- 设置 ----------
  function openSettings() {
    $('setWeek1').value = settings.week1Date;
    $('setTotalWeeks').value = settings.totalWeeks;
    $('settingsOverlay').classList.remove('hidden');
  }
  function saveSettingsFromUI() {
    const w1 = $('setWeek1').value;
    const tw = parseInt($('setTotalWeeks').value, 10);
    if (!w1) { alert('请选择开学第1周的日期'); return; }
    if (!(tw >= 1 && tw <= 60)) { alert('总周数需在 1-60 之间'); return; }
    settings.week1Date = w1;
    settings.totalWeeks = tw;
    saveSettings();
    $('settingsOverlay').classList.add('hidden');
    refresh();
  }

  // ---------- 主刷新 ----------
  function refresh() {
    today = C.startOfDay(new Date());
    autoWeek = C.weekOf(settings.week1Date, today);
    if (displayWeek < 1 || displayWeek > settings.totalWeeks) displayWeek = Math.max(1, autoWeek >= 1 ? autoWeek : 1);
    renderHeader();
    renderStatus();
    buildLegend();
    renderGrid();
    $('footnote').textContent =
      `数据源：${data.meta.semester || ''} 教务系统课表（打印于 ${data.meta.printDate || '?'}，学号 ${data.meta.studentId || '?'}）\n` +
      `周次以 ${settings.week1Date} 为第 1 周（周一）自动计算；每周课程按单/双周规则过滤。教师名可直接点开课程卡片校对。`;
  }

  function scrollToToday() {
    if (autoWeek < 1 || displayWeek !== autoWeek) return;
    const todayCol = document.querySelector('.col.today');
    const sc = $('scroll');
    if (todayCol && sc) {
      // 尽量把今天列滚到屏幕中间
      const target = todayCol.offsetLeft - (sc.clientWidth / 2) + todayCol.clientWidth / 2;
      sc.scrollLeft = Math.max(0, target);
    }
  }

  // ---------- 事件 ----------
  function bind() {
    $('prevWeek').addEventListener('click', () => {
      displayWeek = Math.max(1, displayWeek - 1);
      refresh(); renderGrid(); scrollToToday();
    });
    $('nextWeek').addEventListener('click', () => {
      displayWeek = Math.min(settings.totalWeeks, displayWeek + 1);
      refresh(); renderGrid(); scrollToToday();
    });
    $('backToday').addEventListener('click', () => {
      displayWeek = Math.max(1, autoWeek >= 1 ? autoWeek : 1);
      refresh(); renderGrid(); scrollToToday();
    });
    $('openSettings').addEventListener('click', openSettings);
    $('closeSettings').addEventListener('click', () => $('settingsOverlay').classList.add('hidden'));
    $('saveSettings').addEventListener('click', saveSettingsFromUI);
    $('resetTeacherFix').addEventListener('click', () => {
      if (confirm('清除全部教师名校对？')) {
        teacherFix = {};
        localStorage.removeItem(LS_TEACHER);
        $('settingsOverlay').classList.add('hidden');
        refresh();
      }
    });
    $('closeDetail').addEventListener('click', closeDetail);
    $('detailOverlay').addEventListener('click', (e) => { if (e.target === $('detailOverlay')) closeDetail(); });
    $('editTeacher').addEventListener('click', beginEditTeacher);
    // 状态条点击 → 回本周
    $('todayStatus').addEventListener('click', () => $('backToday').click());
  }

  // ---------- 启动 ----------
  function boot() {
    settings = loadSettings();
    loadTeacherFix();
    bind();
    load()
      .then(() => {
        if (data.meta) {
          // 用数据中的默认值填充设置（仅当用户未自定义）
          const raw = localStorage.getItem(LS_SETTINGS);
          if (!raw && data.meta.week1Date) {
            settings.week1Date = data.meta.week1Date;
            settings.totalWeeks = data.meta.totalWeeks || settings.totalWeeks;
          }
        }
        refresh();
        requestAnimationFrame(scrollToToday);
      })
      .catch(err => {
        document.body.innerHTML = `<div style="padding:30px;font-family:sans-serif"><h2>无法加载课表数据</h2>
        <p>${err.message}</p><p>请通过 HTTP 服务器访问（详见 README），不要直接双击打开文件。</p></div>`;
      });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
