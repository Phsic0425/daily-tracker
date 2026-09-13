/* ============================================
   timetable.js — 课表时间轴视图 & 课程/周数/节次弹窗
   ============================================ */

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

/** 返回 dateStr 所在周的周一（课表专用：周一到周日） */
function getMondayOfWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=周日 .. 6=周六
  const diff = (day === 0) ? -6 : (1 - day);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}

// ========== 课表视图渲染 ==========

// 分段时间轴映射：折叠节次（如午休）压缩为固定高度，其余按比例缩放
function buildMinuteToPixel(minMin, maxMin, periods, pxPerMin) {
  const COLLAPSED_PX = 22;
  const merged = [];
  periods.filter(p => p.collapsed).map(p => [timeToMinutes(p.start), timeToMinutes(p.end)])
    .filter(([s, e]) => e > s && e > minMin && s < maxMin)
    .map(([s, e]) => [Math.max(s, minMin), Math.min(e, maxMin)])
    .sort((a, b) => a[0] - b[0])
    .forEach(([s, e]) => {
      if (merged.length && s <= merged[merged.length - 1][1]) {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
      } else {
        merged.push([s, e]);
      }
    });

  const marks = [];
  let px = 0, cursor = minMin;
  marks.push({ min: cursor, px });
  merged.forEach(([s, e]) => {
    px += (s - cursor) * pxPerMin;
    marks.push({ min: s, px });
    px += COLLAPSED_PX;
    marks.push({ min: e, px });
    cursor = e;
  });
  px += (maxMin - cursor) * pxPerMin;
  marks.push({ min: maxMin, px });

  function minuteToPixel(min) {
    const m = Math.max(minMin, Math.min(maxMin, min));
    for (let i = 0; i < marks.length - 1; i++) {
      const a = marks[i], b = marks[i + 1];
      if (m >= a.min && m <= b.min) {
        if (b.min === a.min) return a.px;
        return a.px + (m - a.min) / (b.min - a.min) * (b.px - a.px);
      }
    }
    return px;
  }
  return { minuteToPixel, totalPx: px };
}

// 当前时间红线：记录最近一次渲染的时间轴映射，供计时器定位刷新
let _courseNowLineInfo = null;
let _courseNowLineTimer = null;

function updateCourseNowLinePosition() {
  const line = document.getElementById('courseNowLine');
  if (!line || !_courseNowLineInfo) return;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const { minuteToPixel, minMin, maxMin } = _courseNowLineInfo;
  if (nowMin < minMin || nowMin > maxMin) { line.style.display = 'none'; return; }
  line.style.display = '';
  line.style.top = minuteToPixel(nowMin) + 'px';
  line.innerHTML = '<span class="course-now-time">' + minutesToTime(nowMin) + '</span>';
}

function startCourseNowLineTimer() {
  if (_courseNowLineTimer) return;
  _courseNowLineTimer = setInterval(updateCourseNowLinePosition, 30000);
}

function renderCourseView() {
  const monday = getMondayOfWeek(scheduleSelectedDate);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const mondayStr = fmtDateStr(monday);
  const weekNum = getWeekNumberForDate(mondayStr);

  const titleEl = document.getElementById('calendarTitle');
  if (titleEl) titleEl.textContent = fmtDateShort(mondayStr) + ' - ' + fmtDateShort(fmtDateStr(sunday));
  const countEl = document.getElementById('calendarCount');
  if (countEl) countEl.textContent = '';
  const weekLabelEl = document.getElementById('courseWeekLabel');
  if (weekLabelEl) weekLabelEl.textContent = '第 ' + weekNum + ' 周';

  renderCourseGrid(weekNum, monday);
}

