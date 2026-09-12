/* ============================================
   course.js — 每周课表（单双周 + 学期周次）
   ============================================ */

// 课表列顺序：周一 ~ 周日（wd 对应 JS getDay()）
const TT_DAYS = [
  { label: '周一', wd: 1 },
  { label: '周二', wd: 2 },
  { label: '周三', wd: 3 },
  { label: '周四', wd: 4 },
  { label: '周五', wd: 5 },
  { label: '周六', wd: 6 },
  { label: '周日', wd: 0 },
];

const TIMETABLE_START = 8 * 60;   // 8:00
const TIMETABLE_END = 22 * 60;    // 22:00

// ---- 节次配置 CRUD ----

function getClassPeriods() {
  if (!state.classPeriods) state.classPeriods = [];
  return state.classPeriods.sort((a, b) => (a.order || 0) - (b.order || 0));
}

function addClassPeriod(p) {
  if (!state.classPeriods) state.classPeriods = [];
  state.classPeriods.push({
    id: genId(),
    name: (p.name || '').trim(),
    startTime: p.startTime || '',
    endTime: p.endTime || '',
    order: p.order != null ? p.order : state.classPeriods.length,
    createdAt: new Date().toISOString(),
    updatedAt: Date.now(),
  });
  saveData(state);
}

function updateClassPeriod(id, data) {
  const p = state.classPeriods.find(x => x.id === id);
  if (!p) return;
  p.name = data.name.trim();
  p.startTime = data.startTime || '';
  p.endTime = data.endTime || '';
  if (data.order != null) p.order = data.order;
  touch(p);
  saveData(state);
}

function deleteClassPeriod(id) {
  state.classPeriods = state.classPeriods.filter(x => x.id !== id);
  markDeleted(id);
  saveData(state);
}

function getClassPeriodsByIds(ids) {
  if (!Array.isArray(ids) || !ids.length) return [];
  return getClassPeriods().filter(p => ids.includes(p.id));
}

// ---- CRUD ----

function addCourse(c) {
  state.courses.push({
    id: genId(),
    name: (c.name || '').trim(),
    location: c.location || '',
    teacher: c.teacher || '',
    weekday: c.weekday != null ? c.weekday : 1,
    startTime: c.startTime || '',
    endTime: c.endTime || '',
    classPeriodIds: c.classPeriodIds || [],  // 新增：节次 ID 数组
    weeks: c.weeks || { start: 1, end: 16, parity: 'all' },
    color: c.color || SCHEDULE_COLORS[0],
    note: c.note || '',
    createdAt: new Date().toISOString(),
    updatedAt: Date.now(),
  });
  saveData(state);
}

function updateCourse(id, data) {
  const c = state.courses.find(x => x.id === id);
  if (!c) return;
  c.name = data.name.trim();
  c.location = data.location || '';
  c.teacher = data.teacher || '';
  c.weekday = data.weekday;
  c.startTime = data.startTime || '';
  c.endTime = data.endTime || '';
  c.classPeriodIds = data.classPeriodIds || [];  // 新增
  c.weeks = data.weeks;
  c.color = data.color || '#6366F1';
  c.note = data.note || '';
  touch(c);
  saveData(state);
}

function deleteCourse(id) {
  state.courses = state.courses.filter(x => x.id !== id);
  markDeleted(id);
  saveData(state);
}

// ---- 学期 ----

function getSemester() {
  return state.semester || { name: '', startDate: '', endDate: '', weekOffset: 0 };
}

function saveSemester(sem) {
  state.semester = {
    name: sem.name || '',
    startDate: sem.startDate || '',
    endDate: sem.endDate || '',
    weekOffset: parseInt(sem.weekOffset) || 0, // 手动校准：学校调休导致自然周数对不上时用
  };
  saveData(state);
}

function weekNumberForDate(dateStr) {
  const sem = getSemester();
  if (!sem.startDate) return 0;
  const start = new Date(sem.startDate + 'T00:00:00');
  const d = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((d - start) / 86400000);
  return Math.floor(diff / 7) + 1 + (sem.weekOffset || 0);
}

