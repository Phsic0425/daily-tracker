/* ============================================
   storage.js — 数据持久化（localStorage）
   ============================================ */

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return {
    expenses: [], todos: [], templates: [], schedules: [],
    assets: [], assetRecords: [], courses: [],
    semester: { name: '', startDate: '', endDate: '' },
    classPeriods: [],  // 节次配置 [{ id, name, startTime, endTime, order }]
    tombstones: {}, updatedAt: 0,
  };
}

function saveData(data) {
  data.updatedAt = Date.now();
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
  _snapshot(false);
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

// 数据迁移：确保新字段有默认值；旧记录补 updatedAt（用 createdAt 保证跨设备一致）
['expenses', 'todos', 'templates', 'schedules', 'assets', 'assetRecords', 'courses'].forEach(function(key) {
  if (!Array.isArray(state[key])) state[key] = [];
  state[key].forEach(function(rec) {
    if (rec && !rec.updatedAt) {
      rec.updatedAt = rec.createdAt ? new Date(rec.createdAt).getTime() : 0;
    }
  });
});
if (!state.tombstones || typeof state.tombstones !== 'object' || Array.isArray(state.tombstones)) state.tombstones = {};
if (!state.semester || typeof state.semester !== 'object') state.semester = { name: '', startDate: '', endDate: '' };
if (!state.updatedAt) state.updatedAt = 0;
state.assets.forEach(function(a) { a.balance = Number(a.balance) || 0; });

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
  syncBackend: 'gist',       // 同步后端：gist（预留 cloudbase）
  gistToken: '',             // GitHub 细粒度 token（仅存本机）
  gistId: '',                // GitHub Gist ID
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

// 记录更新时间戳（供按记录合并使用）
function touch(rec) {
  if (rec) rec.updatedAt = Date.now();
  return rec;
}

// 删除墓碑：记录该 id 已删除，合并时永久丢弃、不复活
function markDeleted(id) {
  state.tombstones[id] = Date.now();
}

// 给某集合补齐 updatedAt（导入旧数据后调用）
function backfillUpdatedAt(list) {
  (list || []).forEach(function(rec) {
    if (rec && !rec.updatedAt) rec.updatedAt = rec.createdAt ? new Date(rec.createdAt).getTime() : 0;
  });
}

// ====== 云端同步（GitHub Gist，后端可切换） ======

var _syncTimer = null;
var _syncBusy = false;
var _lastSnapshotAt = 0;
var GIST_FILENAME = 'daily-tracker-data.json';

// ---- 按记录合并 + 墓碑 ----

/** 合并两端的 state：逐集合按 id 取 updatedAt 较新者，墓碑标记的 id 永久丢弃 */
function mergeStates(local, remote) {
  var keys = ['expenses', 'todos', 'templates', 'schedules', 'assets', 'assetRecords', 'courses'];
  var out = {};

  out.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
  out.semester = (remote.semester && remote.semester.startDate) ? remote.semester
    : (local.semester || { name: '', startDate: '', endDate: '' });

  // 合并墓碑（并集，取较大 ts）
  var lt = local.tombstones || {}, rt = remote.tombstones || {};
  var tombstones = {};
  Object.keys(lt).forEach(function(id) { tombstones[id] = lt[id]; });
  Object.keys(rt).forEach(function(id) { tombstones[id] = Math.max(tombstones[id] || 0, rt[id]); });
  out.tombstones = tombstones;

  keys.forEach(function(k) {
    var l = Array.isArray(local[k]) ? local[k] : [];
    var r = Array.isArray(remote[k]) ? remote[k] : [];
    var byId = {};
    l.forEach(function(rec) { if (rec && rec.id) byId[rec.id] = rec; });
    r.forEach(function(rec) {
      if (!rec || !rec.id) return;
      var ex = byId[rec.id];
      if (!ex) byId[rec.id] = rec;
      else if ((rec.updatedAt || 0) > (ex.updatedAt || 0)) byId[rec.id] = rec;
    });
    out[k] = Object.keys(byId).map(function(id) { return byId[id]; })
      .filter(function(rec) { return !tombstones[rec.id]; });
  });

  return out;
}

function _syncPayload() {
  return JSON.stringify({
    v: 8,
    expenses: state.expenses,
    todos: state.todos,
    templates: state.templates || [],
    schedules: state.schedules || [],
    assets: state.assets || [],
    assetRecords: state.assetRecords || [],
    courses: state.courses || [],
    semester: state.semester || { name: '', startDate: '', endDate: '' },
    tombstones: state.tombstones || {},
    updatedAt: state.updatedAt || 0,
  });
}

// ---- Gist 后端 ----

function _gistHeaders() {
  var h = { 'Accept': 'application/vnd.github+json' };
  if (settings.gistToken) h['Authorization'] = 'Bearer ' + settings.gistToken;
  return h;
}

function _gistFetchContent(cb) {
  if (!settings.gistId) { cb(null); return; }
  fetch('https://api.github.com/gists/' + settings.gistId, { headers: _gistHeaders() })
    .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(g) {
      var f = g.files && g.files[GIST_FILENAME];
      cb(f && f.content ? f.content : null);
    })
    .catch(function() { cb(null); });
}