function renderCourseGrid(weekNum, monday) {
  const wrap = document.getElementById('courseGrid');
  if (!wrap) return;

  const periods = state.courseSchedule.periods;
  const todayStr = today();

  // 计算时间轴范围（覆盖所有节次 + 本周日程事件时间，最小 6:00-22:00）
  let minMin = 6 * 60, maxMin = 22 * 60;
  periods.forEach(p => {
    minMin = Math.min(minMin, Math.floor(timeToMinutes(p.start) / 60) * 60);
    maxMin = Math.max(maxMin, Math.ceil(timeToMinutes(p.end) / 60) * 60);
  });

  const dayDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dayDates.push(fmtDateStr(d));
  }

  // 提前扫一遍本周日程事件时间，扩展轴范围
  const daySchedules = dayDates.map(dateStr => {
    const list = (typeof getSchedulesForDate === 'function') ? getSchedulesForDate(dateStr) : [];
    return list.filter(s => s.type === 'event' && s.time);
  });
  daySchedules.forEach(list => {
    list.forEach(s => {
      const sMin = timeToMinutes(s.time);
      const eMin = s.endTime ? timeToMinutes(s.endTime) : sMin + 30;
      minMin = Math.min(minMin, Math.floor(sMin / 60) * 60);
      maxMin = Math.max(maxMin, Math.ceil(eMin / 60) * 60);
    });
  });

  const PX_PER_MIN = 1.1 * (settings.courseScaleY || 1);
  const { minuteToPixel, totalPx: totalHeight } = buildMinuteToPixel(minMin, maxMin, periods, PX_PER_MIN);
  _courseNowLineInfo = { minuteToPixel, minMin, maxMin };
  const byDay = getCoursesForWeek(weekNum);

  // 同一天内时间重叠的块（课程/日程）并排显示，而不是互相盖住
  function layoutOverlaps(items) {
    const n = items.length;
    const parent = items.map((_, i) => i);
    function find(x) { while (parent[x] !== x) x = parent[x]; return x; }
    function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (items[i].start < items[j].end && items[j].start < items[i].end) union(i, j);
      }
    }
    const clusters = {};
    items.forEach((it, idx) => {
      const root = find(idx);
      (clusters[root] = clusters[root] || []).push(idx);
    });
    Object.values(clusters).forEach(idxs => {
      idxs.sort((a, b) => items[a].start - items[b].start);
      const columnsEnd = [];
      idxs.forEach(idx => {
        const it = items[idx];
        let placed = false;
        for (let c = 0; c < columnsEnd.length; c++) {
          if (columnsEnd[c] <= it.start) {
            it._col = c;
            columnsEnd[c] = it.end;
            placed = true;
            break;
          }
        }
        if (!placed) {
          it._col = columnsEnd.length;
          columnsEnd.push(it.end);
        }
      });
      idxs.forEach(idx => { items[idx]._totalCols = columnsEnd.length; });
    });
    return items;
  }

  // ---- 表头 ----
  let headerHtml = '<div class="course-col-axis"></div>';
  dayDates.forEach((dateStr, i) => {
    const d = new Date(dateStr + 'T00:00:00');
    const isToday = dateStr === todayStr;
    headerHtml += '<div class="course-col-head' + (isToday ? ' today' : '') + '">' +
      '<span class="course-col-weekday">' + WEEKDAY_NAMES_MON_START[i] + '</span>' +
      '<span class="course-col-date">' + (d.getMonth() + 1) + '/' + d.getDate() + '</span>' +
      '</div>';
  });

  // ---- 时间轴标签（每半小时一个刻度） ----
  let axisHtml = '';
  for (let m = minMin; m <= maxMin; m += 30) {
    const top = minuteToPixel(m);
    const isHalf = (m % 60) !== 0;
    axisHtml += '<div class="course-axis-label' + (isHalf ? ' half' : '') + '" style="top:' + top + 'px">' + minutesToTime(m) + '</div>';
  }
  // 有自定义名称的节次（如早自习）额外标注名称
  periods.forEach((p, i) => {
    if (!p.name) return;
    const top = minuteToPixel(timeToMinutes(p.start));
    axisHtml += '<div class="course-axis-label course-axis-period-name" style="top:' + top + 'px">' + escapeHtml(p.name) + '</div>';
  });

  // ---- 每日课程/日程列 ----
  let bodyHtml = '<div class="course-now-line" id="courseNowLine" style="display:none"></div>' +
    '<div class="course-col-axis" style="position:relative">' + axisHtml + '</div>';
  dayDates.forEach((dateStr, i) => {
    const weekday = i + 1; // 1=周一 .. 7=周日
    const courses = byDay[weekday] || [];
    const items = [];

    courses.forEach(c => {
      const p1 = periods[c.startPeriod - 1];
      const p2 = periods[c.endPeriod - 1];
      if (!p1 || !p2) return;
      items.push({
        start: timeToMinutes(p1.start),
        end: timeToMinutes(p2.end),
        html:
          '<div class="course-block-name">' + escapeHtml(c.name) + '</div>' +
          '<div class="course-block-time">' + p1.start + '-' + p2.end + '</div>' +
          (c.location ? '<div class="course-block-loc">📍' + escapeHtml(c.location) + '</div>' : '') +
          '<div class="course-block-weeks">第' + escapeHtml(formatWeeksText(c.weeks)) + '周</div>',
        className: 'course-block' + (c.active ? '' : ' dimmed'),
        style: 'background:' + c.color,
        dataAttrs: 'data-action="edit-course" data-id="' + c.id + '"',
      });
    });

    (daySchedules[i] || []).forEach(s => {
      const sMin = timeToMinutes(s.time);
      const eMin = s.endTime ? timeToMinutes(s.endTime) : sMin + 30;
      items.push({
        start: sMin,
        end: eMin,
        html:
          '<div class="course-block-name">🔔 ' + escapeHtml(s.title) + '</div>' +
          '<div class="course-block-time">' + s.time + (s.endTime ? '-' + s.endTime : '') + '</div>',
        className: 'course-block sched-block',
        style: 'border-left:3px solid ' + s.color,
        dataAttrs: 'data-action="edit-schedule-in-course" data-id="' + s.id + '" data-date="' + dateStr + '"',
      });
    });

    layoutOverlaps(items);

    let colHtml = '';
    items.forEach(it => {
      const top = (it.start - minMin) * PX_PER_MIN;
      const height = (it.end - it.start) * PX_PER_MIN;
      const totalCols = it._totalCols || 1;
      const col = it._col || 0;
      const widthPct = 100 / totalCols;
      const leftPct = col * widthPct;
      colHtml += '<div class="' + it.className + '" ' +
        'style="top:' + top + 'px;height:' + Math.max(height, 20) + 'px;' + it.style + ';' +
        'left:calc(' + leftPct + '% + 2px);width:calc(' + widthPct + '% - 4px)" ' +
        it.dataAttrs + '>' + it.html + '</div>';
    });

    const isToday = dateStr === todayStr;
    bodyHtml += '<div class="course-col-body' + (isToday ? ' today' : '') + '" style="height:' + totalHeight + 'px">' + colHtml + '</div>';
  });

  wrap.innerHTML =
    '<div class="course-grid-header">' + headerHtml + '</div>' +
    '<div class="course-grid-body" style="height:' + totalHeight + 'px">' + bodyHtml + '</div>';

  updateCourseNowLinePosition();
  startCourseNowLineTimer();
}