// 某门课在第 weekNum 周是否上课
function courseOccursInWeek(course, weekNum) {
  const w = course.weeks;
  if (Array.isArray(w)) return w.includes(weekNum);
  if (!w) return true;
  const start = w.start != null ? w.start : 1;
  const end = w.end != null ? w.end : 52;
  if (weekNum < start || weekNum > end) return false;
  if (w.parity === 'odd') return weekNum % 2 === 1;
  if (w.parity === 'even') return weekNum % 2 === 0;
  return true;
}

// 某天有哪些课（按开始时间排序）
function getCoursesForDate(dateStr) {
  const wn = weekNumberForDate(dateStr);
  if (wn <= 0) return [];
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  return state.courses
    .filter(c => c.weekday === dow && courseOccursInWeek(c, wn))
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
}

// 把某门课展开成 [fromStr, toStr] 区间内的具体日期
function expandCourseDates(course, fromStr, toStr) {
  const results = [];
  const sem = getSemester();
  if (!sem.startDate) return results;
  const from = new Date(fromStr + 'T00:00:00');
  const to = new Date(toStr + 'T00:00:00');
  const start = new Date(sem.startDate + 'T00:00:00');
  let cursor = new Date(start);
  let guard = 0;
  while (cursor <= to && guard < 600) {
    if (cursor >= from && cursor.getDay() === course.weekday) {
      const ds = fmtDateStr(cursor);
      if (courseOccursInWeek(course, weekNumberForDate(ds))) results.push(ds);
    }
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }
  return results;
}

// ---- 课表网格渲染 ----

function _timeToMin(t) {
  if (!t) return TIMETABLE_START;
  const m = String(t).split(':');
  return (parseInt(m[0]) || 0) * 60 + (parseInt(m[1]) || 0);
}

function _minToSlot(min) {
  return Math.round((min - TIMETABLE_START) / 30);
}

function renderTimetable() {
  const container = document.getElementById('timetable');
  if (!container) return;
  const sem = getSemester();
  const wn = weekNumberForDate(today());
  const labelEl = document.getElementById('timetableWeekLabel');
  if (labelEl) labelEl.textContent = sem.startDate ? ('第 ' + wn + ' 周') : '';

  if (!sem.startDate || wn <= 0) {
    container.innerHTML = '<p class="empty-hint">请先在「设置 → 日程」里配置学期开始日期</p>';
    return;
  }

  const periods = getClassPeriods();
  // 显示本学期所有课程（不再过滤掉不在本周上的课），本周不上的用弱化样式标出
  const cols = TT_DAYS.length;

  // 如果有配置节次，按节次渲染；否则按时间网格渲染
  if (periods.length > 0) {
    renderTimetableByPeriods(container, periods, state.courses, wn, cols);
  } else {
    renderTimetableByTime(container, state.courses, wn, cols);
  }
}

// 计算同一天同一时段重叠的课程（如同节次单双周两门课），让它们并排缩小显示
function _layoutOverlaps(blocks) {
  const byCol = {};
  blocks.forEach(function(b) {
    (byCol[b.colIdx] = byCol[b.colIdx] || []).push(b);
  });
  Object.keys(byCol).forEach(function(colIdx) {
    const arr = byCol[colIdx].slice().sort(function(a, b) { return a.rs - b.rs; });
    let cluster = null;
    arr.forEach(function(b) {
      if (cluster && b.rs < cluster.maxRe) {
        cluster.items.push(b);
        cluster.maxRe = Math.max(cluster.maxRe, b.re);
      } else {
        cluster = { items: [b], maxRe: b.re };
      }
      const n = cluster.items.length;
      cluster.items.forEach(function(item, i) {
        item.widthPct = 100 / n;
        item.leftPct = i * (100 / n);
      });
    });
  });
  return blocks;
}