function _gistPush(content, cb) {
  var files = {};
  files[GIST_FILENAME] = { content: content };
  fetch('https://api.github.com/gists/' + settings.gistId, {
    method: 'PATCH',
    headers: Object.assign({ 'Content-Type': 'application/json' }, _gistHeaders()),
    body: JSON.stringify({ files: files })
  }).then(function(r) {
    if (!r.ok) throw new Error(r.status);
    if (cb) cb(true);
  }).catch(function(e) {
    console.error('Gist 上传失败:', e);
    if (cb) cb(false);
  });
}

// 拉取远端 → 合并 → 写回本地（可选再上传合并结果）
function _applyRemote(jsonStr, andPush, cb) {
  _snapshot(true); // 同步前存检查点，防止坏数据覆盖
  var remote = null;
  if (jsonStr) { try { remote = JSON.parse(jsonStr); } catch(e) { remote = null; } }
  var merged = (remote && Array.isArray(remote.expenses)) ? mergeStates(state, remote) : state;

  ['expenses', 'todos', 'templates', 'schedules', 'assets', 'assetRecords', 'courses'].forEach(function(k) {
    if (Array.isArray(merged[k])) state[k] = merged[k];
  });
  if (merged.tombstones) state.tombstones = merged.tombstones;
  if (merged.semester) state.semester = merged.semester;

  saveData(state);
  try { if (typeof renderScheduleView === 'function') renderScheduleView(); } catch(e) {}

  if (andPush) { _gistPush(_syncPayload(), cb); }
  else if (cb) cb(true);
}

function syncDownload(callback) {
  if (_syncBusy) { if (callback) callback(false); return; }
  _syncBusy = true;
  _gistFetchContent(function(content) {
    _applyRemote(content, false, function(ok) {
      _syncBusy = false;
      console.log('☁️ 下载完成');
      if (callback) callback(ok);
    });
  });
}

function syncUpload(callback) {
  if (!settings.gistId || _syncBusy) { if (callback) callback(false); return; }
  _syncBusy = true;
  _gistFetchContent(function(content) {
    _applyRemote(content, true, function(ok) {
      _syncBusy = false;
      console.log('☁️ 上传完成');
      if (callback) callback(ok);
    });
  });
}

function syncCreate(callback) {
  if (!settings.gistToken) { if (callback) callback(''); return; }
  var files = {};
  files[GIST_FILENAME] = { content: _syncPayload() };
  fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, _gistHeaders()),
    body: JSON.stringify({ description: '日常记账数据', public: false, files: files })
  }).then(function(r) {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }).then(function(g) {
    var id = (g && g.id) ? g.id : '';
    if (id) { settings.gistId = id; saveSettings(settings); }
    if (callback) callback(id);
  }).catch(function(e) {
    console.error('创建失败:', e);
    if (callback) callback('');
  });
}

// 云端历史 + 回滚
function syncHistory(callback) {
  if (!settings.gistId) { callback([]); return; }
  fetch('https://api.github.com/gists/' + settings.gistId, { headers: _gistHeaders() })
    .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(g) {
      var list = (g.history || []).map(function(h) {
        return { sha: h.version, ts: h.committed_at };
      });
      callback(list);
    })
    .catch(function() { callback([]); });
}

function syncRevert(sha, callback) {
  fetch('https://api.github.com/gists/' + settings.gistId + '/' + sha, { headers: _gistHeaders() })
    .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(g) {
      var f = g.files && g.files[GIST_FILENAME];
      if (!f || !f.content) { callback(false); return; }
      _gistPush(f.content, callback);
    })
    .catch(function() { callback(false); });
}

// 重写 saveData，每次存盘自动上传
var _realSaveData = saveData;
saveData = function(data) {
  _realSaveData(data);
  if (settings.syncAuto && settings.gistId && !_syncBusy) syncUpload();
};