// ========== 课程编辑弹窗 ==========

let courseEditId = null;
let courseFormColor = SCHEDULE_COLORS[0];

function openCourseModal(editId) {
  courseEditId = editId || null;
  initCourseFormOptions();

  const modal = document.getElementById('courseModal');
  const overlay = document.getElementById('courseOverlay');
  modal.classList.add('show');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';

  if (editId) {
    const course = getCourseById(editId);
    document.getElementById('courseModalTitle').textContent = '编辑课程';
    document.getElementById('btnDeleteCourse').style.display = '';
    fillCourseForm(course);
  } else {
    document.getElementById('courseModalTitle').textContent = '添加课程';
    document.getElementById('btnDeleteCourse').style.display = 'none';
    resetCourseForm();
  }
}

function closeCourseModal() {
  document.getElementById('courseModal').classList.remove('show');
  document.getElementById('courseOverlay').classList.remove('show');
  document.body.style.overflow = '';
  courseEditId = null;
}

let _courseFormInited = false;
function initCourseFormOptions() {
  if (_courseFormInited) return;
  _courseFormInited = true;

  document.getElementById('courseWeekdayChecks').innerHTML = WEEKDAY_NAMES_MON_START.map((name, i) =>
    `<label class="weekday-check"><input type="checkbox" value="${i + 1}"> 周${name}</label>`
  ).join('');

  document.getElementById('courseWeeksPreset').innerHTML = COURSE_WEEKS_PRESETS.map(p =>
    `<option value="${p.key}">${p.label}</option>`
  ).join('');

  document.getElementById('courseColorPicker').innerHTML = SCHEDULE_COLORS.map((c, i) =>
    `<span class="color-option${i === 0 ? ' selected' : ''}" data-color="${c}" style="background:${c}" data-action="pick-course-color"></span>`
  ).join('');
}

