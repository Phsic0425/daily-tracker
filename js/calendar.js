/* ============================================
   calendar.js — 日历 UI 渲染 & 日程弹窗
   ============================================ */

// ---- 日历渲染 ----

function renderCalendar(year, month) {
  var container = document.getElementById('calendarGrid');
  if (!container) return;

  var todayStr = today();
  var firstDay = new Date(year, month - 1, 1);
  var daysInMonth = new Date(year, month, 0).getDate();
  var startDow = firstDay.getDay(); // 0=周日

  var dateMap = getScheduledDatesInMonth(year, month);
  var bgMap = getBackgroundDatesInMonth(year, month);

  var monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  document.getElementById('calendarTitle').textContent = year + '年 ' + monthNames[month - 1];

  var totalSchedDays = Object.keys(dateMap).length;
  document.getElementById('calendarCount').textContent = totalSchedDays > 0 ? totalSchedDays + '天有日程' : '';

  // 设置开关
  var showLunar = settings.showLunar !== false;
  var showHolidays = settings.showHolidays !== false;
  var showLabels = settings.showScheduleLabels !== false;
  var compactMode = settings.compactSchedule === true;

  var parts = [];

  // 星期头 — 周末用不同颜色
  var weeks = ['日','一','二','三','四','五','六'];
  for (var wi = 0; wi < 7; wi++) {
    var wCls = 'cal-weekday';
    if (wi === 0 || wi === 6) wCls += ' weekend';
    parts.push('<div class="' + wCls + '">' + weeks[wi] + '</div>');
  }

  // 空白填充（上月末尾）
  for (var i = 0; i < startDow; i++) {
    parts.push('<div class="cal-day empty"></div>');
  }

  // 日期格
  for (var d = 1; d <= daysInMonth; d++) {
    var mm = String(month).padStart(2, '0');
    var dd = String(d).padStart(2, '0');
    var dateStr = year + '-' + mm + '-' + dd;
    var isToday = dateStr === todayStr;
    var isSelected = dateStr === scheduleSelectedDate;
    var items = dateMap[dateStr] || [];

    // 计算星期几 (0=周日, 6=周六)
    var dow = (startDow + d - 1) % 7;

    var cls = 'cal-day';
    if (isToday) cls += ' today';
    if (isSelected) cls += ' selected';
    if (dow === 0 || dow === 6) cls += ' weekend';

    parts.push('<div class="' + cls + '" data-date="' + dateStr + '" data-action="select-date">');

    // 背景标签（顶部）
    var bgItems = bgMap[dateStr] || [];
    if (bgItems.length > 0) {
      parts.push('<span class="cal-bg-labels">');
      for (var bi = 0; bi < bgItems.length; bi++) {
        var bgItem = bgItems[bi];
        parts.push('<span class="cal-bg-label" style="background:' + bgItem.color + '20;color:' + bgItem.color + '">' + bgItem.label + '</span>');
      }
      parts.push('</span>');
    }

    // 日期数字
    parts.push('<span class="cal-day-num">' + d + '</span>');

    // 农历（根据设置）
    if (showLunar) {
      var lunarStr = getLunarDateStr(dateStr);
      if (lunarStr) {
        parts.push('<span class="cal-lunar">' + lunarStr + '</span>');
      }
    }

    // 节假日/节气（根据设置）
    if (showHolidays) {
      var holidayStr = getHoliday(dateStr);
      if (holidayStr) {
        parts.push('<span class="cal-holiday">' + holidayStr + '</span>');
      }
    }

    // 日程标签
    if (items.length > 0) {
      if (showLabels) {
        parts.push('<span class="cal-labels">');
        var maxShow = compactMode ? 1 : (items.length > 2 ? 2 : items.length);
        for (var si = 0; si < maxShow; si++) {
          var item = items[si];
          parts.push('<span class="cal-label" style="background:' + item.color + '15;color:' + item.color + '">' + item.label + '</span>');
        }
        if (items.length > maxShow) {
          parts.push('<span class="cal-dot-more">+' + (items.length - maxShow) + '</span>');
        }
        parts.push('</span>');
      } else {
        // 仅显示彩色圆点
        parts.push('<span class="cal-dots">');
        var dotMax = compactMode ? 3 : 5;
        for (var di = 0; di < items.length && di < dotMax; di++) {
          parts.push('<span class="cal-dot" style="background:' + items[di].color + '"></span>');
        }
        if (items.length > dotMax) {
          parts.push('<span class="cal-dot-more">+' + (items.length - dotMax) + '</span>');
        }
        parts.push('</span>');
      }
    } else {
      parts.push('<span class="cal-labels"></span>');
    }

    parts.push('</div>');
  }

  container.innerHTML = parts.join('');
}

