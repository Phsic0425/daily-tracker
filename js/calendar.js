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
  var startDow = firstDay.getDay();

  var dateMap = getScheduledDatesInMonth(year, month);

  var monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  document.getElementById('calendarTitle').textContent = year + '年 ' + monthNames[month - 1];

  var totalSchedDays = Object.keys(dateMap).length;
  document.getElementById('calendarCount').textContent = totalSchedDays > 0 ? totalSchedDays + '天有日程' : '';

  // 用数组拼接，最后一次性 innerHTML
  var parts = [];

  // 星期头
  var weeks = ['日','一','二','三','四','五','六'];
  for (var wi = 0; wi < 7; wi++) {
    parts.push('<div class="cal-weekday">' + weeks[wi] + '</div>');
  }

  // 空白填充
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

    var cls = 'cal-day';
    if (isToday) cls += ' today';
    if (isSelected) cls += ' selected';

    parts.push('<div class="' + cls + '" data-date="' + dateStr + '" data-action="select-date">');
    parts.push('<span class="cal-day-num">' + d + '</span>');

    // 农历（始终显示）
    var lunarStr = getLunarDateStr(dateStr);
    if (lunarStr) {
      parts.push('<span class="cal-lunar">' + lunarStr + '</span>');
    }

    // 日程标签（始终显示文字，最多2条）
    if (items.length > 0) {
      parts.push('<span class="cal-labels">');
      var maxShow = items.length > 2 ? 2 : items.length;
      for (var si = 0; si < maxShow; si++) {
        var item = items[si];
        parts.push('<span class="cal-label" style="background:' + item.color + '15;color:' + item.color + '">' + item.label + '</span>');
      }
      if (items.length > 2) {
        parts.push('<span class="cal-dot-more">+' + (items.length - 2) + '</span>');
      }
      parts.push('</span>');
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
    let timeStr = '';
    if (s.time) {
      timeStr = s.time;
      if (s.endTime) timeStr += ' - ' + s.endTime;
    }
    const noteHtml = s.note ? `<div class="sched-note">${escapeHtml(s.note)}</div>` : '';
    const repeatMode = REPEAT_MODES.find(r => r.key === s.repeat.mode);
    const repeatLabel = repeatMode ? repeatMode.icon + ' ' + repeatMode.label : '';

    return `
      <div class="sched-item" style="border-left-color:${s.color}" data-id="${s.id}" data-action="edit-schedule">
        <div class="sched-item-top">
          <span class="sched-color-dot" style="background:${s.color}"></span>
          <span class="sched-title">${escapeHtml(s.title)}</span>
          ${timeStr ? `<span class="sched-time">🕐 ${timeStr}</span>` : ''}
        </div>
        ${noteHtml}
        <div class="sched-meta">
          <span class="sched-repeat">${repeatLabel}</span>
          ${s.repeat.mode !== 'once' ? `<span class="sched-next">下次: ${(s._occurrences && s._occurrences[1]) ? fmtDateShort(s._occurrences[1]) : '—'}</span>` : ''}
        </div>
      </div>`;
  }).join('');
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

  renderRepeatConfig();
}

function closeScheduleModal() {
  document.getElementById('scheduleModal').classList.remove('show');
  document.getElementById('scheduleOverlay').classList.remove('show');
  document.body.style.overflow = '';
  scheduleEditId = null;
}

function resetScheduleForm(dateStr) {
  document.getElementById('schedTitle').value = '';
  document.getElementById('schedDate').value = dateStr || today();
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
  document.getElementById('schedTitle').value = sched.title;
  document.getElementById('schedDate').value = sched.date;
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
}

let scheduleFormColor = '#6366F1';

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

// ---- 保存/删除 ----

function handleSaveSchedule() {
  const title = document.getElementById('schedTitle').value.trim();
  const date = document.getElementById('schedDate').value;
  const time = document.getElementById('schedTime').value;
  const endTime = document.getElementById('schedEndTime').value;
  const repeatMode = document.getElementById('schedRepeatMode').value;
  const reminder = parseInt(document.getElementById('schedReminder').value) || 15;
  const note = document.getElementById('schedNote').value.trim();

  if (!title) { showToast('请输入日程标题'); return; }
  if (!date) { showToast('请选择日期'); return; }

  const repeatData = {
    mode: repeatMode,
    count: parseInt(document.getElementById('schedRepeatCount').value) || 0,
    interval: parseInt(document.getElementById('schedRepeatInterval').value) || 1,
    endDate: document.getElementById('schedRepeatEndDate').value || '',
    weekdays: [],
    lunarMonth: parseInt(document.getElementById('schedLunarMonth').value) || 1,
    lunarDay: parseInt(document.getElementById('schedLunarDay').value) || 1,
    lunarLeap: document.getElementById('schedLunarLeap').checked,
  };

  if (repeatMode === 'weekly') {
    document.querySelectorAll('.weekday-check input:checked').forEach(cb => {
      repeatData.weekdays.push(parseInt(cb.value));
    });
    if (repeatData.weekdays.length === 0) {
      showToast('请至少选择一个星期'); return;
    }
  }

  const displayText = document.getElementById('schedDisplayText').value.trim();

  const data = {
    title, date, time, endTime,
    displayText,
    repeat: repeatData,
    reminder, note,
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