function getPeriodLabel(p, i) {
  return p.name ? p.name : ('第' + (i + 1) + '节');
}

function renderPeriodOptions() {
  const periods = state.courseSchedule.periods;
  const opts = periods.map((p, i) =>
    `<option value="${i + 1}">${getPeriodLabel(p, i)} ${p.start}</option>`
  ).join('');
  document.getElementById('courseStartPeriod').innerHTML = opts;
  document.getElementById('courseEndPeriod').innerHTML = periods.map((p, i) =>
    `<option value="${i + 1}">${getPeriodLabel(p, i)} ${p.end}</option>`
  ).join('');
}

function resetCourseForm() {
  renderPeriodOptions();
  document.getElementById('courseName').value = '';
  document.getElementById('courseLocation').value = '';
  document.querySelectorAll('#courseWeekdayChecks input').forEach((cb, i) => { cb.checked = i === 0; });
  document.getElementById('courseStartPeriod').value = '1';
  document.getElementById('courseEndPeriod').value = '1';
  document.getElementById('courseWeeksPreset').value = 'all';
  document.getElementById('courseWeeksCustom').value = '1-20';
  document.getElementById('courseNote').value = '';
  setCourseColor(SCHEDULE_COLORS[0]);
}

function fillCourseForm(course) {
  renderPeriodOptions();
  document.getElementById('courseName').value = course.name;
  document.getElementById('courseLocation').value = course.location || '';
  document.querySelectorAll('#courseWeekdayChecks input').forEach(cb => {
    cb.checked = (course.weekdays || []).includes(parseInt(cb.value, 10));
  });
  document.getElementById('courseStartPeriod').value = course.startPeriod;
  document.getElementById('courseEndPeriod').value = course.endPeriod;
  document.getElementById('courseWeeksPreset').value = 'custom';
  document.getElementById('courseWeeksCustom').value = formatWeeksText(course.weeks);
  document.getElementById('courseNote').value = course.note || '';
  setCourseColor(course.color);
}

function setCourseColor(color) {
  courseFormColor = color;
  document.querySelectorAll('#courseColorPicker .color-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.color === color);
  });
}

function handleCourseWeeksPresetChange() {
  const preset = COURSE_WEEKS_PRESETS.find(p => p.key === document.getElementById('courseWeeksPreset').value);
  if (preset && preset.key !== 'custom') {
    document.getElementById('courseWeeksCustom').value = preset.text;
  }
}

function handleSaveCourse() {
  const name = document.getElementById('courseName').value.trim();
  const weeksText = document.getElementById('courseWeeksCustom').value.trim();
  const startPeriod = parseInt(document.getElementById('courseStartPeriod').value, 10);
  const endPeriod = parseInt(document.getElementById('courseEndPeriod').value, 10);

  const weekdays = Array.from(document.querySelectorAll('#courseWeekdayChecks input:checked')).map(cb => parseInt(cb.value, 10));

  if (!name) { showToast('请输入课程名称'); return; }
  if (!weekdays.length) { showToast('请至少选择一个上课星期'); return; }
  if (endPeriod < startPeriod) { showToast('结束节次不能早于开始节次'); return; }
  const weeks = parseWeeksText(weeksText);
  if (!weeks.length) { showToast('请输入有效的上课周数'); return; }

  const record = {
    name,
    location: document.getElementById('courseLocation').value.trim(),
    weekdays,
    startPeriod, endPeriod,
    weeksText,
    color: courseFormColor,
    note: document.getElementById('courseNote').value.trim(),
  };

  if (courseEditId) updateCourse(courseEditId, record);
  else addCourse(record);

  closeCourseModal();
  renderCourseView();
  showToast('课程已保存 ✓');
}

function handleDeleteCourse() {
  if (!courseEditId) return;
  if (!confirm('确定要删除这门课程吗？')) return;
  deleteCourse(courseEditId);
  closeCourseModal();
  renderCourseView();
  showToast('课程已删除');
}

// ========== 设置当前周数弹窗 ==========