// ---- 选中日期详情 ----

function renderDayDetail(dateStr) {
  const container = document.getElementById('scheduleDayDetail');
  if (!container) return;

  const schedules = getSchedulesForDate(dateStr);

  // 日期标题
  const d = new Date(dateStr + 'T00:00:00');
  const weekDay = WEEKDAY_NAMES[d.getDay()];
  const lunarStr = getLunarDateStr(dateStr);
  let titleHtml = `${fmtDateShort(dateStr)} 周${weekDay}`;
  if (lunarStr) titleHtml += ` · ${lunarStr}`;
  document.getElementById('dayDetailTitle').textContent = titleHtml;

  if (schedules.length === 0) {
    container.innerHTML = '<p class="empty-hint">这天没有日程，点右下角 + 添加</p>';
    return;
  }

  container.innerHTML = schedules.map(s => {
    const isBg = s.type === 'background';
    const isMultiDay = s.endDate && s.endDate > s.date;
    let timeStr = '';
    if (isBg) {
      timeStr = isMultiDay ? '全天' : '背景';
    } else if (s.time) {
      timeStr = s.time;
      if (s.endTime) timeStr += ' - ' + s.endTime;
    }
    const noteHtml = s.note ? `<div class="sched-note">${escapeHtml(s.note)}</div>` : '';
    const repeatMode = REPEAT_MODES.find(r => r.key === s.repeat.mode);
    const repeatLabel = repeatMode ? repeatMode.icon + ' ' + repeatMode.label : '';

    // 跨天范围 / 下次
    let rangeHtml = '';
    if (isMultiDay) {
      rangeHtml = `<span class="sched-next">${fmtDateShort(s.date)} - ${fmtDateShort(s.endDate)}</span>`;
    } else if (!isBg && s.repeat.mode !== 'once') {
      rangeHtml = `<span class="sched-next">下次: ${(s._occurrences && s._occurrences[1]) ? fmtDateShort(s._occurrences[1]) : '—'}</span>`;
    }

    return `
      <div class="sched-item${isBg ? ' sched-bg-item' : ''}" style="border-left-color:${s.color}" data-id="${s.id}" data-action="edit-schedule">
        <div class="sched-item-top">
          <span class="sched-color-dot" style="background:${s.color}"></span>
          <span class="sched-title">${escapeHtml(s.title)}</span>
          ${timeStr ? `<span class="sched-time">${isBg ? '📅 ' : '🕐 '}${timeStr}</span>` : ''}
        </div>
        ${noteHtml}
        <div class="sched-meta">
          ${!isBg && repeatLabel ? `<span class="sched-repeat">${repeatLabel}</span>` : ''}
          ${rangeHtml}
        </div>
      </div>`;
  }).join('');
}

// ---- 周视图 ----

/** 按时间从早到晚排序（无时间的排最后，再按标题稳定排序） */
function sortSchedulesByTime(list) {
  return list.slice().sort(function(a, b) {
    var ta = a.time || '99:99';
    var tb = b.time || '99:99';
    if (ta !== tb) return ta.localeCompare(tb);
    return (a.title || '').localeCompare(b.title || '');
  });
}

// ---- 即将到来 ----

