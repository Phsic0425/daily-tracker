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
let todoBatchDeleting = false;
let todoBatchSelected = new Set();
let completedBatchDeleting = false;
let completedBatchSelected = new Set();
let todoSortMode = 'deadline'; // 'deadline' | 'priority'
let reportYear, reportMonth; // 报表独立年月

// ---- 全局函数（供 inline onclick 调用）----
function toggleTemplateManage() {
  tplManaging = !tplManaging;
  renderTemplates();
  showToast(tplManaging ? '🔧 模板管理模式：点击模板可删除' : '✅ 已退出管理模式');
}

function toggleBatchDelete() {
  batchDeleting = !batchDeleting;
  batchSelected.clear();
  document.getElementById('batchActions').style.display = batchDeleting ? 'flex' : 'none';
  document.getElementById('btnBatchDel').textContent = batchDeleting ? '取消' : '批量删除';
  renderExpenseList();
}

function toggleTodoBatchDelete() {
  todoBatchDeleting = !todoBatchDeleting;
  todoBatchSelected.clear();
  document.getElementById('todoBatchActions').style.display = todoBatchDeleting ? 'flex' : 'none';
  document.getElementById('btnTodoBatchDel').textContent = todoBatchDeleting ? '取消' : '批量删除';
  renderActiveTodos();
}

function toggleCompletedBatchDelete() {
  // 如果已完成列表是收起状态，先展开
  if (completedCollapsed) {
    completedCollapsed = false;
    document.querySelector('.collapse-arrow').classList.remove('collapsed');
  }
  completedBatchDeleting = !completedBatchDeleting;
  completedBatchSelected.clear();
  document.getElementById('completedBatchActions').style.display = completedBatchDeleting ? 'flex' : 'none';
  document.getElementById('btnCompletedBatchDel').textContent = completedBatchDeleting ? '取消' : '批量删除';
  renderCompletedTodos();
}

// ---- 启动 ----
function init() {
  document.getElementById('inputDate').value = today();
  document.getElementById('todoDeadline').value = today();
  document.getElementById('todoStartDate').value = today();

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
