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
  gistToken: '',             // GitHub token（仅 gist 权限）
  gistId: '',                // Gist ID
  syncEnabled: false,        // 是否启用自动同步
  syncInterval: 60,          // 同步间隔（秒）
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

// ====== GitHub Gist 云同步 ======

var _syncTimer = null;
var _syncing = false;
var _lastSyncHash = '';

function getSyncData() {
  return JSON.stringify({
    expenses: state.expenses,
    todos: state.todos,
    templates: state.templates,
    schedules: state.schedules,
  });
}

function dataHash() {
  var s = getSyncData();
  // 简单哈希
  var h = 0;
  for (var i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

/** 上传数据到 Gist */
async function syncUpload() {
  if (!settings.syncEnabled || !settings.gistToken || _syncing) return;
  var gistId = settings.gistId;
  var content = getSyncData();
  var hash = dataHash();
  if (hash === _lastSyncHash) return; // 没变化，跳过

  _syncing = true;
  try {
    var method, url;
    if (gistId) {
      method = 'PATCH';
      url = 'https://api.github.com/gists/' + gistId;
    } else {
      method = 'POST';
      url = 'https://api.github.com/gists';
    }

    var resp = await fetch(url, {
      method: method,
      headers: {
        'Authorization': 'token ' + settings.gistToken,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        description: '日常记账 数据',
        public: false,
        files: { 'daily-tracker.json': { content: content } }
      }),
    });

    if (resp.ok) {
      var data = await resp.json();
      if (!gistId) {
        settings.gistId = data.id;
        saveSettings(settings);
      }
      _lastSyncHash = hash;
      console.log('☁️ 同步上传成功');
    } else if (resp.status === 401) {
      showToast('⚠️ GitHub Token 无效，请检查设置');
    }
  } catch(e) {
    console.error('同步上传失败:', e);
  }
  _syncing = false;
}

/** 从 Gist 下载数据 */
async function syncDownload() {
  if (!settings.syncEnabled || !settings.gistToken || !settings.gistId || _syncing) return;

  _syncing = true;
  try {
    var resp = await fetch('https://api.github.com/gists/' + settings.gistId, {
      headers: {
        'Authorization': 'token ' + settings.gistToken,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (resp.ok) {
      var data = await resp.json();
      var file = data.files && data.files['daily-tracker.json'];
      if (file && file.content) {
        var remoteHash = simpleHash(file.content);
        if (remoteHash === _lastSyncHash) { _syncing = false; return; }

        var parsed = JSON.parse(file.content);
        if (parsed) {
          if (Array.isArray(parsed.expenses)) state.expenses = parsed.expenses;
          if (Array.isArray(parsed.todos)) state.todos = parsed.todos;
          if (Array.isArray(parsed.templates)) state.templates = parsed.templates;
          if (Array.isArray(parsed.schedules)) state.schedules = parsed.schedules;
          saveData(state);
          _lastSyncHash = remoteHash;
          console.log('☁️ 同步下载成功');
          // 刷新 UI
          renderExpenseView();
          renderTodoView();
          updateTodoBadge();
          if (typeof renderScheduleView === 'function') renderScheduleView();
        }
      }
    }
  } catch(e) {
    console.error('同步下载失败:', e);
  }
  _syncing = false;
}

function simpleHash(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

/** 启动定时同步 */
function startSyncTimer() {
  stopSyncTimer();
  if (!settings.syncEnabled || !settings.gistToken || !settings.gistId) return;
  var interval = (settings.syncInterval || 60) * 1000;
  _syncTimer = setInterval(function() {
    syncDownload();
  }, interval);
  // 首次立即同步
  syncDownload();
}

function stopSyncTimer() {
  if (_syncTimer) { clearInterval(_syncTimer); _syncTimer = null; }
}

/** 初始化同步 */
function initSync() {
  if (settings.syncEnabled && settings.gistToken && settings.gistId) {
    startSyncTimer();
  }
}

// 重写 saveData，每次保存时自动上传
var _originalSaveData = saveData;
saveData = function(data) {
  _originalSaveData(data);
  syncUpload();
};

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