function renderUpcoming() {
  const container = document.getElementById('upcomingContent');
  const countdownEl = document.getElementById('countdownDisplay');
  if (!container || !countdownEl) return;

  const next = getNextSchedule();

  // 倒计时区域
  if (next) {
    const cd = next.countdown;
    let cdHtml = '';
    if (cd.days > 0) {
      cdHtml = `<span class="cd-num">${cd.days}</span> 天 <span class="cd-num">${cd.hours}</span> 时 <span class="cd-num">${cd.minutes}</span> 分`;
    } else if (cd.hours > 0) {
      cdHtml = `<span class="cd-num">${cd.hours}</span> 时 <span class="cd-num">${cd.minutes}</span> 分`;
    } else {
      cdHtml = `<span class="cd-num">${cd.minutes}</span> 分钟`;
    }
    countdownEl.innerHTML = `
      <div class="cd-event">📌 ${escapeHtml(next.title)}</div>
      <div class="cd-time">${cdHtml}</div>
      <div class="cd-date">${fmtDate(next.date)} ${next.time || ''}</div>`;
  } else {
    countdownEl.innerHTML = '<div class="cd-empty">🎉 暂无待办日程</div>';
  }

  // 近期列表
  const upcoming = getUpcomingSchedules(5);
  if (upcoming.length <= 1) {
    container.innerHTML = '<p class="empty-hint" style="padding:12px">未来一年暂无日程</p>';
    return;
  }

  // 跳过第一个（已在倒计时显示）
  const list = upcoming.slice(1);
  container.innerHTML = list.map(s => `
    <div class="upcoming-item" data-date="${s.date}" data-action="goto-date">
      <span class="sched-color-dot" style="background:${s.color}"></span>
      <span class="upcoming-title">${escapeHtml(s.title)}</span>
      <span class="upcoming-date">${fmtDate(s.date)} ${s.time || ''}</span>
    </div>
  `).join('');
}

// ---- 日程编辑弹窗 ----

function openScheduleModal(dateStr, editId) {
  const modal = document.getElementById('scheduleModal');
  const overlay = document.getElementById('scheduleOverlay');
  modal.classList.add('show');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';

  scheduleEditId = editId || null;

  // 初始化动态表单内容（仅首次）
  initScheduleFormOptions();

  if (editId) {
    // 编辑模式
    const sched = state.schedules.find(s => s.id === editId);
    if (sched) fillScheduleForm(sched);
    document.getElementById('scheduleModalTitle').textContent = '编辑日程';
    document.getElementById('btnDeleteSchedule').style.display = '';
  } else {
    // 新增模式
    resetScheduleForm(dateStr || scheduleSelectedDate);
    document.getElementById('scheduleModalTitle').textContent = '添加日程';
    document.getElementById('btnDeleteSchedule').style.display = 'none';
  }

  renderScheduleType();
}

function closeScheduleModal() {
  document.getElementById('scheduleModal').classList.remove('show');
  document.getElementById('scheduleOverlay').classList.remove('show');
  document.body.style.overflow = '';
  scheduleEditId = null;
}

function resetScheduleForm(dateStr) {
  scheduleFormType = 'event';
  document.getElementById('schedTitle').value = '';
  document.getElementById('schedDate').value = dateStr || today();
  document.getElementById('schedEndDate').value = '';
  document.getElementById('schedTime').value = '';
  document.getElementById('schedEndTime').value = '';
  document.getElementById('schedRepeatMode').value = 'once';
  document.getElementById('schedReminder').value = '15';
  document.getElementById('schedDisplayText').value = '';
  document.getElementById('schedNote').value = '';
  document.getElementById('schedRepeatCount').value = '3';
  document.getElementById('schedRepeatInterval').value = '1';
  document.getElementById('schedRepeatEndDate').value = '';
  document.getElementById('schedLunarMonth').value = '1';
  document.getElementById('schedLunarDay').value = '1';
  document.getElementById('schedLunarLeap').checked = false;
  // 重置星期选择
  document.querySelectorAll('.weekday-check input').forEach(cb => { cb.checked = false; });
  // 重置颜色
  scheduleFormColor = SCHEDULE_COLORS[0];
  document.querySelectorAll('.color-option').forEach((el, i) => {
    el.classList.toggle('selected', i === 0);
  });
  renderScheduleType();
}

// 初始化弹窗动态选项（只执行一次）
let _scheduleFormInited = false;
function initScheduleFormOptions() {
  if (_scheduleFormInited) return;
  _scheduleFormInited = true;

  // 重复模式
  document.getElementById('schedRepeatMode').innerHTML = REPEAT_MODES.map(r =>
    `<option value="${r.key}">${r.icon} ${r.label}</option>`
  ).join('');

  // 提醒选项
  document.getElementById('schedReminder').innerHTML = REMINDER_OPTIONS.map(o =>
    `<option value="${o.value}">${o.label}</option>`
  ).join('');

  // 颜色选择器
  document.getElementById('schedColorPicker').innerHTML = SCHEDULE_COLORS.map((c, i) =>
    `<span class="color-option${i === 0 ? ' selected' : ''}" data-color="${c}" style="background:${c}" data-action="pick-color"></span>`
  ).join('');

  // 星期选择
  document.getElementById('weekdayChecks').innerHTML = WEEKDAY_NAMES.map((name, i) =>
    `<label class="weekday-check"><input type="checkbox" value="${i}"> ${name}</label>`
  ).join('');

  // 农历月份
  document.getElementById('schedLunarMonth').innerHTML = LUNAR_MONTH_NAMES.map((name, i) =>
    `<option value="${i+1}">${name}月</option>`
  ).join('');

  // 农历日期
  document.getElementById('schedLunarDay').innerHTML = LUNAR_DAY_NAMES.slice(1).map((name, i) =>
    `<option value="${i+1}">${name}</option>`
  ).join('');
}