function initSync() {
  if (_syncTimer) clearInterval(_syncTimer);
  if (settings.gistId && settings.syncAuto) {
    syncDownload(); // 首次拉取
    _syncTimer = setInterval(function() { syncDownload(); }, 60000); // 60 秒
  }
}

// ---- 本地快照（独立存储，不进同步载荷） ----

const SNAPSHOTS_KEY = 'daily_tracker_snapshots';

function _stripImages(data) {
  try {
    const d = JSON.parse(JSON.stringify(data));
    if (Array.isArray(d.expenses)) d.expenses.forEach(e => { e.image = null; });
    return d;
  } catch(e) { return null; }
}

function _snapshot(force) {
  const now = Date.now();
  if (!force && _lastSnapshotAt && now - _lastSnapshotAt < 30000) return;
  _lastSnapshotAt = now;
  const snap = _stripImages(state);
  if (!snap) return;
  let list = [];
  try { list = JSON.parse(localStorage.getItem(SNAPSHOTS_KEY)) || []; } catch(e) {}
  list.push({ ts: now, data: snap });
  if (list.length > 30) list = list.slice(list.length - 30);
  try {
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(list));
  } catch(e) {
    try { localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(list.slice(list.length - 10))); } catch(e2) {}
  }
}

function getSnapshots() {
  try { return JSON.parse(localStorage.getItem(SNAPSHOTS_KEY)) || []; } catch(e) { return []; }
}

function restoreSnapshot(ts) {
  const list = getSnapshots();
  const hit = list.find(s => s.ts === ts);
  if (!hit) return false;
  ['expenses', 'todos', 'templates', 'schedules', 'assets', 'assetRecords', 'courses'].forEach(function(k) {
    if (Array.isArray(hit.data[k])) state[k] = hit.data[k];
  });
  if (hit.data.semester) state.semester = hit.data.semester;
  if (hit.data.tombstones) state.tombstones = hit.data.tombstones;
  saveData(state);
  return true;
}

// ---- 连接码（跨设备连接同一 Gist） ----

const CONNECT_PREFIX = 'DT4:';

async function exportConnectionCode() {
  const pack = { b: 'gist', id: settings.gistId, t: settings.gistToken };
  const json = JSON.stringify(pack);
  const bytes = new TextEncoder().encode(json);
  if (typeof CompressionStream === 'function') {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = await new Response(stream).arrayBuffer();
    return CONNECT_PREFIX + _bytesToBase64(new Uint8Array(buf));
  }
  return CONNECT_PREFIX + _bytesToBase64(bytes);
}

async function importConnectionCode(code) {
  try {
    code = code.trim();
    let json;
    if (code.indexOf(CONNECT_PREFIX) === 0) {
      const compressed = _base64ToBytes(code.slice(CONNECT_PREFIX.length));
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
      json = await new Response(stream).text();
    } else {
      json = new TextDecoder().decode(_base64ToBytes(code));
    }
    const data = JSON.parse(json);
    if (!data || data.b !== 'gist' || !data.id) return { ok: false, error: '无效的连接码' };
    settings.gistId = data.id;
    settings.gistToken = data.t || '';
    settings.syncBackend = 'gist';
    saveSettings(settings);
    return { ok: true };
  } catch(e) {
    return { ok: false, error: '连接码无效：' + e.message };
  }
}

// ---- 同步码（跨设备） ----

const SYNC_CODE_PREFIX = 'DT3:'; // 新版（gzip 压缩）标记，旧版无前缀

function _bytesToBase64(uint8) {
  // Uint8Array → base64（分块避免参数过长）
  var s = '';
  var chunk = 0x8000;
  for (var i = 0; i < uint8.length; i += chunk) {
    s += String.fromCharCode.apply(null, uint8.subarray(i, i + chunk));
  }
  return btoa(s);
}

