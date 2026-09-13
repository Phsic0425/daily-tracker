/* ============================================
   course.js — 课表 CRUD & 周数计算
   ============================================ */

// 解析周数文本，如 "1-8,10,12-16" → [1,2,...,8,10,12,...,16]
function parseWeeksText(text) {
  const weeks = new Set();
  (text || '').split(',').forEach(part => {
    part = part.trim();
    if (!part) return;
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let a = parseInt(m[1], 10), b = parseInt(m[2], 10);
      if (a > b) { const t = a; a = b; b = t; }
      for (let i = a; i <= b; i++) weeks.add(i);
    } else if (/^\d+$/.test(part)) {
      weeks.add(parseInt(part, 10));
    }
  });
  return Array.from(weeks).sort((a, b) => a - b);
}

// 数组 → 文本，如 [1,2,3,5] → "1-3,5"
function formatWeeksText(weeks) {
  if (!Array.isArray(weeks) || !weeks.length) return '';
  const sorted = Array.from(new Set(weeks)).sort((a, b) => a - b);
  const parts = [];
  let start = sorted[0], prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i];
    if (cur === prev + 1) { prev = cur; continue; }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = prev = cur;
  }
  return parts.join(',');
}

// 根据锚点（某日期对应第几周）计算指定日期属于第几周
// anchorDate 所在的周（周一为起点）视为第 anchorWeek 周
function getWeekNumberForDate(dateStr) {
  const cs = state.courseSchedule;
  const anchor = new Date(cs.anchorDate + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');
  const anchorMonday = new Date(anchor);
  anchorMonday.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
  const targetMonday = new Date(target);
  targetMonday.setDate(target.getDate() - ((target.getDay() + 6) % 7));
  const diffWeeks = Math.round((targetMonday - anchorMonday) / (7 * 86400000));
  return cs.currentWeek + diffWeeks;
}

// 设置"现在是第几周"锚点（手动输入一次，日期默认为今天）
function setCurrentWeekAnchor(weekNum, dateStr) {
  state.courseSchedule.currentWeek = parseInt(weekNum, 10) || 1;
  state.courseSchedule.anchorDate = dateStr || today();
  saveData(state);
}

function updatePeriods(periods) {
  state.courseSchedule.periods = periods;
  saveData(state);
}

// 局部时间段缩放（如自定义压缩午休/自习时段），与节次的"折叠"开关独立叠加
function getScaleZones() {
  return state.courseSchedule.scaleZones || [];
}

function updateScaleZones(zones) {
  state.courseSchedule.scaleZones = zones;
  saveData(state);
}

function getCourses() {
  return state.courseSchedule.courses || [];
}

function getCourseById(id) {
  return getCourses().find(c => c.id === id) || null;
}

function addCourse(record) {
  const course = {
    id: genId(),
    name: record.name,
    location: record.location || '',
    weekdays: (Array.isArray(record.weekdays) ? record.weekdays : [record.weekday]).map(d => parseInt(d, 10)).filter(Boolean), // 1-7，周一到周日
    startPeriod: parseInt(record.startPeriod, 10),
    endPeriod: parseInt(record.endPeriod, 10),
    weeks: Array.isArray(record.weeks) ? record.weeks : parseWeeksText(record.weeksText || ''),
    color: record.color || SCHEDULE_COLORS[0],
    note: record.note || '',
  };
  state.courseSchedule.courses.push(course);
  saveData(state);
  return course;
}

function updateCourse(id, record) {
  const course = getCourseById(id);
  if (!course) return;
  course.name = record.name;
  course.location = record.location || '';
  course.weekdays = (Array.isArray(record.weekdays) ? record.weekdays : [record.weekday]).map(d => parseInt(d, 10)).filter(Boolean);
  course.startPeriod = parseInt(record.startPeriod, 10);
  course.endPeriod = parseInt(record.endPeriod, 10);
  course.weeks = Array.isArray(record.weeks) ? record.weeks : parseWeeksText(record.weeksText || '');
  course.color = record.color || course.color;
  course.note = record.note || '';
  saveData(state);
}

function deleteCourse(id) {
  state.courseSchedule.courses = state.courseSchedule.courses.filter(c => c.id !== id);
  saveData(state);
}

// 返回某周内每天（1-7）对应的课程列表，并标记 active（是否本周上课）
function getCoursesForWeek(weekNum) {
  const byDay = {1:[],2:[],3:[],4:[],5:[],6:[],7:[]};
  getCourses().forEach(c => {
    const active = c.weeks.includes(weekNum);
    (c.weekdays || []).forEach(wd => {
      if (byDay[wd]) byDay[wd].push({ ...c, active });
    });
  });
  return byDay;
}
