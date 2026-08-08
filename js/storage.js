/* ============================================
   storage.js — 数据持久化（localStorage）
   ============================================ */

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { expenses: [], todos: [], templates: [], schedules: [] };
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch(e) {
    console.error('保存数据失败:', e);
    // localStorage 空间不足时尝试清理旧图片
    if (e.name === 'QuotaExceededError') {
      // 移除所有账单截图释放空间
      data.expenses.forEach(e => { e.image = null; });
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e2) {}
    }
  }
  // 自动刷新 UI：下一次动画帧统一渲染，避免重复调用
  if (!saveData._pending) {
    saveData._pending = true;
    requestAnimationFrame(() => {
      saveData._pending = false;
      try { renderExpenseView(); } catch(e) {}
      try { renderTodoView(); } catch(e) {}
      try { updateTodoBadge(); } catch(e) {}
    });
  }
}

// 全局状态（所有模块共享）
let state = loadData();

// 数据迁移：确保新增字段有默认值
if (!Array.isArray(state.schedules)) state.schedules = [];

// ---- 设置 ----
const SETTINGS_KEY = 'daily_tracker_settings';

const DEFAULT_SETTINGS = {
  dueSoonDays: 3,
  showTimeStatus: true,
  defaultSortMode: 'deadline',
  sortAsc: true,
  customExpenseCategories: [],
  customIncomeCategories: [],
  deletedExpenseCategories: [],
  deletedIncomeCategories: [],
  subTodoCollapsed: false,  // 子任务默认展开(false)还是收起(true)
  showLunar: true,           // 日历显示农历
  showHolidays: true,        // 日历显示节假日
  showScheduleLabels: true,  // 日历格显示日程文字（关=仅圆点）
  compactSchedule: false,    // 简洁日程：每格最多1条文字
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // 合并默认值，确保新增字段有默认值
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch(e) { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch(e) { console.error('保存设置失败:', e); }
}

let settings = loadSettings();

// ---- 同步码（跨设备） ----

function exportSyncCode() {
  var data = JSON.stringify({
    v: 1,
    expenses: state.expenses,
    todos: state.todos,
    templates: state.templates,
    schedules: state.schedules,
    settings: settings,
    ts: Date.now()
  });
  // 压缩：去掉空格
  var compact = JSON.stringify(JSON.parse(data));
  // Base64 编码
  var code = btoa(unescape(encodeURIComponent(compact)));
  return code;
}

function importSyncCode(code) {
  try {
    var json = decodeURIComponent(escape(atob(code)));
    var data = JSON.parse(json);
    if (!data || typeof data !== 'object' || !data.v) {
      return { ok: false, error: '无效的同步码' };
    }
    // 合并数据
    if (Array.isArray(data.expenses)) state.expenses = data.expenses;
    if (Array.isArray(data.todos)) state.todos = data.todos;
    if (Array.isArray(data.templates)) state.templates = data.templates;
    if (Array.isArray(data.schedules)) state.schedules = data.schedules;
    if (data.settings && typeof data.settings === 'object') {
      Object.assign(settings, data.settings);
      saveSettings(settings);
    }
    saveData(state);
    return {
      ok: true,
      counts: {
        expenses: (data.expenses || []).length,
        todos: (data.todos || []).length,
        templates: (data.templates || []).length,
        schedules: (data.schedules || []).length,
      }
    };
  } catch(e) {
    return { ok: false, error: '同步码解析失败: ' + e.message };
  }
}

// ---- 数据导出/导入 ----
function exportData() {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const now = new Date();
  const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  a.download = `daily-tracker-backup-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importData(jsonStr) {
  let data;
  try {
    data = JSON.parse(jsonStr);
  } catch(e) {
    return { ok: false, error: 'JSON 解析失败，请检查文件格式' };
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, error: '无效的数据格式' };
  }
  // 容错：确保关键字段是数组
  if (!Array.isArray(data.expenses)) data.expenses = [];
  if (!Array.isArray(data.todos)) data.todos = [];
  if (!Array.isArray(data.templates)) data.templates = [];
  if (!Array.isArray(data.schedules)) data.schedules = [];
  state.expenses = data.expenses;
  state.todos = data.todos;
  state.templates = data.templates;
  state.schedules = data.schedules;
  saveData(state);
  return {
    ok: true,
    counts: {
      expenses: data.expenses.length,
      todos: data.todos.length,
      templates: data.templates.length,
      schedules: data.schedules.length,
    }
  };
}
