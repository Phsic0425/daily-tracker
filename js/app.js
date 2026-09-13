/* ============================================
   app.js — 全局状态 & 入口
   依赖顺序：config → utils → storage → account → expense → todo
            → schedule → course → calendar → timetable
            → templates → effects → report → ui → events → app
   ============================================ */

// ---- 全局状态 ----
let viewMonth = { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
let modalType = 'expense';
let selectedCategory = 'food';
let selectedAccountId = '';
let amountMode = 'delta'; // 'delta'=输入变化量 | 'final'=输入末状态值
let accountManaging = false;
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
let scheduleViewMode = (settings.scheduleViewMode === 'course') ? 'course' : 'month'; // 'month' | 'course'（旧版 'week' 视图已废弃，自动回退到月视图）
let scheduleEditId = null;
let notificationPermission = 'default';
let countdownTimer = null;
let _waitingWorker = null; // 等待激活的新 Service Worker
let collapsedParents = new Set(); // 折叠的父待办 ID 集合

// ---- 全局函数（供 inline onclick 调用）----
function toggleTemplateManage() {
  tplManaging = !tplManaging;
  renderTemplates();
  showToast(tplManaging ? '🔧 模板管理模式：点击模板可删除' : '✅ 已退出管理模式');
}

function toggleAccountManage() {
  accountManaging = !accountManaging;
  renderAccountList();
  showToast(accountManaging ? '🔧 账户管理模式：点击账户可编辑/删除' : '✅ 已退出管理模式');
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

  // Service Worker 注册 + 自动更新检测
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(function(reg) {
      // 检测到新版本正在安装
      reg.addEventListener('updatefound', function() {
        var newWorker = reg.installing;
        newWorker.addEventListener('statechange', function() {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            _waitingWorker = newWorker;
            showUpdateBanner();
          }
        });
      });
      // 如果已有等待中的 worker
      if (reg.waiting) {
        _waitingWorker = reg.waiting;
        showUpdateBanner();
      }
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

// ---- 版本更新提示 ----
function showUpdateBanner() {
  // 避免重复显示
  if (document.getElementById('updateBanner')) return;
  var banner = document.createElement('div');
  banner.id = 'updateBanner';
  banner.className = 'update-banner';
  banner.innerHTML = '<span>🔄 有新版本可用</span><button class="btn btn-sm btn-primary" id="btnDoUpdate">立即更新</button>';
  document.body.appendChild(banner);
  document.getElementById('btnDoUpdate').addEventListener('click', function() {
    // 通知等待中的新 SW 跳过等待
    if (_waitingWorker) {
      // 等新 SW 接管页面后再刷新，避免刷新太快仍加载旧缓存
      var reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', function() {
        if (!reloaded) { reloaded = true; window.location.reload(); }
      });
      _waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      // 兜底：300ms 后强制刷新（防止 controllerchange 未触发）
      setTimeout(function() {
        if (!reloaded) { reloaded = true; window.location.reload(); }
      }, 300);
    }
  });
}

// SW 消息处理
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'UPDATE_READY') {
      showUpdateBanner();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