function openWeekSetModal() {
  document.getElementById('weekSetModal').classList.add('show');
  document.getElementById('weekSetOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
  document.getElementById('weekSetNum').value = state.courseSchedule.currentWeek;
  document.getElementById('weekSetDate').value = state.courseSchedule.anchorDate;
}

function closeWeekSetModal() {
  document.getElementById('weekSetModal').classList.remove('show');
  document.getElementById('weekSetOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

function handleSaveWeekSet() {
  const weekNum = parseInt(document.getElementById('weekSetNum').value, 10);
  const dateStr = document.getElementById('weekSetDate').value;
  if (!weekNum || weekNum < 1) { showToast('请输入有效的周数'); return; }
  if (!dateStr) { showToast('请选择对应日期'); return; }
  setCurrentWeekAnchor(weekNum, dateStr);
  closeWeekSetModal();
  renderCourseView();
  showToast('周数已更新 ✓');
}

// ========== 节次时间设置弹窗 ==========

let _periodSetDraft = [];

function openPeriodSetModal() {
  _periodSetDraft = state.courseSchedule.periods.map(p => ({ ...p }));
  document.getElementById('periodSetModal').classList.add('show');
  document.getElementById('periodSetOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
  renderPeriodSetList();
  const scaleInput = document.getElementById('courseScaleY');
  const scaleLabel = document.getElementById('courseScaleYLabel');
  scaleInput.value = settings.courseScaleY || 1;
  scaleLabel.textContent = (settings.courseScaleY || 1).toFixed(1) + 'x';
}

function handleCourseScaleYInput(e) {
  document.getElementById('courseScaleYLabel').textContent = parseFloat(e.target.value).toFixed(1) + 'x';
}

function closePeriodSetModal() {
  document.getElementById('periodSetModal').classList.remove('show');
  document.getElementById('periodSetOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

function renderPeriodSetList() {
  const list = document.getElementById('periodSetList');
  list.innerHTML = _periodSetDraft.map((p, i) => `
    <div class="form-row period-set-row" data-index="${i}">
      <span class="period-set-index">第${i + 1}节</span>
      <input type="text" class="input period-set-name" placeholder="名称（选填）" value="${escapeHtml(p.name || '')}">
      <input type="time" class="input period-set-start" value="${p.start}">
      <input type="time" class="input period-set-end" value="${p.end}">
      <label class="period-set-collapse" title="折叠该节次（如午休）以节省竖向空间">
        <input type="checkbox" class="period-set-collapse-check" ${p.collapsed ? 'checked' : ''}> 折叠
      </label>
      <button type="button" class="btn btn-sm period-set-remove" style="background:#F43F5E;color:#fff">✕</button>
    </div>
  `).join('');
}

function handlePeriodSetInput(e) {
  const row = e.target.closest('.period-set-row');
  if (!row) return;
  const i = parseInt(row.dataset.index, 10);
  if (e.target.classList.contains('period-set-name')) _periodSetDraft[i].name = e.target.value.trim();
  if (e.target.classList.contains('period-set-start')) _periodSetDraft[i].start = e.target.value;
  if (e.target.classList.contains('period-set-end')) _periodSetDraft[i].end = e.target.value;
  if (e.target.classList.contains('period-set-collapse-check')) _periodSetDraft[i].collapsed = e.target.checked;
}

function handlePeriodSetRemove(e) {
  const row = e.target.closest('.period-set-row');
  if (!row) return;
  const i = parseInt(row.dataset.index, 10);
  _periodSetDraft.splice(i, 1);
  renderPeriodSetList();
}

function handleAddPeriod() {
  const last = _periodSetDraft[_periodSetDraft.length - 1];
  const start = last ? minutesToTime(timeToMinutes(last.end) + 10) : '08:00';
  const end = minutesToTime(timeToMinutes(start) + 45);
  _periodSetDraft.push({ start, end, name: '', collapsed: false });
  renderPeriodSetList();
}

function handleSavePeriodSet() {
  if (!_periodSetDraft.length) { showToast('至少需要保留一个节次'); return; }
  updatePeriods(_periodSetDraft.map(p => ({ ...p })));
  settings.courseScaleY = parseFloat(document.getElementById('courseScaleY').value) || 1;
  saveSettings(settings);
  closePeriodSetModal();
  renderCourseView();
  showToast('节次设置已保存 ✓');
}