function _base64ToBytes(str) {
  var binary = atob(str);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function exportSyncCode() {
  // 剔除截图：同步码只传文字数据，图片保留在本地设备（不改动原 state）
  var expenses = state.expenses.map(function(e) {
    return Object.assign({}, e, { image: null });
  });
  // 只带用户相关设置，剔除设备相关字段（同步配置不跨设备）
  var s = {};
  Object.keys(settings).forEach(function(k) {
    if (k !== 'syncId' && k !== 'syncAuto' && k !== 'gistToken' && k !== 'gistId' && k !== 'syncBackend') s[k] = settings[k];
  });
  var pack = {
    v: 4,
    expenses: expenses,
    todos: state.todos,
    templates: state.templates || [],
    schedules: state.schedules || [],
    assets: state.assets || [],
    assetRecords: state.assetRecords || [],
    courses: state.courses || [],
    semester: state.semester || { name: '', startDate: '', endDate: '' },
    tombstones: state.tombstones || {},
    settings: s,
    ts: Date.now()
  };
  var json = JSON.stringify(pack);
  var bytes = new TextEncoder().encode(json);
  if (typeof CompressionStream === 'function') {
    // gzip 压缩，文本类 JSON 可缩 70~90%
    var stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    var buf = await new Response(stream).arrayBuffer();
    return SYNC_CODE_PREFIX + _bytesToBase64(new Uint8Array(buf));
  }
  // 旧浏览器回退：不压缩，直接 base64（与旧版格式一致，仍可导入）
  return _bytesToBase64(bytes);
}

async function importSyncCode(code) {
  try {
    code = code.trim();
    var json;
    if (code.indexOf(SYNC_CODE_PREFIX) === 0) {
      // 新版：gzip 解压
      var compressed = _base64ToBytes(code.slice(SYNC_CODE_PREFIX.length));
      var stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
      json = await new Response(stream).text();
    } else {
      // 旧版：未压缩 base64
      json = new TextDecoder().decode(_base64ToBytes(code));
    }
    var data = JSON.parse(json);
    if (!data || !data.v) {
      return { ok: false, error: '无效的同步码，请确认完整复制' };
    }
    // 截图已剔除（image=null）：保留本地已有的同名图片，避免导入后丢图
    var localImages = {};
    state.expenses.forEach(function(e) { if (e.image) localImages[e.id] = e.image; });
    if (Array.isArray(data.expenses)) {
      data.expenses.forEach(function(e) {
        if (!e.image && localImages[e.id]) e.image = localImages[e.id];
      });
      state.expenses = data.expenses;
    }
    if (Array.isArray(data.todos)) state.todos = data.todos;
    if (Array.isArray(data.templates)) state.templates = data.templates;
    if (Array.isArray(data.schedules)) state.schedules = data.schedules;
    if (Array.isArray(data.assets)) state.assets = data.assets;
    if (Array.isArray(data.assetRecords)) state.assetRecords = data.assetRecords;
    if (Array.isArray(data.courses)) state.courses = data.courses;
    if (data.semester) state.semester = data.semester;
    if (data.tombstones) state.tombstones = data.tombstones;
    backfillUpdatedAt(state.expenses);
    backfillUpdatedAt(state.todos);
    backfillUpdatedAt(state.templates);
    backfillUpdatedAt(state.schedules);
    backfillUpdatedAt(state.assets);
    backfillUpdatedAt(state.assetRecords);
    backfillUpdatedAt(state.courses);
    if (data.settings) {
      // 不覆盖本机同步配置，避免导入后同步指向错误
      var keepSync = { syncId: settings.syncId, syncAuto: settings.syncAuto, gistToken: settings.gistToken, gistId: settings.gistId, syncBackend: settings.syncBackend };
      Object.assign(settings, data.settings);
      Object.assign(settings, keepSync);
      saveSettings(settings);
    }
    saveData(state);
    return {
      ok: true,
      expenses: (data.expenses || []).length,
      todos: (data.todos || []).length,
      schedules: (data.schedules || []).length,
      assets: (data.assets || []).length,
      courses: (data.courses || []).length,
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
  if (!Array.isArray(data.assets)) data.assets = [];
  if (!Array.isArray(data.assetRecords)) data.assetRecords = [];
  if (!Array.isArray(data.courses)) data.courses = [];
  if (!data.semester) data.semester = { name: '', startDate: '', endDate: '' };
  if (!data.tombstones) data.tombstones = {};
  state.expenses = data.expenses;
  state.todos = data.todos;
  state.templates = data.templates;
  state.schedules = data.schedules;
  state.assets = data.assets;
  state.assetRecords = data.assetRecords;
  state.courses = data.courses;
  state.semester = data.semester;
  state.tombstones = data.tombstones;
  backfillUpdatedAt(state.expenses);
  backfillUpdatedAt(state.todos);
  backfillUpdatedAt(state.templates);
  backfillUpdatedAt(state.schedules);
  backfillUpdatedAt(state.assets);
  backfillUpdatedAt(state.assetRecords);
  backfillUpdatedAt(state.courses);
  saveData(state);
  return {
    ok: true,
    counts: {
      expenses: data.expenses.length,
      todos: data.todos.length,
      templates: data.templates.length,
      schedules: data.schedules.length,
      assets: data.assets.length,
      courses: data.courses.length,
    }
  };
}
