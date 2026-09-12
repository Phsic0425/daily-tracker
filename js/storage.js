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
state.schedules.forEach(s => {
  if (!s.type) s.type = 'event';      // 事件类 / 背景类
  if (!s.endDate) s.endDate = '';     // 跨天结束日
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
  scheduleViewMode: 'month', // 日程视图模式：month=月视图 / week=周视图
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

function exportSyncCode() {
  // 打包数据
  var pack = {
    v: 2,
    expenses: state.expenses,
    todos: state.todos,
    templates: state.templates || [],
    schedules: state.schedules || [],
    settings: settings,
    ts: Date.now()
  };
  // JSON → Base64（逐字符编码避免中文问题）
  var json = JSON.stringify(pack);
  var bytes = [];
  for (var i = 0; i < json.length; i++) {
    var c = json.charCodeAt(i);
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

function importSyncCode(code) {
  try {
    // Base64 → 二进制 → JSON
    var binary = atob(code.trim());
    var bytes = [];
    for (var i = 0; i < binary.length; i++) {
      bytes.push(binary.charCodeAt(i) & 255);
    }
    var json = '';
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
      json += String.fromCharCode(charCode);
      idx += charLen;
    }
    var data = JSON.parse(json);
    if (!data || !data.v) {
      return { ok: false, error: '无效的同步码，请确认完整复制' };
    }
    // 合并
    if (Array.isArray(data.expenses)) state.expenses = data.expenses;
    if (Array.isArray(data.todos)) state.todos = data.todos;
    if (Array.isArray(data.templates)) state.templates = data.templates;
    if (Array.isArray(data.schedules)) state.schedules = data.schedules;
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
