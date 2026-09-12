/* ============================================
   schedule.js — 日程 CRUD & 重复规则 & 提醒逻辑
   ============================================ */

// ---- CRUD ----

function addSchedule(sched) {
  state.schedules.push({
    id: genId(),
    title: sched.title.trim(),
    type: sched.type || 'event',      // 'event' 事件类 | 'background' 背景类
    date: sched.date,                 // 首个日期 YYYY-MM-DD
    endDate: sched.endDate || '',     // 跨天结束日（空=单天）
    time: sched.time || '',           // HH:MM
    endTime: sched.endTime || '',     // HH:MM
    displayText: sched.displayText || '', // 日历显示文字（空=自动生成）
    repeat: {
      mode: sched.repeat.mode || 'once',
      count: sched.repeat.count || 0,
      interval: sched.repeat.interval || 1,
      weekdays: sched.repeat.weekdays || [],
      endDate: sched.repeat.endDate || '',
      lunarMonth: sched.repeat.lunarMonth || 1,
      lunarDay: sched.repeat.lunarDay || 1,
      lunarLeap: sched.repeat.lunarLeap || false,
    },
    reminder: sched.reminder || 15,
    note: sched.note || '',
    color: sched.color || '#6366F1',
    createdAt: new Date().toISOString(),
  });
  saveData(state);
}

function deleteSchedule(id) {
  state.schedules = state.schedules.filter(s => s.id !== id);
  saveData(state);
}

function updateSchedule(id, data) {
  const sched = state.schedules.find(s => s.id === id);
  if (!sched) return;
  Object.assign(sched, {
    title: data.title.trim(),
    type: data.type || 'event',
    date: data.date,
    endDate: data.endDate || '',
    time: data.time || '',
    endTime: data.endTime || '',
    displayText: data.displayText || '',
    repeat: {
      mode: data.repeat.mode || 'once',
      count: data.repeat.count || 0,
      interval: data.repeat.interval || 1,
      weekdays: data.repeat.weekdays || [],
      endDate: data.repeat.endDate || '',
      lunarMonth: data.repeat.lunarMonth || 1,
      lunarDay: data.repeat.lunarDay || 1,
      lunarLeap: data.repeat.lunarLeap || false,
    },
    reminder: data.reminder || 15,
    note: data.note || '',
    color: data.color || '#6366F1',
  });
  saveData(state);
}

// ---- 重复规则展开 ----

/**
 * 返回某个日程在 [fromDate, toDate] 范围内的所有发生日期
 * @returns string[] YYYY-MM-DD
 */
function expandRepeats(sched, fromDate, toDate) {
  const results = [];
  const start = new Date(sched.date + 'T00:00:00');
  const from = new Date(fromDate + 'T00:00:00');
  const to = new Date(toDate + 'T00:00:00');
  const mode = sched.repeat.mode;

  if (mode === 'once') {
    if (start >= from && start <= to) results.push(sched.date);
    return results;
  }

  if (mode === 'daily') {
    return expandDaily(sched, from, to);
  }
  if (mode === 'weekly') {
    return expandWeekly(sched, from, to);
  }
  if (mode === 'monthly') {
    return expandMonthly(sched, from, to);
  }
  if (mode === 'custom') {
    return expandCustom(sched, from, to);
  }
  if (mode === 'yearly-solar') {
    return expandYearlySolar(sched, from, to);
  }
  if (mode === 'yearly-lunar') {
    return expandYearlyLunar(sched, from, to);
  }

  return results;
}

function expandDaily(sched, from, to) {
  const results = [];
  const start = new Date(sched.date + 'T00:00:00');
  const interval = Math.max(1, sched.repeat.interval || 1);
  const endDate = sched.repeat.endDate ? new Date(sched.repeat.endDate + 'T00:00:00') : to;
  const limit = Math.min(endDate, to);

  let cursor = new Date(start);
  let count = 0;
  const maxCount = sched.repeat.count || 365 * 10; // 默认10年上限防止死循环

  while (cursor <= limit && count < maxCount) {
    if (cursor >= from) {
      results.push(fmtDateStr(cursor));
    }
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + interval);
    count++;
  }
  return results;
}

