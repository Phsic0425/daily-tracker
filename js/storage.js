/* ============================================
   storage.js — 数据持久化（localStorage）
   ============================================ */

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { expenses: [], todos: [], templates: [] };
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// 全局状态（所有模块共享）
let state = loadData();