function fillScheduleForm(sched) {
  scheduleFormType = sched.type || 'event';
  document.getElementById('schedTitle').value = sched.title;
  document.getElementById('schedDate').value = sched.date;
  document.getElementById('schedEndDate').value = sched.endDate || '';
  document.getElementById('schedTime').value = sched.time || '';
  document.getElementById('schedEndTime').value = sched.endTime || '';
  document.getElementById('schedRepeatMode').value = sched.repeat.mode;
  document.getElementById('schedReminder').value = String(sched.reminder != null ? sched.reminder : 15);
  document.getElementById('schedDisplayText').value = sched.displayText || '';
  document.getElementById('schedNote').value = sched.note || '';
  document.getElementById('schedRepeatCount').value = sched.repeat.count || 3;
  document.getElementById('schedRepeatInterval').value = sched.repeat.interval || 1;
  document.getElementById('schedRepeatEndDate').value = sched.repeat.endDate || '';
  document.getElementById('schedLunarMonth').value = sched.repeat.lunarMonth || 1;
  document.getElementById('schedLunarDay').value = sched.repeat.lunarDay || 1;
  document.getElementById('schedLunarLeap').checked = sched.repeat.lunarLeap || false;
  // 星期
  document.querySelectorAll('.weekday-check input').forEach(cb => {
    cb.checked = (sched.repeat.weekdays || []).includes(parseInt(cb.value));
  });
  // 颜色
  scheduleFormColor = sched.color || '#6366F1';
  document.querySelectorAll('.color-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.color === scheduleFormColor);
  });
  renderScheduleType();
}

let scheduleFormColor = '#6366F1';
let scheduleFormType = 'event'; // 当前表单类型：'event' | 'background'

function setScheduleColor(color) {
  scheduleFormColor = color;
  document.querySelectorAll('.color-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.color === color);
  });
}

function renderRepeatConfig() {
  const mode = document.getElementById('schedRepeatMode').value;
  const groups = {
    'repeatCountGroup': ['custom'],
    'repeatIntervalGroup': ['daily', 'weekly', 'monthly', 'custom'],
    'repeatEndDateGroup': ['daily', 'weekly', 'monthly', 'yearly-solar', 'yearly-lunar'],
    'repeatWeekdaysGroup': ['weekly'],
    'repeatLunarGroup': ['yearly-lunar'],
  };

  Object.entries(groups).forEach(([groupId, modes]) => {
    const el = document.getElementById(groupId);
    if (el) el.style.display = modes.includes(mode) ? '' : 'none';
  });
}

// 按类型显隐表单区块
function renderScheduleType() {
  const isEvent = scheduleFormType === 'event';
  document.querySelectorAll('.sched-type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === scheduleFormType);
  });
  document.getElementById('eventTimeRow').style.display = isEvent ? '' : 'none';
  document.getElementById('reminderSection').style.display = isEvent ? '' : 'none';

  // 重复区：仅事件类且未跨天时显示
  const endDate = document.getElementById('schedEndDate').value;
  const isMultiDay = endDate && endDate > document.getElementById('schedDate').value;
  document.getElementById('repeatSection').style.display = (isEvent && !isMultiDay) ? '' : 'none';

  renderRepeatConfig();
}

// ---- 保存/删除 ----

