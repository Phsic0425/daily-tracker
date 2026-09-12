/* ============================================
   app.js — 全局状态 & 入口
   依赖顺序：config → utils → storage → expense → todo
            → templates → effects → report → ui → events → app
   ============================================ */

// ---- 全局状态 ----
let viewMonth = { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
let modalType = 'expense';
let selectedCategory = 'food';
let byBalanceMode = false;
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
let scheduleViewMode = settings.scheduleViewMode || 'month'; // 'month' | 'week'
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

  // Service Worker 注册 + 全自动更新
  if ('serviceWorker' in navigator) {
    // 新 SW 接管页面后自动刷新一次（全自动更新，无需清数据）
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      if (swReloaded) return;
      swReloaded = true;
      window.location.reload();
    });

    navigator.serviceWorker.register('sw.js').then(function(reg) {
      swRegistration = reg;
      // 新版本被发现（无论是自动检查还是手动点击「检查更新」触发）
      reg.addEventListener('updatefound', function() {
        var installing = reg.installing;
        if (!installing) return;
        showToast('🔄 发现新版本，正在更新...');
        installing.addEventListener('statechange', function() {
          if (installing.state === 'installed') {
            // 新 SW 已装完（sw.js 里已 skipWaiting，随后会自动 activate 并触发 controllerchange 刷新）
            showToast('✅ 更新完成，即将刷新');
          }
        });
      });
      // 定期检查更新（每小时）
      setInterval(function() { reg.update(); }, 3600000);
    }).catch(function() {});
  }

  // 云端同步初始化
  if (typeof initSync === 'function') initSync();

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

// ---- 版本更新（全自动）----
let swReloaded = false;
let swRegistration = null;

// 手动检查更新（更多菜单「🔄 检查更新」）
function checkForUpdate() {
  if (!('serviceWorker' in navigator)) { showToast('当前环境不支持 Service Worker'); return; }
  navigator.serviceWorker.getRegistration().then(function(reg) {
    if (!reg) { showToast('应用尚未安装 Service Worker'); return; }
    swRegistration = reg;
    showToast('🔄 正在检查更新...');
    reg.update().then(function() {
      // 有新版本时会触发 reg 的 updatefound 事件（app.js 里已监听，会弹「发现新版本/更新完成」提示并自动刷新）
      // 这里只在确认没有新版本时兜底提示
      setTimeout(function() {
        if (!reg.waiting && !reg.installing) {
          showToast('✅ 已是最新版本');
        }
      }, 1200);
    }).catch(function() {
      showToast('❌ 检查失败，请检查网络');
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