function expandWeekly(sched, from, to) {
  const results = [];
  const start = new Date(sched.date + 'T00:00:00');
  const weekdays = sched.repeat.weekdays || [];
  if (weekdays.length === 0) return results; // 未选星期几则不展开
  const interval = Math.max(1, sched.repeat.interval || 1);
  const endDate = sched.repeat.endDate ? new Date(sched.repeat.endDate + 'T00:00:00') : to;
  const limit = Math.min(endDate, to);
  const maxCount = sched.repeat.count || 520; // 10年

  let cursor = new Date(start);
  let count = 0;

  // 从开始日期往未来找
  while (cursor <= limit && count < maxCount) {
    if (cursor >= from && weekdays.includes(cursor.getDay())) {
      results.push(fmtDateStr(cursor));
      count++;
    }
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  return results;
}

function expandMonthly(sched, from, to) {
  const results = [];
  const start = new Date(sched.date + 'T00:00:00');
  const dayOfMonth = start.getDate();
  const interval = Math.max(1, sched.repeat.interval || 1);
  const endDate = sched.repeat.endDate ? new Date(sched.repeat.endDate + 'T00:00:00') : to;
  const limit = Math.min(endDate, to);
  const maxCount = sched.repeat.count || 120;

  let cursor = new Date(start);
  let count = 0;

  while (cursor <= limit && count < maxCount) {
    if (cursor >= from) {
      results.push(fmtDateStr(cursor));
      count++;
    }
    // 下一个月
    cursor = new Date(cursor);
    cursor.setMonth(cursor.getMonth() + interval);
    // 处理月末溢出（如 31 号到只有 30 天的月份）
    const targetDay = Math.min(dayOfMonth, new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate());
    cursor.setDate(targetDay);
  }
  return results;
}

function expandCustom(sched, from, to) {
  const results = [];
  const start = new Date(sched.date + 'T00:00:00');
  const count = sched.repeat.count || 1;
  const interval = Math.max(1, sched.repeat.interval || 1);

  let cursor = new Date(start);
  for (let i = 0; i < count; i++) {
    if (cursor >= from && cursor <= to) {
      results.push(fmtDateStr(cursor));
    }
    if (cursor > to) break;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + interval);
  }
  return results;
}

function expandYearlySolar(sched, from, to) {
  const results = [];
  const start = new Date(sched.date + 'T00:00:00');
  const targetMonth = start.getMonth(); // 0-based
  const targetDay = start.getDate();
  const maxCount = sched.repeat.count || 50;

  let year = start.getFullYear();
  let count = 0;

  while (year <= to.getFullYear() && count < maxCount) {
    // 处理 2月29日：非闰年调到2月28日
    const lastDay = new Date(year, targetMonth + 1, 0).getDate();
    const actualDay = Math.min(targetDay, lastDay);
    const d = new Date(year, targetMonth, actualDay);

    if (d >= from && d <= to) {
      results.push(fmtDateStr(d));
      count++;
    }
    if (d > to) break;
    year++;
  }
  return results;
}