function handleSaveSchedule() {
  const title = document.getElementById('schedTitle').value.trim();
  const type = scheduleFormType;
  const date = document.getElementById('schedDate').value;
  const endDate = document.getElementById('schedEndDate').value;
  const time = document.getElementById('schedTime').value;
  const endTime = document.getElementById('schedEndTime').value;
  const repeatMode = document.getElementById('schedRepeatMode').value;
  const reminder = parseInt(document.getElementById('schedReminder').value) || 15;
  const note = document.getElementById('schedNote').value.trim();

  if (!title) { showToast('请输入日程标题'); return; }
  if (!date) { showToast('请选择日期'); return; }
  if (endDate && endDate < date) { showToast('结束日期不能早于开始日期'); return; }

  // 背景类无时间、无重复；跨天（含事件）不重复
  const isBackground = type === 'background';
  const isMultiDay = endDate && endDate > date;
  const finalTime = isBackground ? '' : time;
  const finalEndTime = isBackground ? '' : endTime;
  const finalRepeatMode = (isBackground || isMultiDay) ? 'once' : repeatMode;

  const repeatData = {
    mode: finalRepeatMode,
    count: parseInt(document.getElementById('schedRepeatCount').value) || 0,
    interval: parseInt(document.getElementById('schedRepeatInterval').value) || 1,
    endDate: document.getElementById('schedRepeatEndDate').value || '',
    weekdays: [],
    lunarMonth: parseInt(document.getElementById('schedLunarMonth').value) || 1,
    lunarDay: parseInt(document.getElementById('schedLunarDay').value) || 1,
    lunarLeap: document.getElementById('schedLunarLeap').checked,
  };

  if (finalRepeatMode === 'weekly') {
    document.querySelectorAll('.weekday-check input:checked').forEach(cb => {
      repeatData.weekdays.push(parseInt(cb.value));
    });
    if (repeatData.weekdays.length === 0) {
      showToast('请至少选择一个星期'); return;
    }
  }

  const displayText = document.getElementById('schedDisplayText').value.trim();

  const data = {
    title, type,
    date, endDate,
    time: finalTime, endTime: finalEndTime,
    displayText,
    repeat: repeatData,
    reminder: isBackground ? -1 : reminder,
    note,
    color: scheduleFormColor,
  };

  if (scheduleEditId) {
    updateSchedule(scheduleEditId, data);
    showToast('日程已更新 ✓');
  } else {
    addSchedule(data);
    showToast('日程已添加 ✓');
  }

  closeScheduleModal();
  renderScheduleView();
}

function handleDeleteSchedule() {
  if (!scheduleEditId) return;
  if (!confirm('确定要删除这个日程吗？')) return;
  deleteSchedule(scheduleEditId);
  closeScheduleModal();
  showToast('日程已删除');
  renderScheduleView();
}

// ---- 日程导出 ----