// 基于时间网格的传统渲染（原逻辑）
function renderTimetableByTime(container, courses, wn, cols) {
  const SLOTS = Math.round((TIMETABLE_END - TIMETABLE_START) / 30);
  const slotH = 28;

  let html = '<div class="tt-grid" style="grid-template-columns:44px repeat(' + cols + ',minmax(62px,1fr));grid-template-rows:30px repeat(' + SLOTS + ',' + slotH + 'px)">';

  // 左上角空块
  html += '<div class="tt-corner"></div>';
  // 表头
  TT_DAYS.forEach(function(d, i) {
    html += '<div class="tt-day-head" style="grid-column:' + (i + 2) + '">' + d.label + '</div>';
  });

  // 时间轴标签（每小时）
  for (let min = TIMETABLE_START; min < TIMETABLE_END; min += 60) {
    const row = _minToSlot(min) + 2;
    const h = Math.floor(min / 60);
    html += '<div class="tt-hour" style="grid-row:' + row + ';grid-column:1">' + h + ':00</div>';
  }

  // 课程块（含本周不上的课，先算好布局再渲染）
  const blocks = [];
  courses.forEach(function(c) {
    const startMin = _timeToMin(c.startTime);
    let endMin = _timeToMin(c.endTime);
    if (!endMin || endMin <= startMin) endMin = startMin + 45;
    const colIdx = TT_DAYS.findIndex(d => d.wd === c.weekday);
    if (colIdx < 0) return;
    let rs = _minToSlot(startMin) + 2;
    let re = _minToSlot(endMin) + 2;
    if (re <= rs) re = rs + 1;
    blocks.push({ course: c, colIdx: colIdx, rs: rs, re: re, active: courseOccursInWeek(c, wn) });
  });
  _layoutOverlaps(blocks);
  blocks.forEach(function(b) {
    const c = b.course;
    const cls = 'tt-course' + (b.active ? '' : ' tt-course-inactive');
    html += '<div class="' + cls + '" style="grid-row:' + b.rs + '/' + b.re + ';grid-column:' + (b.colIdx + 2) + ';width:' + b.widthPct + '%;margin-left:' + b.leftPct + '%;background:' + c.color + '" data-id="' + c.id + '" data-action="edit-course">' +
      '<div class="tt-course-name">' + escapeHtml(c.name) + '</div>' +
      (c.location ? '<div class="tt-course-loc">' + escapeHtml(c.location) + '</div>' : '') +
      '</div>';
  });

  html += '</div>';
  container.innerHTML = html;
}

// 基于节次的新渲染
function renderTimetableByPeriods(container, periods, courses, wn, cols) {
  const rowH = 56;  // 每节课的行高
  let html = '<div class="tt-grid tt-grid-periods" style="grid-template-columns:60px repeat(' + cols + ',minmax(70px,1fr));grid-template-rows:36px repeat(' + periods.length + ',' + rowH + 'px)">';

  // 左上角空块
  html += '<div class="tt-corner"></div>';

  // 表头（周一到周日）
  TT_DAYS.forEach(function(d, i) {
    html += '<div class="tt-day-head" style="grid-column:' + (i + 2) + '">' + d.label + '</div>';
  });

  // 左侧节次标签
  periods.forEach(function(p, i) {
    const row = i + 2;
    html += '<div class="tt-period-label" style="grid-row:' + row + ';grid-column:1">' +
      '<div class="tt-period-name">' + escapeHtml(p.name) + '</div>' +
      '<div class="tt-period-time">' + (p.startTime || '') + '<br>' + (p.endTime || '') + '</div>' +
      '</div>';
  });

  // 课程块（按节次摆放，含本周不上的课，先算好布局再渲染）
  const blocks = [];
  courses.forEach(function(c) {
    const colIdx = TT_DAYS.findIndex(d => d.wd === c.weekday);
    if (colIdx < 0) return;

    const periodIds = c.classPeriodIds || [];
    if (periodIds.length === 0) return;  // 没有关联节次则不显示

    // 找到所选节次的连续区间
    const selectedPeriods = periods.map((p, idx) => periodIds.includes(p.id) ? idx : -1).filter(idx => idx >= 0);
    if (selectedPeriods.length === 0) return;

    selectedPeriods.sort((a, b) => a - b);
    const startRow = selectedPeriods[0] + 2;
    const endRow = selectedPeriods[selectedPeriods.length - 1] + 3;

    blocks.push({ course: c, colIdx: colIdx, rs: startRow, re: endRow, active: courseOccursInWeek(c, wn) });
  });
  _layoutOverlaps(blocks);
  blocks.forEach(function(b) {
    const c = b.course;
    const cls = 'tt-course' + (b.active ? '' : ' tt-course-inactive');
    html += '<div class="' + cls + '" style="grid-row:' + b.rs + '/' + b.re + ';grid-column:' + (b.colIdx + 2) + ';width:' + b.widthPct + '%;margin-left:' + b.leftPct + '%;background:' + c.color + '" data-id="' + c.id + '" data-action="edit-course">' +
      '<div class="tt-course-name">' + escapeHtml(c.name) + '</div>' +
      (c.location ? '<div class="tt-course-loc">' + escapeHtml(c.location) + '</div>' : '') +
      '</div>';
  });

  html += '</div>';
  container.innerHTML = html;
}

