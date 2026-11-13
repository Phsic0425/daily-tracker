/* ============================================
   countdown.js — 倒数日：数据层 + 日期计算 + 渲染 + 弹窗
   依赖：config.js（LUNAR_* / COUNTDOWN_MODES / COUNTDOWN_FESTIVALS）
         utils.js（today / genId / escapeHtml / fmtMoney）
         storage.js（state / saveData）
         effects.js（showToast）
   全部日期计算走 UTC 口径，避免时区与夏令时误差
   ============================================ */

/* ---------- 0. UI 常量 ---------- */

var CD_ICONS = ['🎂','💕','🎊','🏮','🥮','🎄','🌷','🎓','✈️','💼','🏠','📚','⭐','🍰','🎈','⏳'];

/* ---------- 1. 日期工具 ---------- */

/** 'YYYY-MM-DD' → {y,m,d}，非法返回 null */
function cdParseDate(str) {
  if (!str) return null;
  var m = String(str).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  var y = parseInt(m[1], 10);
  var mo = parseInt(m[2], 10);
  var d = parseInt(m[3], 10);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y: y, m: mo, d: d };
}

/** 拼 'YYYY-MM-DD' */
function cdMakeStr(y, m, d) {
  return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

/** 某年某月的天数（m 为 1-12） */
function cdDaysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** b - a 的天数（整数，可为负） */
function cdDaysBetween(aStr, bStr) {
  var a = cdParseDate(aStr);
  var b = cdParseDate(bStr);
  if (!a || !b) return 0;
  var ua = Date.UTC(a.y, a.m - 1, a.d);
  var ub = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((ub - ua) / 86400000);
}

/** 日期加减天数 */
function cdAddDays(dateStr, n) {
  var p = cdParseDate(dateStr);
  if (!p) return '';
  var t = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return cdMakeStr(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** 星期几中文（周日=日） */
function cdWeekdayName(dateStr) {
  var p = cdParseDate(dateStr);
  if (!p) return '';
  var w = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  return WEEKDAY_NAMES[w] || '';
}

/** 构造合法日期：2/29 在平年回退到 2/28 */
function cdClampYmd(y, m, d) {
  var dim = cdDaysInMonth(y, m);
  return cdMakeStr(y, m, Math.min(d, dim));
}

/** 某年某月第 nth 个星期 weekday（周日=0）；该月不够时回退到上一个 */
function cdNthWeekdayOfMonth(y, m, weekday, nth) {
  var first = new Date(Date.UTC(y, m - 1, 1));
  var offset = (weekday - first.getUTCDay() + 7) % 7;
  var day = 1 + offset + (Math.max(1, nth) - 1) * 7;
  var dim = cdDaysInMonth(y, m);
  while (day > dim) day -= 7;
  return cdMakeStr(y, m, day);
}

/* ---------- 2. 农历换算 ---------- */

function cdLunarReady() {
  return typeof Lunar !== 'undefined' && typeof Solar !== 'undefined';
}

/**
 * 农历 → 公历。
 * lunar-javascript 用「负数月份」表示闰月；该农历月没有这一天时自动向前回退
 * （如腊月三十遇 29 天的小月 → 廿九，除夕就靠这个逻辑）
 */
function cdLunarToSolar(lunarYear, month, day, isLeap) {
  if (!cdLunarReady()) return '';
  var m = Math.max(1, Math.min(12, parseInt(month, 10) || 1));
  var d0 = Math.max(1, Math.min(30, parseInt(day, 10) || 1));
  for (var d = d0; d >= Math.max(1, d0 - 2); d--) {
    try {
      var lunar = Lunar.fromYmd(parseInt(lunarYear, 10), isLeap ? -m : m, d);
      var solar = lunar.getSolar();
      return cdMakeStr(solar.getYear(), solar.getMonth(), solar.getDay());
    } catch (e) { /* 该农历月没有这一天，继续回退 */ }
  }
  return '';
}

/** 公历 → 农历信息 { year, month, day, isLeap, text } */
function cdSolarToLunar(dateStr) {
  if (!cdLunarReady()) return null;
  var p = cdParseDate(dateStr);
  if (!p) return null;
  try {
    var lunar = Solar.fromYmd(p.y, p.m, p.d).getLunar();
    var lm = lunar.getMonth();          // 负数 = 闰月
    var ld = lunar.getDay();
    var am = Math.abs(lm);
    return {
      year: lunar.getYear(),
      month: am,
      day: ld,
      isLeap: lm < 0,
      text: (lm < 0 ? '闰' : '') + (LUNAR_MONTH_NAMES[am - 1] || am) + '月' + (LUNAR_DAY_NAMES[ld] || ld)
    };
  } catch (e) {
    return null;
  }
}

/* ---------- 3. 下一次发生 / 上一次发生 ---------- */

/**
 * 计算下一次发生
 * @returns { date, key, lunarYear, anchorYear } | null
 *   key = 第几次（从 1 开始）；anchorYear / lunarYear 供推算「上一次」使用
 */
function cdNextOccurrence(cd, todayStr) {
  var mode = cd.mode || 'once';
  var todayP = cdParseDate(todayStr);
  if (!todayP) return null;
  var base = cdParseDate(cd.baseDate);

  if (mode === 'once') {
    if (!base) return null;
    return { date: cd.baseDate, key: 1, lunarYear: 0, anchorYear: base.y };
  }

  if (mode === 'yearly-solar') {
    if (!base) return null;
    var y = todayP.y;
    var date = cdClampYmd(y, base.m, base.d);
    if (date < todayStr) {
      y += 1;
      date = cdClampYmd(y, base.m, base.d);
    }
    // 基准日在未来时，不要把「下一次」算到基准日之前
    if (date < cd.baseDate) {
      date = cd.baseDate;
      y = base.y;
    }
    return { date: date, key: Math.max(1, y - base.y + 1), lunarYear: 0, anchorYear: y };
  }

  if (mode === 'yearly-rule') {
    var rule = cd.rule || {};
    var ry = todayP.y;
    var rDate = cdNthWeekdayOfMonth(ry, rule.month || 1, rule.weekday || 0, rule.nth || 1);
    if (rDate < todayStr) {
      ry += 1;
      rDate = cdNthWeekdayOfMonth(ry, rule.month || 1, rule.weekday || 0, rule.nth || 1);
    }
    var baseYear = base ? base.y : ry;
    if (rDate < cd.baseDate) {
      rDate = cd.baseDate;
      ry = baseYear;
    }
    return { date: rDate, key: Math.max(1, ry - baseYear + 1), lunarYear: 0, anchorYear: ry };
  }

  if (mode === 'yearly-lunar') {
    var lu = cd.lunar || {};
    if (!lu.month || !lu.day) return null;
    var startLY = lu.startYear || (base ? base.y : todayP.y);
    for (var ly = todayP.y - 1; ly <= todayP.y + 2; ly++) {
      var lDate = cdLunarToSolar(ly, lu.month, lu.day, !!lu.isLeap);
      if (!lDate) continue;
      if (lDate >= todayStr) {
        return { date: lDate, key: Math.max(1, ly - startLY + 1), lunarYear: ly, anchorYear: 0 };
      }
    }
    return null;
  }

  return base ? { date: cd.baseDate, key: 1, lunarYear: 0, anchorYear: base.y } : null;
}

/** 上一次发生（用于算周期进度） */
function cdPrevOccurrence(cd, next) {
  if (!next) return '';
  var mode = cd.mode || 'once';
  if (mode === 'once') return '';
  var base = cdParseDate(cd.baseDate);

  if (mode === 'yearly-solar' && base) {
    return cdClampYmd(next.anchorYear - 1, base.m, base.d);
  }
  if (mode === 'yearly-rule') {
    var rule = cd.rule || {};
    return cdNthWeekdayOfMonth(next.anchorYear - 1, rule.month || 1, rule.weekday || 0, rule.nth || 1);
  }
  if (mode === 'yearly-lunar') {
    var lu = cd.lunar || {};
    return cdLunarToSolar(next.lunarYear - 1, lu.month, lu.day, !!lu.isLeap);
  }
  return '';
}

/** 汇总一个倒数日的全部展示数据 */
function cdCompute(cd, todayStr) {
  var next = cdNextOccurrence(cd, todayStr);
  var passed = cd.baseDate ? cdDaysBetween(cd.baseDate, todayStr) : 0;
  var nextDate = next ? next.date : '';
  var remain = nextDate ? cdDaysBetween(todayStr, nextDate) : null;
  var isToday = remain === 0;
  var prevDate = cdPrevOccurrence(cd, next);

  var progress = 0;
  if (prevDate && nextDate) {
    var span = cdDaysBetween(prevDate, nextDate);
    var done = cdDaysBetween(prevDate, todayStr);
    progress = span > 0 ? Math.round(done / span * 100) : 0;
  } else if (nextDate) {
    progress = (remain !== null && remain < 0) ? 100 : 0;
  }
  progress = Math.max(0, Math.min(100, progress));

  return {
    cd: cd,
    nextDate: nextDate,
    remain: remain,
    isToday: isToday,
    passed: passed,
    key: next ? next.key : 1,
    prevDate: prevDate,
    progress: progress,
    lunarInfo: cdSolarToLunar(nextDate || cd.baseDate),
    expired: (cd.mode === 'once') && !!nextDate && remain !== null && remain < 0
  };
}

/** 排序权重：未到的按剩余天数升序，已过的排后面 */
function cdSortValue(item) {
  if (item.remain === null) return 900000;
  if (item.remain >= 0) return item.remain;
  return 1000000 + Math.abs(item.remain);
}

/** 颜色白名单，防止导入数据里塞进非法样式 */
function cdSafeColor(color) {
  if (typeof color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(color)) return color;
  return '#6366F1';
}

/* ---------- 4. 数据层 ---------- */

function getCountdowns() {
  if (!Array.isArray(state.countdowns)) state.countdowns = [];
  return state.countdowns;
}

function getCountdownById(id) {
  return getCountdowns().find(function (c) { return c.id === id; }) || null;
}

function findCountdownByFestivalKey(key) {
  return getCountdowns().find(function (c) { return c.festivalKey === key; }) || null;
}

/** 规范化一条记录（新增/更新/导入节日共用） */
function cdBuildRecord(rec) {
  var mode = rec.mode || 'once';
  var out = {
    title: String(rec.title || '').trim(),
    icon: rec.icon || '⏳',
    color: cdSafeColor(rec.color),
    note: rec.note || '',
    mode: mode,
    direction: rec.direction === 'countup' ? 'countup' : 'countdown',
    pinned: !!rec.pinned,
    baseDate: rec.baseDate || today(),
    festivalKey: rec.festivalKey || '',
    lunar: null,
    rule: null
  };

  if (mode === 'yearly-lunar') {
    var lu = rec.lunar || {};
    var startYear = parseInt(lu.startYear, 10) || 0;
    if (!startYear) {
      var bp = cdParseDate(out.baseDate);
      startYear = bp ? bp.y : new Date().getFullYear();
    }
    out.lunar = {
      month: Math.max(1, Math.min(12, parseInt(lu.month, 10) || 1)),
      day: Math.max(1, Math.min(30, parseInt(lu.day, 10) || 1)),
      isLeap: !!lu.isLeap,
      startYear: startYear
    };
  }

  if (mode === 'yearly-rule') {
    var r = rec.rule || {};
    out.rule = {
      month: Math.max(1, Math.min(12, parseInt(r.month, 10) || 1)),
      weekday: Math.max(0, Math.min(6, parseInt(r.weekday, 10) || 0)),
      nth: Math.max(1, Math.min(5, parseInt(r.nth, 10) || 1))
    };
  }

  return out;
}

function addCountdown(rec) {
  var cd = cdBuildRecord(rec);
  cd.id = genId();
  cd.createdAt = new Date().toISOString();
  getCountdowns().push(cd);
  saveData(state);
  return cd;
}

function updateCountdown(id, rec) {
  var old = getCountdownById(id);
  if (!old) return;
  var next = cdBuildRecord(rec);
  old.title = next.title;
  old.icon = next.icon;
  old.color = next.color;
  old.note = next.note;
  old.mode = next.mode;
  old.direction = next.direction;
  old.pinned = next.pinned;
  old.baseDate = next.baseDate;
  old.lunar = next.lunar;
  old.rule = next.rule;
  if (next.festivalKey) old.festivalKey = next.festivalKey;
  saveData(state);
}

function deleteCountdown(id) {
  state.countdowns = getCountdowns().filter(function (c) { return c.id !== id; });
  saveData(state);
}

function togglePinCountdown(id) {
  var cd = getCountdownById(id);
  if (!cd) return;
  cd.pinned = !cd.pinned;
  saveData(state);
}

/* ---------- 5. 渲染 ---------- */

function cdDateLine(item) {
  var dateStr = item.nextDate || item.cd.baseDate;
  var p = cdParseDate(dateStr);
  if (!p) return '未设置日期';
  var txt = dateStr + ' 周' + cdWeekdayName(dateStr);
  var lu = item.lunarInfo || cdSolarToLunar(dateStr);
  if (lu && lu.text) txt += ' · 农历' + lu.text;
  return txt;
}

/** 主数字：返回 { mode, num, label } */
function cdMainFigure(item) {
  var cd = item.cd;
  if (cd.direction === 'countup') {
    return { mode: 'num', num: Math.max(0, item.passed), label: '已经过去' };
  }
  if (item.isToday) return { mode: 'today', num: 0, label: '就是今天' };
  if (item.expired) return { mode: 'num', num: Math.abs(item.remain), label: '已经过去' };
  return { mode: 'num', num: Math.max(0, item.remain), label: '还剩' };
}

function cdRenderHero(item) {
  var cd = item.cd;
  var color = cdSafeColor(cd.color);
  var fig = cdMainFigure(item);
  var mainHtml;
  if (fig.mode === 'today') {
    mainHtml = '<div class="cd-hero-today" style="color:' + color + '">🎉 就是今天</div>';
  } else {
    mainHtml = '<div class="cd-hero-main">' +
      '<span class="cd-hero-label">' + fig.label + '</span>' +
      '<span class="cd-hero-num" style="color:' + color + '">' + fig.num + '</span>' +
      '<span class="cd-hero-unit">天</span>' +
      '</div>';
  }

  var subParts = [];
  if (cd.direction === 'countup') {
    if (item.remain !== null) {
      subParts.push(item.remain === 0 ? '今天就是纪念日 🎉' : '距下次周年还剩 ' + item.remain + ' 天');
    }
    if (item.key > 1) subParts.push('第 ' + item.key + ' 次');
  } else {
    subParts.push('已过去 ' + Math.max(0, item.passed) + ' 天');
    if (item.key > 1) subParts.push('第 ' + item.key + ' 次');
  }
  if (cd.note) subParts.push(escapeHtml(cd.note));

  return '<div class="cd-hero" data-action="edit-countdown" data-id="' + cd.id + '" style="border-left-color:' + color + '">' +
    '<div class="cd-hero-head">' +
      '<span class="cd-hero-icon">' + escapeHtml(cd.icon || '⏳') + '</span>' +
      '<span class="cd-hero-title">' + escapeHtml(cd.title) + '</span>' +
      (cd.pinned ? '<span class="cd-hero-pin">📌</span>' : '') +
    '</div>' +
    mainHtml +
    '<div class="cd-hero-date">' + escapeHtml(cdDateLine(item)) + '</div>' +
    '<div class="cd-bar"><div class="cd-bar-inner" style="width:' + item.progress + '%;background:' + color + '"></div></div>' +
    '<div class="cd-hero-sub">' + subParts.join(' · ') + '</div>' +
    '</div>';
}

function cdRenderItem(item) {
  var cd = item.cd;
  var color = cdSafeColor(cd.color);
  var fig = cdMainFigure(item);
  var rightHtml;
  if (fig.mode === 'today') {
    rightHtml = '<span class="cd-item-days" style="color:' + color + '">今天</span>';
  } else {
    rightHtml = '<span class="cd-item-days-label">' + fig.label + '</span>' +
      '<span class="cd-item-days" style="color:' + color + '">' + fig.num + '</span>' +
      '<span class="cd-item-days-unit">天</span>';
  }

  return '<div class="cd-item" data-action="edit-countdown" data-id="' + cd.id + '" style="border-left-color:' + color + '">' +
    '<span class="cd-item-icon">' + escapeHtml(cd.icon || '⏳') + '</span>' +
    '<div class="cd-item-body">' +
      '<div class="cd-item-title">' + escapeHtml(cd.title) + (cd.pinned ? ' 📌' : '') + '</div>' +
      '<div class="cd-item-date">' + escapeHtml(cdDateLine(item)) + '</div>' +
    '</div>' +
    '<div class="cd-item-right">' + rightHtml + '</div>' +
    '</div>';
}

function renderCountdownView() {
  try {
    var heroEl = document.getElementById('cdHeroArea');
    var listEl = document.getElementById('cdList');
    var emptyEl = document.getElementById('cdEmpty');
    var countEl = document.getElementById('cdCount');
    if (!heroEl || !listEl) return;

    var todayStr = today();
    var items = getCountdowns()
      .map(function (cd) { return cdCompute(cd, todayStr); })
      .filter(function (it) { return !!it.nextDate; });

    items.sort(function (a, b) {
      var pa = a.cd.pinned ? 0 : 1;
      var pb = b.cd.pinned ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return cdSortValue(a) - cdSortValue(b);
    });

    if (countEl) countEl.textContent = items.length;

    if (!items.length) {
      heroEl.innerHTML = '';
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = '';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    heroEl.innerHTML = cdRenderHero(items[0]);
    listEl.innerHTML = items.slice(1).map(cdRenderItem).join('');
  } catch (e) {
    console.error('renderCountdownView error:', e);
  }
}

/* ---------- 6. 倒数日弹窗 ---------- */

var cdEditingId = null;
var cdFormMode = 'yearly-solar';
var cdFormDirection = 'countdown';
var cdFormColor = '#6366F1';
var cdFormIcon = '🎂';
var _cdFormInited = false;

function cdInitFormOptions() {
  if (_cdFormInited) return;
  _cdFormInited = true;

  var monthHtml = '';
  for (var i = 0; i < LUNAR_MONTH_NAMES.length; i++) {
    monthHtml += '<option value="' + (i + 1) + '">' + LUNAR_MONTH_NAMES[i] + '月</option>';
  }
  document.getElementById('cdLunarMonth').innerHTML = monthHtml;

  var dayHtml = '';
  for (var d = 1; d <= 30; d++) {
    dayHtml += '<option value="' + d + '">' + (LUNAR_DAY_NAMES[d] || d) + '</option>';
  }
  document.getElementById('cdLunarDay').innerHTML = dayHtml;

  var month2 = '';
  for (var m = 1; m <= 12; m++) {
    month2 += '<option value="' + m + '">' + m + '月</option>';
  }
  document.getElementById('cdRuleMonth').innerHTML = month2;

  var wd = '';
  for (var w = 0; w < 7; w++) {
    wd += '<option value="' + w + '">周' + WEEKDAY_NAMES[w] + '</option>';
  }
  document.getElementById('cdRuleWeekday').innerHTML = wd;

  var nth = '';
  for (var n = 1; n <= 5; n++) {
    nth += '<option value="' + n + '">第 ' + n + ' 个</option>';
  }
  document.getElementById('cdRuleNth').innerHTML = nth;
}

function renderCdModeGrid() {
  var grid = document.getElementById('cdModeGrid');
  if (!grid) return;
  grid.innerHTML = COUNTDOWN_MODES.map(function (m) {
    var active = m.key === cdFormMode ? ' active' : '';
    return '<button type="button" class="cd-mode-btn' + active + '" data-mode="' + m.key + '">' +
      '<span class="cd-mode-icon">' + m.icon + '</span>' +
      '<span>' + m.label + '</span>' +
      '</button>';
  }).join('');
}

function renderCdRows() {
  var lunarRow = document.getElementById('cdLunarDateRow');
  var ruleRow = document.getElementById('cdRuleRow');
  var solarRow = document.getElementById('cdSolarDateRow');
  var hint = document.getElementById('cdModeHint');
  if (!lunarRow || !ruleRow || !solarRow) return;

  var isLunar = cdFormMode === 'yearly-lunar';
  var isRule = cdFormMode === 'yearly-rule';
  solarRow.style.display = (isLunar || isRule) ? 'none' : '';
  lunarRow.style.display = isLunar ? '' : 'none';
  ruleRow.style.display = isRule ? '' : 'none';

  if (hint) {
    var def = COUNTDOWN_MODES.find(function (m) { return m.key === cdFormMode; });
    var text = def ? def.desc : '';
    if (cdFormMode === 'once') text += '（日期就是目标日）';
    else if (cdFormMode === 'yearly-solar') text += '（日期里的月和日会每年重复）';
    else if (cdFormMode === 'yearly-lunar') text += '（按农历算，每年公历日期会变）';
    else if (cdFormMode === 'yearly-rule') text += '（如母亲节＝5月第2个周日）';
    hint.textContent = text;
  }
}

function renderCdDirection() {
  var btns = document.querySelectorAll('.cd-dir-btn');
  Array.prototype.forEach.call(btns, function (b) {
    b.classList.toggle('active', b.dataset.dir === cdFormDirection);
  });
}

function renderCdColors() {
  var wrap = document.getElementById('cdColorPicker');
  if (!wrap) return;
  wrap.innerHTML = SCHEDULE_COLORS.map(function (c) {
    var sel = c === cdFormColor ? ' selected' : '';
    return '<span class="color-option' + sel + '" data-action="pick-cd-color" data-color="' + c + '" style="background:' + c + '"></span>';
  }).join('');
}

function renderCdIcons() {
  var wrap = document.getElementById('cdIconPicker');
  if (!wrap) return;
  wrap.innerHTML = CD_ICONS.map(function (ic) {
    var sel = ic === cdFormIcon ? ' selected' : '';
    return '<span class="cd-icon-opt' + sel + '" data-action="pick-cd-icon" data-icon="' + ic + '">' + ic + '</span>';
  }).join('');
}

/** 从表单读取数据（不校验） */
function collectCdForm() {
  var mode = cdFormMode;
  var dateVal = document.getElementById('cdDate').value || today();
  var rec = {
    title: document.getElementById('cdTitle').value.trim(),
    mode: mode,
    direction: cdFormDirection,
    icon: cdFormIcon,
    color: cdFormColor,
    note: document.getElementById('cdNote').value.trim(),
    pinned: document.getElementById('cdPinned').checked,
    baseDate: dateVal
  };

  if (mode === 'yearly-lunar') {
    var lp = cdParseDate(dateVal);
    var anchorYear = lp ? lp.y : new Date().getFullYear();
    rec.lunar = {
      month: document.getElementById('cdLunarMonth').value,
      day: document.getElementById('cdLunarDay').value,
      isLeap: document.getElementById('cdLunarLeap').checked,
      startYear: anchorYear
    };
    var solarDate = cdLunarToSolar(anchorYear, rec.lunar.month, rec.lunar.day, rec.lunar.isLeap);
    if (solarDate) rec.baseDate = solarDate;
  }

  if (mode === 'yearly-rule') {
    var rp = cdParseDate(dateVal);
    var ry = rp ? rp.y : new Date().getFullYear();
    rec.rule = {
      month: document.getElementById('cdRuleMonth').value,
      weekday: document.getElementById('cdRuleWeekday').value,
      nth: document.getElementById('cdRuleNth').value
    };
    rec.baseDate = cdNthWeekdayOfMonth(ry, rec.rule.month, rec.rule.weekday, rec.rule.nth);
  }

  return rec;
}

function updateCdPreview() {
  var el = document.getElementById('cdPreview');
  if (!el) return;
  var rec;
  try {
    rec = collectCdForm();
  } catch (e) {
    el.textContent = '';
    return;
  }
  var temp = cdBuildRecord(rec);
  if (!cdParseDate(temp.baseDate)) {
    el.textContent = '请选择日期';
    return;
  }
  temp.id = '__preview__';
  var item = cdCompute(temp, today());
  if (!item.nextDate) {
    el.textContent = '下一次发生时间无法计算，请检查日期';
    return;
  }
  var parts = ['下次：' + cdDateLine(item)];
  if (item.remain > 0) parts.push('还剩 ' + item.remain + ' 天');
  else if (item.remain === 0) parts.push('就是今天 🎉');
  else parts.push('已过 ' + Math.abs(item.remain) + ' 天');
  if (item.key > 1) parts.push('第 ' + item.key + ' 次');
  el.textContent = parts.join(' · ');
}

function resetCountdownForm() {
  cdFormMode = 'yearly-solar';
  cdFormDirection = 'countdown';
  cdFormColor = SCHEDULE_COLORS[0];
  cdFormIcon = '🎂';

  document.getElementById('cdTitle').value = '';
  document.getElementById('cdDate').value = today();
  document.getElementById('cdNote').value = '';
  document.getElementById('cdPinned').checked = false;
  document.getElementById('cdLunarMonth').value = '1';
  document.getElementById('cdLunarDay').value = '1';
  document.getElementById('cdLunarLeap').checked = false;
  document.getElementById('cdRuleMonth').value = '5';
  document.getElementById('cdRuleWeekday').value = '0';
  document.getElementById('cdRuleNth').value = '2';
}

function fillCountdownForm(cd) {
  cdFormMode = cd.mode || 'once';
  cdFormDirection = cd.direction === 'countup' ? 'countup' : 'countdown';
  cdFormColor = cdSafeColor(cd.color);
  cdFormIcon = cd.icon || '⏳';

  document.getElementById('cdTitle').value = cd.title || '';
  document.getElementById('cdDate').value = cd.baseDate || today();
  document.getElementById('cdNote').value = cd.note || '';
  document.getElementById('cdPinned').checked = !!cd.pinned;

  var lu = cd.lunar || {};
  document.getElementById('cdLunarMonth').value = String(lu.month || 1);
  document.getElementById('cdLunarDay').value = String(lu.day || 1);
  document.getElementById('cdLunarLeap').checked = !!lu.isLeap;

  var r = cd.rule || {};
  document.getElementById('cdRuleMonth').value = String(r.month || 1);
  document.getElementById('cdRuleWeekday').value = String(r.weekday != null ? r.weekday : 0);
  document.getElementById('cdRuleNth').value = String(r.nth || 1);
}

function openCountdownModal(editId) {
  cdEditingId = editId || null;
  cdInitFormOptions();

  document.getElementById('countdownModal').classList.add('show');
  document.getElementById('countdownOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';

  if (editId) {
    var cd = getCountdownById(editId);
    if (!cd) {
      closeCountdownModal();
      showToast('这条倒数日已不存在');
      return;
    }
    document.getElementById('countdownModalTitle').textContent = '编辑倒数日';
    document.getElementById('btnDeleteCountdown').style.display = '';
    fillCountdownForm(cd);
  } else {
    document.getElementById('countdownModalTitle').textContent = '新建倒数日';
    document.getElementById('btnDeleteCountdown').style.display = 'none';
    resetCountdownForm();
  }

  renderCdModeGrid();
  renderCdRows();
  renderCdDirection();
  renderCdColors();
  renderCdIcons();
  updateCdPreview();
}

function closeCountdownModal() {
  document.getElementById('countdownModal').classList.remove('show');
  document.getElementById('countdownOverlay').classList.remove('show');
  document.body.style.overflow = '';
  cdEditingId = null;
}

function handleSaveCountdown() {
  var rec;
  try {
    rec = collectCdForm();
  } catch (e) {
    console.error(e);
    showToast('表单读取失败');
    return;
  }
  if (!rec.title) {
    showToast('请输入标题');
    document.getElementById('cdTitle').focus();
    return;
  }
  if (!cdParseDate(rec.baseDate)) {
    showToast('请选择有效日期');
    return;
  }
  if (cdFormMode === 'yearly-lunar') {
    var check = cdLunarToSolar(
      rec.lunar.startYear || (cdParseDate(rec.baseDate) || {}).y || new Date().getFullYear(),
      rec.lunar.month, rec.lunar.day, rec.lunar.isLeap
    );
    if (!check) {
      showToast('这个农历日期换算失败，请换一个日子');
      return;
    }
  }

  if (cdEditingId) {
    updateCountdown(cdEditingId, rec);
    showToast('倒数日已更新 ✓');
  } else {
    addCountdown(rec);
    showToast('倒数日已添加 ✓');
  }
  closeCountdownModal();
  renderCountdownView();
}

function handleDeleteCountdown() {
  if (!cdEditingId) return;
  if (!confirm('确定要删除这个倒数日吗？')) return;
  deleteCountdown(cdEditingId);
  closeCountdownModal();
  renderCountdownView();
  showToast('倒数日已删除');
}

/* ---------- 7. 节日导入 ---------- */

var cdFestivalGroup = 'all';
var cdFestivalSelected = new Set();

function cdFestivalDateText(f) {
  if (f.mode === 'yearly-solar') return f.month + '月' + f.day + '日';
  if (f.mode === 'yearly-lunar') return '农历' + (LUNAR_MONTH_NAMES[f.month - 1] || f.month) + '月' + (LUNAR_DAY_NAMES[f.day] || f.day);
  if (f.mode === 'yearly-rule') return f.month + '月第' + f.nth + '个周' + (WEEKDAY_NAMES[f.weekday] || '');
  return '';
}

function renderFestivalTabs() {
  var tabs = document.getElementById('cdFestivalTabs');
  if (!tabs) return;
  Array.prototype.forEach.call(tabs.querySelectorAll('[data-group]'), function (b) {
    b.classList.toggle('active', b.dataset.group === cdFestivalGroup);
  });
}

function renderFestivalList() {
  var listEl = document.getElementById('cdFestivalList');
  if (!listEl) return;

  var items = COUNTDOWN_FESTIVALS.filter(function (f) {
    return cdFestivalGroup === 'all' || f.group === cdFestivalGroup;
  });

  listEl.innerHTML = items.map(function (f) {
    var imported = !!findCountdownByFestivalKey(f.key);
    var checked = cdFestivalSelected.has(f.key);
    var attrs = imported ? ' disabled' : (checked ? ' checked' : '');
    return '<label class="cd-festival-item' + (imported ? ' imported' : '') + '">' +
      '<input type="checkbox" data-festival="' + f.key + '"' + attrs + '>' +
      '<span class="cd-festival-icon">' + f.icon + '</span>' +
      '<span class="cd-festival-name">' + f.name + '</span>' +
      '<span class="cd-festival-tag">' + (imported ? '已导入' : cdFestivalDateText(f)) + '</span>' +
      '</label>';
  }).join('');
}

function openFestivalModal() {
  cdFestivalSelected = new Set();
  cdFestivalGroup = 'all';
  renderFestivalTabs();
  renderFestivalList();
  document.getElementById('festivalModal').classList.add('show');
  document.getElementById('festivalOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeFestivalModal() {
  document.getElementById('festivalModal').classList.remove('show');
  document.getElementById('festivalOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

/** 用节日定义造一条倒数日记录 */
function cdFestivalRecord(f, todayStr) {
  var p = cdParseDate(todayStr);
  var y = p ? p.y : new Date().getFullYear();
  var rec = {
    title: f.name,
    icon: f.icon,
    color: f.color || SCHEDULE_COLORS[0],
    note: '',
    mode: f.mode,
    direction: 'countdown',
    pinned: false,
    festivalKey: f.key,
    baseDate: ''
  };

  if (f.mode === 'yearly-solar') {
    rec.baseDate = cdClampYmd(y, f.month, f.day);
  } else if (f.mode === 'yearly-lunar') {
    var lunarToday = cdSolarToLunar(todayStr);
    var lunarYear = (lunarToday && lunarToday.year) ? lunarToday.year : y;
    var solarDate = cdLunarToSolar(lunarYear, f.month, f.day, false);
    if (!solarDate) return null;
    rec.baseDate = solarDate;
    rec.lunar = { month: f.month, day: f.day, isLeap: false, startYear: lunarYear };
  } else if (f.mode === 'yearly-rule') {
    rec.baseDate = cdNthWeekdayOfMonth(y, f.month, f.weekday, f.nth);
    rec.rule = { month: f.month, weekday: f.weekday, nth: f.nth };
  } else {
    return null;
  }

  return cdBuildRecord(rec);
}

function handleImportFestivals() {
  var todayStr = today();
  var added = 0;

  COUNTDOWN_FESTIVALS.forEach(function (f) {
    if (!cdFestivalSelected.has(f.key)) return;
    if (findCountdownByFestivalKey(f.key)) return;
    var rec = cdFestivalRecord(f, todayStr);
    if (!rec) return;
    rec.id = genId();
    rec.createdAt = new Date().toISOString();
    getCountdowns().push(rec);
    added++;
  });

  if (!added) {
    showToast('选中的节日都已经导入过了');
    return;
  }
  saveData(state);
  cdFestivalSelected = new Set();
  renderCountdownView();
  closeFestivalModal();
  showToast('✅ 已导入 ' + added + ' 个节日');
}

/* ---------- 8. 事件绑定（由 events.js 调用） ---------- */

function bindCountdownEvents() {
  var addBtn = document.getElementById('btnCdAdd');
  if (addBtn) addBtn.addEventListener('click', function () { openCountdownModal(); });

  var festBtn = document.getElementById('btnCdFestival');
  if (festBtn) festBtn.addEventListener('click', openFestivalModal);

  function onCardClick(e) {
    var el = e.target.closest('[data-action="edit-countdown"]');
    if (!el) return;
    openCountdownModal(el.dataset.id);
  }
  var heroEl = document.getElementById('cdHeroArea');
  var listEl = document.getElementById('cdList');
  if (heroEl) heroEl.addEventListener('click', onCardClick);
  if (listEl) listEl.addEventListener('click', onCardClick);

  // 模式切换
  var modeGrid = document.getElementById('cdModeGrid');
  if (modeGrid) {
    modeGrid.addEventListener('click', function (e) {
      var btn = e.target.closest('.cd-mode-btn');
      if (!btn) return;
      cdFormMode = btn.dataset.mode;
      renderCdModeGrid();
      renderCdRows();
      updateCdPreview();
    });
  }

  // 显示方向
  var dirToggle = document.getElementById('cdDirToggle');
  if (dirToggle) {
    dirToggle.addEventListener('click', function (e) {
      var btn = e.target.closest('.cd-dir-btn');
      if (!btn) return;
      cdFormDirection = btn.dataset.dir;
      renderCdDirection();
      updateCdPreview();
    });
  }

  // 颜色
  var colorPicker = document.getElementById('cdColorPicker');
  if (colorPicker) {
    colorPicker.addEventListener('click', function (e) {
      var opt = e.target.closest('[data-action="pick-cd-color"]');
      if (!opt) return;
      cdFormColor = opt.dataset.color;
      renderCdColors();
    });
  }

  // 图标
  var iconPicker = document.getElementById('cdIconPicker');
  if (iconPicker) {
    iconPicker.addEventListener('click', function (e) {
      var opt = e.target.closest('[data-action="pick-cd-icon"]');
      if (!opt) return;
      cdFormIcon = opt.dataset.icon;
      renderCdIcons();
    });
  }

  // 表单联动预览
  ['cdDate', 'cdLunarMonth', 'cdLunarDay', 'cdLunarLeap', 'cdRuleMonth', 'cdRuleWeekday', 'cdRuleNth'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', updateCdPreview);
    el.addEventListener('input', updateCdPreview);
  });

  // 弹窗按钮
  var saveBtn = document.getElementById('btnSaveCountdown');
  if (saveBtn) saveBtn.addEventListener('click', handleSaveCountdown);
  var delBtn = document.getElementById('btnDeleteCountdown');
  if (delBtn) delBtn.addEventListener('click', handleDeleteCountdown);
  var cancelBtn = document.getElementById('btnCancelCountdown');
  if (cancelBtn) cancelBtn.addEventListener('click', closeCountdownModal);
  var cdOverlay = document.getElementById('countdownOverlay');
  if (cdOverlay) cdOverlay.addEventListener('click', closeCountdownModal);

  // 节日弹窗
  var feastTabs = document.getElementById('cdFestivalTabs');
  if (feastTabs) {
    feastTabs.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-group]');
      if (!btn) return;
      cdFestivalGroup = btn.dataset.group;
      renderFestivalTabs();
      renderFestivalList();
    });
  }
  var feastList = document.getElementById('cdFestivalList');
  if (feastList) {
    feastList.addEventListener('change', function (e) {
      var key = e.target.dataset.festival;
      if (!key) return;
      if (e.target.checked) cdFestivalSelected.add(key);
      else cdFestivalSelected.delete(key);
    });
  }
  var importBtn = document.getElementById('btnImportFestivals');
  if (importBtn) importBtn.addEventListener('click', handleImportFestivals);
  var closeFeast = document.getElementById('btnCloseFestival');
  if (closeFeast) closeFeast.addEventListener('click', closeFestivalModal);
  var feastOverlay = document.getElementById('festivalOverlay');
  if (feastOverlay) feastOverlay.addEventListener('click', closeFestivalModal);
}