function expandYearlyLunar(sched, from, to) {
  const results = [];
  const lunarMonth = sched.repeat.lunarMonth || 1;
  const lunarDay = sched.repeat.lunarDay || 1;
  const isLeap = sched.repeat.lunarLeap || false;
  const maxCount = sched.repeat.count || 50;

  if (typeof Lunar === 'undefined' || typeof Solar === 'undefined') {
    console.warn('lunar-javascript 库未加载，无法展开农历重复');
    return results;
  }

  let year = from.getFullYear();
  let count = 0;

  while (year <= to.getFullYear() && count < maxCount) {
    try {
      let lunar;
      if (isLeap) {
        // 获取闰月
        const leapMonth = Lunar.fromYmd(year, 1, 1).getLeapMonth();
        if (leapMonth === lunarMonth) {
          lunar = Lunar.fromYmd(year, lunarMonth, lunarDay);
        } else {
          // 该年没有对应的闰月，跳过
          year++;
          continue;
        }
      } else {
        lunar = Lunar.fromYmd(year, lunarMonth, lunarDay);
      }
      const solar = lunar.getSolar();
      const y = solar.getYear();
      const m = String(solar.getMonth()).padStart(2, '0');
      const d = String(solar.getDay()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const dateObj = new Date(dateStr + 'T00:00:00');

      if (dateObj >= from && dateObj <= to) {
        results.push(dateStr);
        count++;
      }
      if (dateObj > to) break;
    } catch(e) {
      // 某些年份可能没有对应的农历日期（如闰月不存在）
    }
    year++;
  }
  return results;
}

// ---- 跨天展开 ----

/**
 * 返回日程在 [fromStr, toStr] 区间内覆盖的所有日期（考虑跨天 endDate）
 * @returns string[] YYYY-MM-DD
 */
function expandScheduleDates(sched, fromStr, toStr) {
  // 跨天日程(endDate > date)不参与重复，只从开始日展开到结束日
  const isMultiDay = sched.endDate && sched.endDate > sched.date;
  const startDates = isMultiDay ? [sched.date] : expandRepeats(sched, fromStr, toStr);

  const results = [];
  startDates.forEach(function(start) {
    const d0 = new Date(start + 'T00:00:00');
    const end = isMultiDay ? sched.endDate : start;
    const d1 = new Date(end + 'T00:00:00');
    const days = Math.max(0, Math.round((d1 - d0) / 86400000));
    for (let i = 0; i <= days; i++) {
      const d = new Date(d0);
      d.setDate(d0.getDate() + i);
      const ds = fmtDateStr(d);
      if (ds >= fromStr && ds <= toStr) results.push(ds);
    }
  });
  return results;
}

// ---- 查询 ----

function getSchedulesForDate(dateStr) {
  // 计算需要查询的范围（前后各扩展，以捕获重复展开的日程）
  const d = new Date(dateStr + 'T00:00:00');
  const rangeStart = new Date(d);
  rangeStart.setFullYear(rangeStart.getFullYear() - 1);
  const rangeEnd = new Date(d);
  rangeEnd.setFullYear(rangeEnd.getFullYear() + 1);

  const fromStr = fmtDateStr(rangeStart);
  const toStr = fmtDateStr(rangeEnd);

  const result = [];
  state.schedules.forEach(sched => {
    const dates = expandScheduleDates(sched, fromStr, toStr);
    if (dates.includes(dateStr)) {
      result.push({
        ...sched,
        _occurrences: dates.filter(dd => dd >= dateStr).sort(),
      });
    }
  });
  return result;
}

/** 获取某月内有事件类日程的日期集合（用于日历事件标签） */
function getScheduledDatesInMonth(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const fromStr = fmtDateStr(firstDay);
  const toStr = fmtDateStr(lastDay);

  const dateMap = {}; // { 'YYYY-MM-DD': [{color, label}] }

  state.schedules.forEach(sched => {
    if (sched.type === 'background') return; // 背景类另走 getBackgroundDatesInMonth
    const dates = expandScheduleDates(sched, fromStr, toStr);
    const label = sched.displayText || autoLabel(sched.title);
    dates.forEach(d => {
      if (!dateMap[d]) dateMap[d] = [];
      // 去重：同色同标签只显示一次
      const exists = dateMap[d].some(x => x.label === label);
      if (!exists) dateMap[d].push({ color: sched.color, label: label });
    });
  });
  return dateMap;
}

/** 获取某月内背景类日程的日期集合（用于日历背景标签） */
function getBackgroundDatesInMonth(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const fromStr = fmtDateStr(firstDay);
  const toStr = fmtDateStr(lastDay);

  const dateMap = {}; // { 'YYYY-MM-DD': [{color, label}] }

  state.schedules.forEach(sched => {
    if (sched.type !== 'background') return;
    const dates = expandScheduleDates(sched, fromStr, toStr);
    const label = sched.displayText || autoLabel(sched.title);
    dates.forEach(d => {
      if (!dateMap[d]) dateMap[d] = [];
      const exists = dateMap[d].some(x => x.label === label);
      if (!exists) dateMap[d].push({ color: sched.color, label: label });
    });
  });
  return dateMap;
}

/** 自动生成日历显示文字（最多4字） */
function autoLabel(title) {
  if (!title) return '';
  // 取前4个字符（中文1字1义，英文截断）
  if (title.length > 4) return title.slice(0, 4);
  return title;
}

/** 获取即将到来的日程（按时间排序） */
function getUpcomingSchedules(limit) {
  const now = new Date();
  const todayStr = fmtDateStr(now);
  const future = new Date(now);
  future.setFullYear(future.getFullYear() + 1);
  const futureStr = fmtDateStr(future);

  const allUpcoming = [];

  state.schedules.forEach(sched => {
    if (sched.type === 'background') return; // 背景类不参与即将到来
    const dates = expandRepeats(sched, todayStr, futureStr);
    dates.forEach(d => {
      // 过去的时间点排除
      if (sched.time && d === todayStr) {
        const [h, m] = sched.time.split(':').map(Number);
        const eventTime = new Date(d + 'T00:00:00');
        eventTime.setHours(h, m, 0, 0);
        if (eventTime <= now) return;
      }
      allUpcoming.push({
        id: sched.id,
        title: sched.title,
        date: d,
        time: sched.time,
        endTime: sched.endTime,
        note: sched.note,
        color: sched.color,
        _datetime: d + (sched.time ? ' ' + sched.time : ' 23:59'),
      });
    });
  });

  // 排序，取前 limit 条
  allUpcoming.sort((a, b) => a._datetime.localeCompare(b._datetime));
  return allUpcoming.slice(0, limit || 10);
}

/** 获取最近一个日程及其倒计时 */
function getNextSchedule() {
  const upcoming = getUpcomingSchedules(1);
  if (upcoming.length === 0) return null;

  const next = upcoming[0];
  const now = new Date();
  const [h, m] = (next.time || '23:59').split(':').map(Number);
  const eventDate = new Date(next.date + 'T00:00:00');
  eventDate.setHours(h, m, 0, 0);

  const diffMs = eventDate - now;
  if (diffMs <= 0) return null;

  const diffMin = Math.floor(diffMs / 60000);
  const days = Math.floor(diffMin / 1440);
  const hours = Math.floor((diffMin % 1440) / 60);
  const minutes = diffMin % 60;

  return {
    ...next,
    countdown: { days, hours, minutes, totalMinutes: diffMin },
  };
}

// ---- 提醒逻辑 ----

let notifiedSet = new Set(); // 已通知的 occurrence key

function checkAndNotify() {
  if (notificationPermission !== 'granted') return;

  const now = new Date();
  const todayStr = fmtDateStr(now);
  const future = new Date(now);
  future.setDate(future.getDate() + 1);
  const futureStr = fmtDateStr(future);

  state.schedules.forEach(sched => {
    if (!sched.time || sched.reminder < 0) return;
    const dates = expandRepeats(sched, todayStr, futureStr);
    dates.forEach(d => {
      const [h, m] = sched.time.split(':').map(Number);
      const eventTime = new Date(d + 'T00:00:00');
      eventTime.setHours(h, m, 0, 0);

      // 提醒时间 = 日程时间 - 提前分钟
      const remindTime = new Date(eventTime.getTime() - sched.reminder * 60000);
      const key = sched.id + '|' + d;

      if (now >= remindTime && now < eventTime && !notifiedSet.has(key)) {
        notifiedSet.add(key);
        // 如果已经到了，不再提醒
        try {
          const bodyParts = [];
          if (d === todayStr) bodyParts.push('今天');
          else bodyParts.push(d);
          if (sched.time) bodyParts.push(sched.time);
          if (sched.note) bodyParts.push(sched.note);
          new Notification(sched.title, {
            body: bodyParts.join(' · '),
            icon: 'icon-192.png',
            tag: key,
          });
        } catch(e) { /* ignore */ }
      }
    });
  });

  // 清理旧通知记录（超过24小时的）
  const cutoff = new Date(now.getTime() - 86400000);
  // 简单策略：每天午夜清理
  if (now.getHours() === 0 && now.getMinutes() < 2) {
    notifiedSet.clear();
  }
}

// ---- 工具 ----

function fmtDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 获取农历日期字符串（如 "腊月三十"） */
function getLunarDateStr(dateStr) {
  if (typeof Lunar === 'undefined') return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    const lunar = Lunar.fromDate(d);
    let name = '';
    const m = lunar.getMonth();
    if (m >= 1 && m <= 12) {
      name = LUNAR_MONTH_NAMES[m - 1] + '月';
    }
    const day = lunar.getDay();
    name += (LUNAR_DAY_NAMES[day] || day);
    return name;
  } catch(e) { return ''; }
}

/** 获取某天的节日/节气（公历+农历合并） */
function getHoliday(dateStr) {
  if (typeof Lunar === 'undefined' || typeof Solar === 'undefined') return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    const solar = Solar.fromYmd(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const lunar = solar.getLunar();
    const festivals = [];
    // 公历节日
    const sf = solar.getFestivals();
    if (sf && sf.length) festivals.push(...sf);
    // 农历节日
    const lf = lunar.getFestivals();
    if (lf && lf.length) festivals.push(...lf);
    // 节气
    const jq = lunar.getJieQi();
    if (jq) festivals.push(jq);
    return festivals.join(' · ');
  } catch(e) { return ''; }
}
