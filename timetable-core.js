// timetable-core.js — 周次计算与课程过滤纯逻辑（浏览器/Node 通用）
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TimetableCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 'YYYY-MM-DD' → 本地 Date(00:00)
  function parseDate(s) {
    if (!s) return null;
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s).trim());
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }

  function fmtDate(d) {
    return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
  }

  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  // 某日期是第几周（week1Date 为第1周周一）；早于开学返回 <=0
  function weekOf(week1Date, date) {
    const w1 = parseDate(week1Date);
    if (!w1 || !date) return 0;
    const diff = Math.round((startOfDay(date) - startOfDay(w1)) / 86400000);
    return Math.floor(diff / 7) + 1;
  }

  // 本周一 / 周日日期
  function mondayOf(week1Date, week) {
    const w1 = parseDate(week1Date);
    if (!w1 || !week || week < 1) return null;
    const d = new Date(w1);
    d.setDate(d.getDate() + (week - 1) * 7);
    return d;
  }
  function weekRange(week1Date, week) {
    const mon = mondayOf(week1Date, week);
    if (!mon) return null;
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    return { mon, sun };
  }

  // 课程周规则过滤：rule={from,to,parity} parity: 0全周 1单周 2双周
  // rule 为 null/未解析 → 恒显示
  function inWeek(rule, week) {
    if (!rule) return true;            // 无规则：每周都有
    if (!week || week < 1) return false; // 无效周次：本周无课
    const { from, to, parity } = rule;
    if (week < from || week > to) return false;
    if (parity === 1) return week % 2 === 1;
    if (parity === 2) return week % 2 === 0;
    return true;
  }

  // 周规则的可读描述，如 "第1-16周" "第2-16周(双)" "第16周"
  function weekTextOf(rule) {
    if (!rule) return '';
    const { from, to, parity } = rule;
    const rng = from === to ? `第${from}周` : `第${from}-${to}周`;
    if (parity === 1) return `${rng}（单周）`;
    if (parity === 2) return `${rng}（双周）`;
    return rng;
  }

  const DAY_CN = ['日', '一', '二', '三', '四', '五', '六'];

  return { parseDate, fmtDate, startOfDay, weekOf, mondayOf, weekRange, inWeek, weekTextOf, DAY_CN };
});