// ---- 课程弹窗 ----

let courseEditId = null;
let courseFormColor = '#6366F1';

function initCourseFormOptions() {
  if (document.getElementById('courseWeekday').options.length) return;
  document.getElementById('courseWeekday').innerHTML = TT_DAYS.map(function(d, i) {
    return '<option value="' + d.wd + '">' + d.label + '</option>';
  }).join('');
  document.getElementById('courseColorPicker').innerHTML = SCHEDULE_COLORS.map(function(c, i) {
    return '<span class="color-option' + (i === 0 ? ' selected' : '') + '" data-color="' + c + '" style="background:' + c + '" data-action="pick-course-color"></span>';
  }).join('');
}

function openCourseModal(editId) {
  initCourseFormOptions();
  courseEditId = editId || null;
  const modal = document.getElementById('courseModal');
  const overlay = document.getElementById('courseOverlay');
  modal.classList.add('show');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';

  const c = editId ? state.courses.find(x => x.id === editId) : null;
  document.getElementById('courseModalTitle').textContent = editId ? '编辑课程' : '添加课程';
  document.getElementById('btnDeleteCourse').style.display = editId ? '' : 'none';

  document.getElementById('courseName').value = c ? c.name : '';
  document.getElementById('courseLocation').value = c ? (c.location || '') : '';
  document.getElementById('courseTeacher').value = c ? (c.teacher || '') : '';
  document.getElementById('courseWeekday').value = c ? String(c.weekday) : '1';
  document.getElementById('courseStartTime').value = c ? (c.startTime || '') : '';
  document.getElementById('courseEndTime').value = c ? (c.endTime || '') : '';
  document.getElementById('courseNote').value = c ? (c.note || '') : '';

  const weeks = c ? c.weeks : null;
  document.getElementById('courseParity').value = (weeks && weeks.parity) ? weeks.parity : 'all';
  document.getElementById('courseWeekStart').value = (weeks && weeks.start != null) ? weeks.start : 1;
  document.getElementById('courseWeekEnd').value = (weeks && weeks.end != null) ? weeks.end : 16;

  courseFormColor = c ? (c.color || '#6366F1') : '#6366F1';
  document.querySelectorAll('#courseColorPicker .color-option').forEach(function(el) {
    el.classList.toggle('selected', el.dataset.color === courseFormColor);
  });

  // 渲染节次选择器
  const periods = getClassPeriods();
  const periodSection = document.getElementById('coursePeriodSection');
  const timeSection = document.getElementById('courseTimeSection');
  if (periods.length > 0) {
    periodSection.style.display = '';
    renderCoursePeriodChecks(c ? (c.classPeriodIds || []) : []);
  } else {
    periodSection.style.display = 'none';
    timeSection.style.display = '';
  }
}

function closeCourseModal() {
  document.getElementById('courseModal').classList.remove('show');
  document.getElementById('courseOverlay').classList.remove('show');
  document.body.style.overflow = '';
  courseEditId = null;
}

function setCourseColor(color) {
  courseFormColor = color;
  document.querySelectorAll('#courseColorPicker .color-option').forEach(function(el) {
    el.classList.toggle('selected', el.dataset.color === color);
  });
}

