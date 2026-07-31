/* ============================================
   app.js — 全局状态 & 入口
   依赖顺序：config → utils → storage → expense → todo
            → templates → effects → report → ui → events → app
   ============================================ */

// ---- 全局状态 ----
let viewMonth = { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
let modalType = 'expense';
let selectedCategory = 'food';
let completedCollapsed = false;
let deferredPrompt = null;
let pendingConfirmId = null;
let pendingConfirmTimer = null;
let pendingImage = null;
let tplManaging = false;
let batchDeleting = false;
let batchSelected = new Set();

// ---- 全局函数（供 inline onclick 调用）----
function toggleTemplateManage() {
  tplManaging = !tplManaging;
  renderTemplates();
}

function toggleBatchDelete() {
  batchDeleting = !batchDeleting;
  batchSelected.clear();
  document.getElementById('batchActions').style.display = batchDeleting ? 'flex' : 'none';
  document.getElementById('btnBatchDel').textContent = batchDeleting ? '取消' : '批量删除';
  renderExpenseList();
}

// ---- 启动 ----
function init() {
  document.getElementById('inputDate').value = today();
  document.getElementById('todoDeadline').value = today();
  document.getElementById('todoStartDate').value = '';

  updateHeaderMonth();
  renderExpenseView();
  renderTodoView();
  updateTodoBadge();

  setupEvents();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // 非 standalone 模式显示安装入口
  if (!window.matchMedia('(display-mode: standalone)').matches) {
    document.getElementById('installEntry').style.display = 'block';
  }

  console.log('📒 日常记账已就绪');
}

document.addEventListener('DOMContentLoaded', init);