function exportSchedulesJSON() {
  if (!state.schedules || state.schedules.length === 0) {
    showToast('没有可导出的日程');
    return;
  }
  const data = JSON.stringify(state.schedules, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ts = today();
  a.download = `schedules-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('💾 日程已导出为 JSON');
}

function exportCalendarImage() {
  const year = scheduleViewMonth.year;
  const month = scheduleViewMonth.month;
  const dpr = 2; // 固定2x保证打印清晰
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // ---- 布局常量 ----
  const margin = 30;
  const calW = 600;
  const cellW = Math.floor(calW / 7);
  const calW2 = cellW * 7; // 实际日历宽度
  const cellH = 66;
  const headerH = 28;
  const weekH = 26;
  const titleH = 60;
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDow = firstDay.getDay();
  const rows = Math.ceil((startDow + daysInMonth) / 7);
  const calAreaH = weekH + rows * cellH;

  // 收集月度日程
  const dateMap = getScheduledDatesInMonth(year, month);
  const allSchedules = [];
  state.schedules.forEach(s => {
    if (s.type === 'background') return; // 背景类不进入月度导出列表
    const dates = expandRepeats(s, `${year}-${String(month).padStart(2,'0')}-01`,
      `${year}-${String(month).padStart(2,'0')}-${daysInMonth}`);
    dates.forEach(d => allSchedules.push({ date: d, title: s.title, time: s.time, color: s.color, note: s.note }));
  });
  // 按日期分组
  const schedByDate = {};
  allSchedules.forEach(s => {
    if (!schedByDate[s.date]) schedByDate[s.date] = [];
    schedByDate[s.date].push(s);
  });
  // 日程列表所需高度
  let schedLines = 0;
  Object.values(schedByDate).forEach(arr => { schedLines += arr.length + 1; }); // +1 for date header
  const schedAreaH = schedLines > 0 ? 30 + schedLines * 20 + 20 : 0;

  const totalW = margin * 2 + calW2;
  const totalH = margin + titleH + calAreaH + schedAreaH + margin;

  canvas.width = totalW * dpr;
  canvas.height = totalH * dpr;
  ctx.scale(dpr, dpr);

  // ---- 绘制背景 ----
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, totalW, totalH);

  // ---- 标题 ----
  const monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 28px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${year}年 ${monthNames[month-1]}`, totalW/2, margin + 36);

  // 副标题
  ctx.fillStyle = '#64748B';
  ctx.font = '13px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillText('日程月历 · 打印版', totalW/2, margin + 54);

  // ---- 日历主体 ----
  const calX = margin;
  const calY = margin + titleH;

  // 日历背景
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(calX, calY, calW2, calAreaH);

  // 星期头
  const weekNames = ['日','一','二','三','四','五','六'];
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 13px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  weekNames.forEach((w, i) => {
    ctx.fillText(w, calX + cellW * i + cellW/2, calY + 18);
  });

  // 分隔线
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(calX, calY + weekH);
  ctx.lineTo(calX + calW2, calY + weekH);
  ctx.stroke();

  // 日期格
  const todayStr = today();
  for (let d = 1; d <= daysInMonth; d++) {
    const col = (startDow + d - 1) % 7;
    const row = Math.floor((startDow + d - 1) / 7);
    const x = calX + col * cellW;
    const y = calY + weekH + row * cellH;
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

    // 今天高亮
    if (dateStr === todayStr) {
      ctx.fillStyle = '#EEF2FF';
      ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
      // 蓝色圆点标记
      ctx.fillStyle = '#6366F1';
      ctx.beginPath();
      ctx.arc(x + cellW/2, y + 12, 3, 0, Math.PI*2);
      ctx.fill();
    }

    // 日期数字
    ctx.fillStyle = '#0F172A';
    ctx.font = '13px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(d), x + cellW/2, y + 28);

    // 日程文字标签
    const items = dateMap[dateStr] || [];
    items.slice(0, 2).forEach((item, ii) => {
      ctx.fillStyle = item.color + '20';
      ctx.fillRect(x + 3, y + 33 + ii * 14, cellW - 6, 12);
      ctx.fillStyle = item.color;
      ctx.font = 'bold 8px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, x + cellW/2, y + 42 + ii * 14);
    });

    // 网格线
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, cellW, cellH);
  }

  // ---- 月度日程列表 ----
  if (schedLines > 0) {
    const listY = calY + calAreaH + 24;
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 16px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('📋 本月日程', calX, listY);

    let lineY = listY + 24;
    const sortedDates = Object.keys(schedByDate).sort();
    sortedDates.forEach(dateStr => {
      // 日期标题
      const d = new Date(dateStr + 'T00:00:00');
      const wd = WEEKDAY_NAMES[d.getDay()];
      const lunar = getLunarDateStr(dateStr);
      let dateHeader = `${fmtDateShort(dateStr)} 周${wd}`;
      if (lunar) dateHeader += ` · ${lunar}`;

      ctx.fillStyle = '#475569';
      ctx.font = 'bold 12px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillText(dateHeader, calX + 8, lineY);
      lineY += 20;

      schedByDate[dateStr].forEach(s => {
        // 彩色圆点
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(calX + 14, lineY - 6, 4, 0, Math.PI*2);
        ctx.fill();
        // 标题
        ctx.fillStyle = '#0F172A';
        ctx.font = '12px "PingFang SC","Microsoft YaHei",sans-serif';
        ctx.fillText(s.title, calX + 24, lineY);
        // 时间
        if (s.time) {
          ctx.fillStyle = '#64748B';
          ctx.font = '11px "PingFang SC","Microsoft YaHei",sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(s.time, calX + calW2 - 8, lineY);
          ctx.textAlign = 'left';
        }
        // 备注
        if (s.note) {
          ctx.fillStyle = '#94A3B8';
          ctx.font = '10px "PingFang SC","Microsoft YaHei",sans-serif';
          ctx.fillText(s.note, calX + 30, lineY);
        }
        lineY += 20;
      });
      lineY += 4; // 日期分组间距
    });
  }

  // ---- 页脚 ----
  ctx.fillStyle = '#94A3B8';
  ctx.font = '10px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`导出日期: ${today()}  ·  日常记账`, totalW/2, totalH - 8);

  // ---- 导出 ----
  canvas.toBlob(blob => {
    if (!blob) { showToast('导出图片失败'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `日程-${year}年${month}月.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('🖼 日历图片已导出');
  }, 'image/png');
}
