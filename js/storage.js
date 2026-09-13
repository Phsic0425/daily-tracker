/* ============================================
   storage.js — 数据持久化（localStorage）
   ============================================ */

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { expenses: [], todos: [], templates: [], schedules: [], accounts: [], courseSchedule: null };
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
state.schedules.forEach(s => {
  if (!s.type) s.type = 'event';      // 事件类 / 背景类
  if (!s.endDate) s.endDate = '';     // 跨天结束日
});

if (!Array.isArray(state.accounts)) state.accounts = [];
state.accounts.forEach(a => {
  if (typeof a.balance !== 'number') a.balance = 0;
  if (!a.type) a.type = 'other';
  if (!a.icon) a.icon = (ACCOUNT_TYPES.find(t => t.key === a.type) || ACCOUNT_TYPES[4]).icon;
});
state.expenses.forEach(e => {
  if (!('accountId' in e)) e.accountId = '';
});

if (!state.courseSchedule || typeof state.courseSchedule !== 'object') {
  state.courseSchedule = { periods: DEFAULT_PERIODS.slice(), currentWeek: 1, anchorDate: today(), courses: [] };
}
if (!Array.isArray(state.courseSchedule.periods) || !state.courseSchedule.periods.length) {
  state.courseSchedule.periods = DEFAULT_PERIODS.slice();
}
state.courseSchedule.periods.forEach(p => { if (typeof p.name !== 'string') p.name = ''; });
if (!Array.isArray(state.courseSchedule.courses)) state.courseSchedule.courses = [];
if (typeof state.courseSchedule.currentWeek !== 'number') state.courseSchedule.currentWeek = 1;
if (!state.courseSchedule.anchorDate) state.courseSchedule.anchorDate = today();
state.courseSchedule.courses.forEach(c => {
  if (!Array.isArray(c.weeks)) c.weeks = [];
  if (!c.color) c.color = SCHEDULE_COLORS[0];
});

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
  scheduleViewMode: 'month', // 日程视图模式：month=月视图 / course=课表视图
  syncId: '',                // 云端同步 ID
  syncAuto: true,            // 自动同步开关
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

// ====== 云端同步（免费免注册） ======

var _syncTimer = null;
var _syncBusy = false;
var _syncSeq = 0; // 版本号，防止旧数据覆盖新数据

function _syncData() {
  return JSON.stringify({
    expenses: state.expenses,
    todos: state.todos,
    templates: state.templates || [],
    schedules: state.schedules || [],
    accounts: state.accounts || [],
    courseSchedule: state.courseSchedule || null,
    seq: ++_syncSeq,
    ts: Date.now()
  });
}

function syncUpload() {
  if (!settings.syncId || _syncBusy) return;
  _syncBusy = true;
  var data = _syncData();
  // npoint.io 用 PUT 更新
  fetch('https://api.npoint.io/' + settings.syncId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: data
  }).then(function(r) {
    if (r.ok) console.log('☁️ 上传成功');
    _syncBusy = false;
  }).catch(function() {
    _syncBusy = false;
  });
}

function syncDownload(callback) {
  if (!settings.syncId || _syncBusy) return;
  _syncBusy = true;
  fetch('https://api.npoint.io/' + settings.syncId).then(function(r) {
    if (!r.ok) { _syncBusy = false; return; }
    return r.json();
  }).then(function(data) {
    _syncBusy = false;
    if (!data || !data.expenses) return;
    if (Array.isArray(data.expenses)) state.expenses = data.expenses;
    if (Array.isArray(data.todos)) state.todos = data.todos;
    if (Array.isArray(data.templates)) state.templates = data.templates;
    if (Array.isArray(data.schedules)) state.schedules = data.schedules;
    if (Array.isArray(data.accounts)) state.accounts = data.accounts;
    if (data.courseSchedule && typeof data.courseSchedule === 'object') state.courseSchedule = data.courseSchedule;
    saveData(state);
    console.log('☁️ 下载成功');
    if (callback) callback();
    try { renderExpenseView(); } catch(e) {}
    try { renderTodoView(); } catch(e) {}
    try { updateTodoBadge(); } catch(e) {}
    try { if (typeof renderScheduleView === 'function') renderScheduleView(); } catch(e) {}
  }).catch(function() {
    _syncBusy = false;
  });
}

function syncCreate(callback) {
  var data = _syncData();
  fetch('https://api.npoint.io/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data
  }).then(function(r) {
    return r.json();
  }).then(function(info) {
    var id = (info && (info.id || info.url || '')).toString();
    // 从 url 或 id 中提取纯 ID
    var m = id.match(/([a-zA-Z0-9]{10,})/);
    if (m) id = m[1];
    if (id) {
      settings.syncId = id;
      saveSettings(settings);
    }
    if (callback) callback(id || '');
  }).catch(function(e) {
    console.error('创建失败:', e);
    if (callback) callback('');
  });
}

// 重写 saveData，每次存盘自动上传
var _realSaveData = saveData;
saveData = function(data) {
  _realSaveData(data);
  if (settings.syncAuto && settings.syncId) syncUpload();
};

function initSync() {
  if (settings.syncId && settings.syncAuto) {
    // 首次拉取
    syncDownload();
    // 定时拉取
    if (_syncTimer) clearInterval(_syncTimer);
    _syncTimer = setInterval(function() {
      syncDownload();
    }, 30000); // 30秒
  }
}

// ---- 同步码（跨设备） ----