function renderCoursePeriodChecks(selectedIds) {
  const container = document.getElementById('coursePeriodChecks');
  if (!container) return;
  const periods = getClassPeriods();
  if (periods.length === 0) {
    container.innerHTML = '';
    return;
  }
  let html = '';
  periods.forEach(function(p) {
    const checked = selectedIds.includes(p.id);
    html += '<label class="period-check-item">' +
      '<input type="checkbox" class="period-checkbox" value="' + p.id + '"' + (checked ? ' checked' : '') + '>' +
      '<span class="period-check-label">' +
      '<span class="period-check-name">' + escapeHtml(p.name) + '</span>' +
      '<span class="period-check-time">' + (p.startTime || '') + '-' + (p.endTime || '') + '</span>' +
      '</span>' +
      '</label>';
  });
  container.innerHTML = html;
}

function getSelectedPeriodIds() {
  const checks = document.querySelectorAll('#coursePeriodChecks .period-checkbox:checked');
  return Array.from(checks).map(c => c.value);
}

function handleSaveCourse() {
  const name = document.getElementById('courseName').value.trim();
  const location = document.getElementById('courseLocation').value.trim();
  const teacher = document.getElementById('courseTeacher').value.trim();
  const weekday = parseInt(document.getElementById('courseWeekday').value);
  const startTime = document.getElementById('courseStartTime').value;
  const endTime = document.getElementById('courseEndTime').value;
  const note = document.getElementById('courseNote').value.trim();
  const parity = document.getElementById('courseParity').value;
  const weekStart = parseInt(document.getElementById('courseWeekStart').value) || 1;
  const weekEnd = parseInt(document.getElementById('courseWeekEnd').value) || 16;

  if (!name) { showToast('请输入课程名'); return; }

  const weeks = { start: weekStart, end: weekEnd, parity: parity };

  // 获取选中的节次 ID
  const classPeriodIds = getSelectedPeriodIds();

  const data = {
    name, location, teacher, weekday, startTime, endTime,
    classPeriodIds,  // 添加节次 ID
    weeks, color: courseFormColor, note
  };

  if (courseEditId) {
    updateCourse(courseEditId, data);
    showToast('课程已更新 ✓');
  } else {
    addCourse(data);
    showToast('课程已添加 ✓');
  }
  closeCourseModal();
  renderTimetable();
}

function handleDeleteCourse() {
  if (!courseEditId) return;
  if (!confirm('确定删除这门课？')) return;
  deleteCourse(courseEditId);
  closeCourseModal();
  showToast('课程已删除');
  renderTimetable();
}

// ---- 节次编辑弹窗 ----

let periodEditId = null;

function openPeriodModal(editId) {
  periodEditId = editId || null;
  const modal = document.getElementById('periodModal');
  const overlay = document.getElementById('periodOverlay');
  modal.classList.add('show');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';

  const p = editId ? state.classPeriods.find(x => x.id === editId) : null;
  document.getElementById('periodModalTitle').textContent = editId ? '编辑节次' : '添加节次';
  document.getElementById('periodName').value = p ? p.name : '';
  document.getElementById('periodStartTime').value = p ? (p.startTime || '') : '';
  document.getElementById('periodEndTime').value = p ? (p.endTime || '') : '';
}

function closePeriodModal() {
  document.getElementById('periodModal').classList.remove('show');
  document.getElementById('periodOverlay').classList.remove('show');
  document.body.style.overflow = '';
  periodEditId = null;
}

function handleSavePeriod() {
  const name = document.getElementById('periodName').value.trim();
  const startTime = document.getElementById('periodStartTime').value;
  const endTime = document.getElementById('periodEndTime').value;

  if (!name) { showToast('请输入节次名称'); return; }
  if (!startTime || !endTime) { showToast('请选择开始和结束时间'); return; }

  const data = { name, startTime, endTime };

  if (periodEditId) {
    updateClassPeriod(periodEditId, data);
    showToast('节次已更新 ✓');
  } else {
    addClassPeriod(data);
    showToast('节次已添加 ✓');
  }

  closePeriodModal();
  if (typeof refreshClassPeriodList === 'function') refreshClassPeriodList();
}

function handleDeletePeriod(id) {
  if (!confirm('确定删除这个节次吗？已关联的课程将不受影响。')) return;
  deleteClassPeriod(id);
  showToast('节次已删除');
  if (typeof refreshClassPeriodList === 'function') refreshClassPeriodList();
}

