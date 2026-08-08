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
let todoSortMode = settings.defaultSortMode || 'deadline'; // 'deadline' | 'priority' | 'status'
let todoSortAsc = settings.sortAsc !== undefined ? settings.sortAsc : true; // true=升序
let reportYear, reportMonth; // 报表独立年月
let scheduleViewMonth = { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
let scheduleSelectedDate = today();
let scheduleEditId = null;
let notificationPermission = 'default';
let countdownTimer = null;
let collapsedParents = new Set(); // 折叠的父待办 ID 集合

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

  updateHeaderMonth();
  renderExpenseView();
  renderTodoView();
  updateTodoBadge();
  // 应用子任务折叠默认值
  if (settings.subTodoCollapsed) {
    state.todos.forEach(t => {
      if (typeof getChildCount === 'function' && getChildCount(t.id) > 0) {
        collapsedParents.add(t.id);
      }
    });
  }

  // 初始化日程视图（日历等静态元素在 DOM 中，render 填充内容）
  if (typeof renderScheduleView === 'function') {
    renderScheduleView();
    startCountdownTimer();
  }

  setupEvents();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // 请求通知权限
  requestNotificationPermission();

  // 每30秒检查一次通知
  if (typeof checkAndNotify === 'function') {
    setInterval(checkAndNotify, 30000);
  }

  // 非 standalone 模式显示安装入口
  if (!window.matchMedia('(display-mode: standalone)').matches) {
    document.getElementById('installEntry').style.display = 'block';
  }

  console.log('📒 日常记账已就绪');
}

// ---- 通知权限 ----
function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  notificationPermission = Notification.permission;
  if (notificationPermission === 'default') {
    Notification.requestPermission().then(perm => {
      notificationPermission = perm;
      if (perm === 'granted') showToast('🔔 提醒已开启');
    });
  }
}

// ---- 倒计时定时器 ----
function startCountdownTimer() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    // 每分钟更新一次倒计时（减少 DOM 操作）
    const now = new Date();
    if (now.getSeconds() < 1) {
      if (typeof renderUpcoming === 'function') renderUpcoming();
    }
  }, 1000);
}

document.addEventListener('DOMContentLoaded', init);