// UTF-8 字符串 → Base64（逐字符编码避免中文问题）
function _strToBase64(str) {
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c < 128) {
      bytes.push(c);
    } else if (c < 2048) {
      bytes.push((c >> 6) | 192);
      bytes.push((c & 63) | 128);
    } else {
      bytes.push((c >> 12) | 224);
      bytes.push(((c >> 6) & 63) | 128);
      bytes.push((c & 63) | 128);
    }
  }
  var binary = '';
  for (var j = 0; j < bytes.length; j++) {
    binary += String.fromCharCode(bytes[j]);
  }
  return btoa(binary);
}

// Base64 → UTF-8 字符串
function _base64ToStr(code) {
  var binary = atob(code.trim());
  var bytes = [];
  for (var i = 0; i < binary.length; i++) {
    bytes.push(binary.charCodeAt(i) & 255);
  }
  var str = '';
  var idx = 0;
  while (idx < bytes.length) {
    var b = bytes[idx];
    var charLen;
    var charCode;
    if (b < 128) {
      charLen = 1;
      charCode = b;
    } else if (b < 224) {
      charLen = 2;
      charCode = ((b & 31) << 6) | (bytes[idx + 1] & 63);
    } else {
      charLen = 3;
      charCode = ((b & 15) << 12) | ((bytes[idx + 1] & 63) << 6) | (bytes[idx + 2] & 63);
    }
    str += String.fromCharCode(charCode);
    idx += charLen;
  }
  return str;
}

// 取出某个模块 key 在 state/settings 上对应的数据
function _getModuleData(key) {
  if (key === 'settings') return settings;
  if (key === 'courseSchedule') return state.courseSchedule || null;
  return state[key] || [];
}

function exportSyncCode() {
  // 打包数据（全部模块）
  var pack = {
    v: 2,
    expenses: state.expenses,
    todos: state.todos,
    templates: state.templates || [],
    schedules: state.schedules || [],
    accounts: state.accounts || [],
    courseSchedule: state.courseSchedule || null,
    settings: settings,
    ts: Date.now()
  };
  return _strToBase64(JSON.stringify(pack));
}

function importSyncCode(code) {
  try {
    var data = JSON.parse(_base64ToStr(code));
    if (!data || !data.v) {
      return { ok: false, error: '无效的同步码，请确认完整复制' };
    }
    // 合并
    if (Array.isArray(data.expenses)) state.expenses = data.expenses;
    if (Array.isArray(data.todos)) state.todos = data.todos;
    if (Array.isArray(data.templates)) state.templates = data.templates;
    if (Array.isArray(data.schedules)) state.schedules = data.schedules;
    if (Array.isArray(data.accounts)) state.accounts = data.accounts;
    if (data.courseSchedule && typeof data.courseSchedule === 'object') state.courseSchedule = data.courseSchedule;
    if (data.settings) {
      Object.assign(settings, data.settings);
      saveSettings(settings);
    }
    saveData(state);
    return {
      ok: true,
      expenses: (data.expenses || []).length,
      todos: (data.todos || []).length,
      schedules: (data.schedules || []).length,
    };
  } catch(e) {
    return { ok: false, error: '同步码无效：' + e.message };
  }
}

// ---- 分模块同步码 ----

// 只打包 moduleKeys 指定的模块（keys 取自 SYNC_MODULES）
function exportSyncCodeModules(moduleKeys) {
  var pack = { v: 2, modules: moduleKeys.slice(), ts: Date.now() };
  moduleKeys.forEach(function(key) {
    pack[key] = _getModuleData(key);
  });
  return _strToBase64(JSON.stringify(pack));
}

// 解析同步码但不写入 state，返回码里实际包含的模块 key 列表，供导入前勾选
function previewSyncCodeModules(code) {
  try {
    var data = JSON.parse(_base64ToStr(code));
    if (!data || !data.v) {
      return { ok: false, error: '无效的同步码，请确认完整复制' };
    }
    var present = SYNC_MODULES.map(function(m) { return m.key; }).filter(function(key) {
      if (key === 'courseSchedule') return data[key] && typeof data[key] === 'object';
      if (key === 'settings') return !!data.settings;
      return Array.isArray(data[key]);
    });
    return { ok: true, data: data, modules: present };
  } catch(e) {
    return { ok: false, error: '同步码无效：' + e.message };
  }
}

// 只把 moduleKeys 指定且码里存在的模块写入 state（整体覆盖对应字段，不合并）
function importSyncCodeModules(code, moduleKeys) {
  var preview = previewSyncCodeModules(code);
  if (!preview.ok) return preview;
  var data = preview.data;
  var counts = {};
  moduleKeys.forEach(function(key) {
    if (key === 'settings') {
      if (data.settings) {
        Object.assign(settings, data.settings);
        saveSettings(settings);
        counts.settings = 1;
      }
      return;
    }
    if (key === 'courseSchedule') {
      if (data.courseSchedule && typeof data.courseSchedule === 'object') {
        state.courseSchedule = data.courseSchedule;
        counts.courseSchedule = 1;
      }
      return;
    }
    if (Array.isArray(data[key])) {
      state[key] = data[key];
      counts[key] = data[key].length;
    }
  });
  saveData(state);
  return { ok: true, counts: counts };
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
  if (!Array.isArray(data.accounts)) data.accounts = [];
  if (!data.courseSchedule || typeof data.courseSchedule !== 'object') {
    data.courseSchedule = { periods: DEFAULT_PERIODS.slice(), currentWeek: 1, anchorDate: today(), courses: [] };
  }
  state.expenses = data.expenses;
  state.todos = data.todos;
  state.templates = data.templates;
  state.schedules = data.schedules;
  state.accounts = data.accounts;
  state.courseSchedule = data.courseSchedule;
  saveData(state);
  return {
    ok: true,
    counts: {
      expenses: data.expenses.length,
      todos: data.todos.length,
      templates: data.templates.length,
      schedules: data.schedules.length,
      accounts: data.accounts.length,
    }
  };
}
