/* ============================================
   ui.js — 所有 UI 渲染函数
   包含：记账视图 / 待办视图 / 弹窗 / 模板 / 报表
   ============================================ */

// ========== 记账视图 ==========

function renderExpenseView() {
  renderSummary();
  renderTemplates();
  renderCategoryBreakdown();
  renderExpenseList();
  updateHeaderMonth(); // 确保 header 月份始终同步
}

function renderSummary() {
  try {
    const { income, expense, balance } = getMonthSummary(viewMonth.year, viewMonth.month);
    document.getElementById('sumIncome').textContent = fmtMoney(income);
    document.getElementById('sumExpense').textContent = fmtMoney(expense);
    const balEl = document.getElementById('sumBalance');
    balEl.textContent = fmtMoney(balance);
    balEl.style.color = balance >= 0 ? 'var(--income)' : 'var(--expense)';
  } catch(e) {
    console.error('renderSummary error:', e);
  }
}

function updateHeaderMonth() {
  document.getElementById('monthPicker').value = `${viewMonth.year}-${String(viewMonth.month).padStart(2, '0')}`;
}

// ========== 分类统计 ==========

function renderCategoryBreakdown() {
  try {
    const container = document.getElementById('categoryBreakdown');
    const { expenseCats, incomeCats } = getCategoryBreakdown(viewMonth.year, viewMonth.month);

    if (expenseCats.length === 0 && incomeCats.length === 0) {
      container.innerHTML = '<p class="empty-hint">本月暂无记录</p>';
      return;
    }

    let html = '';
    expenseCats.forEach(cat => {
      html += `
        <div class="cat-item">
          <div class="cat-icon expense-icon">${cat.icon}</div>
          <div class="cat-info">
            <div class="cat-name">${cat.name}</div>
            <div class="cat-bar-wrap"><div class="cat-bar expense-bar" style="width:${Math.max(cat.percent, 2)}%"></div></div>
          </div>
          <div style="text-align:right">
            <div class="cat-amount expense-amount">${fmtMoney(cat.amount)}</div>
            <div class="cat-percent">${cat.percent.toFixed(1)}%</div>
          </div>
        </div>`;
    });
    incomeCats.forEach(cat => {
      html += `
        <div class="cat-item">
          <div class="cat-icon income-icon">${cat.icon}</div>
          <div class="cat-info">
            <div class="cat-name">${cat.name}</div>
            <div class="cat-bar-wrap"><div class="cat-bar income-bar" style="width:${Math.max(cat.percent, 2)}%"></div></div>
          </div>
          <div style="text-align:right">
            <div class="cat-amount income-amount">${fmtMoney(cat.amount)}</div>
            <div class="cat-percent">${cat.percent.toFixed(1)}%</div>
          </div>
        </div>`;
    });
    container.innerHTML = html;
  } catch(e) {
    console.error('renderCategoryBreakdown error:', e);
  }
}

// ========== 快捷模板 ==========

function renderTemplates() {
  try {
    const container = document.getElementById('templateList');
    const emptyHint = document.getElementById('templateEmpty');
    const templates = getTemplates();

    if (templates.length === 0) {
      container.innerHTML = '';
      emptyHint.style.display = 'block';
      const mgrBtn = document.getElementById('btnTplManage');
      if (mgrBtn) mgrBtn.textContent = tplManaging ? '完成' : '管理';
      return;
    }

    emptyHint.style.display = 'none';
    let html = '';
    if (tplManaging) {
      html += '<div class="tpl-manage-banner">🔧 管理模式下点击模板可删除，再次点击「完成」退出</div>';
    }
    html += templates.map(t => {
      const cats = getMergedCategories(t.type);
      const cat = cats.find(c => c.key === t.category) || { icon: '📦', name: t.category };
      const amountClass = t.type === 'expense' ? '' : 'income-tpl';
      const label = t.name || cat.name;
      return `
        <button class="tpl-chip${tplManaging ? ' managing' : ''}" data-tpl-id="${t.id}" data-action="record-tpl">
          <span class="tpl-icon">${cat.icon}</span>
          <span>${escapeHtml(label)}</span>
          <span class="tpl-amount ${amountClass}">${fmtMoney(t.amount)}</span>
        </button>`;
    }).join('');

    html += `<button class="tpl-chip-add" id="btnAddTpl" title="新建模板">+</button>`;
    container.innerHTML = html;

    const mgrBtn = document.getElementById('btnTplManage');
    if (mgrBtn) mgrBtn.textContent = tplManaging ? '完成' : '管理';
  } catch(e) {
    console.error('renderTemplates error:', e);
  }
}

// ========== 账单列表 ==========

function renderExpenseList() {
  try {
    const container = document.getElementById('expenseList');
    const list = getMonthExpenses(viewMonth.year, viewMonth.month)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));

    if (list.length === 0) {
      container.innerHTML = '<p class="empty-hint">暂无记录，点右下角 + 记一笔吧</p>';
      return;
    }

    const groups = {};
    list.forEach(e => {
      if (!groups[e.date]) groups[e.date] = [];
      groups[e.date].push(e);
    });

    let html = '';
    for (const [date, items] of Object.entries(groups)) {
      const dayExpense = items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
      const dayIncome = items.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0);
      let daySum = '';
      if (dayExpense > 0) daySum += `支出 ${fmtMoney(dayExpense)} `;
      if (dayIncome > 0) daySum += `收入 ${fmtMoney(dayIncome)}`;

      html += `<div class="date-group">
        <div class="date-label">${fmtDate(date)}<span style="font-weight:400;font-size:0.7rem">${daySum}</span></div>`;

      items.forEach(item => {
        const cats = getMergedCategories(item.type);
        const cat = cats.find(c => c.key === item.category) || { icon: '📦', name: item.category };
        const iconClass = item.type === 'expense' ? 'expense-icon' : 'income-icon';
        const amountClass = item.type === 'expense' ? 'expense-amount' : 'income-amount';
        const prefix = item.type === 'expense' ? '-' : '+';
        const checked = batchSelected.has(item.id);

        html += `
        <div class="expense-item" data-id="${item.id}">
          ${batchDeleting ? `<div class="batch-checkbox${checked ? ' checked' : ''}" data-action="batch-check" data-id="${item.id}">✓</div>` : ''}
          <div class="item-icon ${iconClass}">${cat.icon}</div>
          <div class="item-info">
            <div class="item-cat">${cat.name}</div>
            ${item.note ? `<div class="item-note">${escapeHtml(item.note)}</div>` : ''}
            <div class="item-date">${fmtDate(date)}</div>
          </div>
          ${item.image ? `<img src="${escapeHtml(item.image)}" class="expense-img-thumb" data-action="preview-img" data-src="${escapeHtml(item.image)}" title="查看截图">` : ''}
          <span class="item-amount ${amountClass}">${prefix}${fmtMoney(item.amount)}</span>
          ${!batchDeleting ? `<button class="item-delete" data-action="delete-expense" data-id="${item.id}" title="删除">🗑</button>` : ''}
        </div>`;
      });

      html += '</div>';
    }
    container.innerHTML = html;
  } catch(e) {
    console.error('renderExpenseList error:', e);
  }
}

// ========== 待办视图 ==========

function renderTodoView() {
  renderActiveTodos();
  renderCompletedTodos();
  updateTodoBadge();
}

function renderActiveTodos() {
  const container = document.getElementById('activeTodoList');
  const todos = getActiveTodos(todoSortMode);
  document.getElementById('activeCount').textContent = getActiveCount();

  // 更新排序模式按钮状态
  document.querySelectorAll('.sort-mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.sort === todoSortMode);
  });
  const dirBtn = document.getElementById('btnSortDir');
  if (dirBtn) dirBtn.textContent = todoSortAsc ? '↑' : '↓';

  if (todos.length === 0) {
    container.innerHTML = '<p class="empty-hint">没有待办，添加一个吧</p>';
    return;
  }

  let html = '';
  todos.forEach(t => {
    html += renderTodoItem(t, 0);
    // 递归渲染子待办
    html += renderChildren(t.id, 1);
  });
  container.innerHTML = html;
}

function renderChildren(parentId, depth) {
  // 如果父待办被折叠，不渲染子待办
  if (collapsedParents.has(parentId)) return '';

  const children = getChildren(parentId);
  const completed = getCompletedChildren(parentId);
  const allChildren = [...children, ...completed];
  allChildren.sort((a, b) => (a.order || 0) - (b.order || 0));

  let html = '';
  allChildren.forEach(t => {
    html += renderTodoItem(t, depth);
    html += renderChildren(t.id, depth + 1);
  });
  return html;
}

function renderTodoItem(t, depth) {
  const overdue = isOverdue(t.deadline);
  const dueSoon = !overdue && isDueSoon(t.deadline);
  const showStatus = settings.showTimeStatus;
  let statusClass = '';
  if (t.completed) statusClass = ' completed-item';
  else if (showStatus && overdue) statusClass = ' overdue';
  else if (showStatus && dueSoon) statusClass = ' due-soon';

  const p = PRIORITY_MAP[t.priority] || PRIORITY_MAP['medium'];
  let dateHtml = `<span class="todo-deadline">📅 ${fmtDateShort(t.deadline)}</span>`;
  if (!t.completed && showStatus && overdue) {
    dateHtml = `<span class="todo-deadline overdue">📅 ${fmtDateShort(t.deadline)} ⚠️超时</span>`;
  } else if (!t.completed && showStatus && dueSoon) {
    const d = new Date(t.deadline + 'T00:00:00');
    const tt = new Date(today() + 'T00:00:00');
    const diff = Math.ceil((d - tt) / (1000 * 60 * 60 * 24));
    dateHtml = `<span class="todo-deadline due-soon-text">📅 ${fmtDateShort(t.deadline)} ⏳剩${diff}天</span>`;
  }

  // 子待办进度 + 折叠按钮
  let childProgress = '';
  const childTotal = getChildCount(t.id);
  const hasChildren = childTotal > 0;
  if (hasChildren) {
    const childDone = getCompletedChildCount(t.id);
    const collapsed = collapsedParents.has(t.id);
    childProgress = `<span class="todo-collapse-btn" data-action="collapse-todo" data-id="${t.id}">${collapsed ? '▶' : '▼'}</span><span class="todo-child-progress">${childDone}/${childTotal}</span>`;
  }

  const checked = todoBatchSelected.has(t.id);
  const indent = Math.min(depth, 4) * 20;
  const completedCls = t.completed ? ' todo-done' : '';
  const depthCls = depth > 0 ? ' sub-todo depth-' + Math.min(depth, 4) : '';

  return `
    <div class="todo-item${t.pinned && depth === 0 ? ' pinned' : ''}${statusClass}${depthCls}" data-id="${t.id}" style="padding-left:${12 + indent}px">
      ${todoBatchDeleting ? `<div class="batch-checkbox${checked ? ' checked' : ''}" data-action="todo-batch-check" data-id="${t.id}">✓</div>` : ''}
      ${!todoBatchDeleting ? `<button class="todo-check${t.completed ? ' done' : ''}" data-action="toggle-todo" data-id="${t.id}" title="${t.completed ? '恢复' : '点击两次完成'}">✓</button>` : ''}
      <div class="todo-body">
        <div class="todo-title-text${completedCls}">${t.pinned && depth === 0 ? '📌 ' : ''}${escapeHtml(t.title)} ${childProgress}</div>
        ${t.note ? `<div class="todo-note" data-action="edit-note" data-id="${t.id}" title="点击编辑备注">${escapeHtml(t.note)}</div>` : ''}
        <div class="todo-meta">
          <span class="priority-dot ${p.dot}" title="${p.emoji} ${p.label}优先"></span>
          ${dateHtml}
          ${t.completed && t.completedAt ? `<span class="completed-at">· 完成于 ${fmtDateShort(t.completedAt.slice(0, 10))}</span>` : ''}
        </div>
      </div>
      ${!todoBatchDeleting && !t.completed ? `<button class="todo-edit-btn" data-action="edit-todo" data-id="${t.id}" title="编辑">✎</button>` : ''}
      ${!todoBatchDeleting && !t.completed ? `<button class="todo-add-child" data-action="add-child" data-id="${t.id}" title="添加子任务">+</button>` : ''}
      ${!todoBatchDeleting && !t.completed ? `<button class="todo-pin${t.pinned ? ' pinned' : ''}" data-action="pin-todo" data-id="${t.id}" title="${t.pinned ? '取消置顶' : '置顶'}"${depth > 0 ? ' style="visibility:hidden"' : ''}>📌</button>` : ''}
      ${!todoBatchDeleting ? `<button class="todo-delete" data-action="delete-todo" data-id="${t.id}" title="删除">🗑</button>` : ''}
    </div>`;
}

function renderCompletedTodos() {
  const container = document.getElementById('completedTodoList');
  const todos = getCompletedTodos();
  document.getElementById('completedCount').textContent = state.todos.filter(t => t.completed && !t.parentId).length;

  if (completedCollapsed) {
    container.innerHTML = '';
    document.getElementById('completedBatchActions').style.display = 'none';
    document.getElementById('btnCompletedBatchDel').style.display = 'none';
    return;
  }
  document.getElementById('btnCompletedBatchDel').style.display = '';
  if (completedBatchDeleting) {
    document.getElementById('completedBatchActions').style.display = 'flex';
  }

  if (todos.length === 0) {
    container.innerHTML = '';
    document.getElementById('btnCompletedBatchDel').style.display = 'none';
    document.getElementById('completedBatchActions').style.display = 'none';
    return;
  }

  let html = '';
  todos.forEach(t => {
    html += renderTodoItem(t, 0);
    // 递归渲染已完成的子待办
    html += renderCompletedChildren(t.id, 1);
  });
  container.innerHTML = html;
}

function renderCompletedChildren(parentId, depth) {
  // 如果父待办被折叠，不渲染子待办
  if (collapsedParents.has(parentId)) return '';

  const completed = getCompletedChildren(parentId);
  completed.sort((a, b) => (a.order || 0) - (b.order || 0));
  let html = '';
  completed.forEach(t => {
    html += renderTodoItem(t, depth);
    html += renderCompletedChildren(t.id, depth + 1);
  });
  return html;
}

function updateTodoBadge() {
  const badge = document.getElementById('todoBadge');
  const count = getActiveCount();
  if (count > 0) {
    badge.textContent = count;
    badge.classList.add('show');
  } else {
    badge.classList.remove('show');
  }
}

// ========== 记账弹窗 ==========

function openExpenseModal() {
  const modal = document.getElementById('expenseModal');
  const overlay = document.getElementById('overlay');
  modal.classList.add('show');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';

  document.getElementById('inputAmount').value = '';
  document.getElementById('inputNote').value = '';
  document.getElementById('inputDate').value = today();
  document.getElementById('chkSaveTemplate').checked = false;
  modalType = 'expense';
  selectedCategory = 'food';
  pendingImage = null;
  updateCameraButton();

  updateTypeToggle();
  renderCategoryOptions();
  document.getElementById('inputAmount').focus();
}

function closeExpenseModal() {
  document.getElementById('expenseModal').classList.remove('show');
  document.getElementById('overlay').classList.remove('show');
  document.body.style.overflow = '';
}

function updateTypeToggle() {
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === modalType);
  });
}

function renderCategoryOptions() {
  const grid = document.getElementById('categoryGrid');
  const cats = getMergedCategories(modalType);
  if (!cats.find(c => c.key === selectedCategory)) {
    selectedCategory = cats[0].key;
  }
  grid.innerHTML = cats.map(c => `
    <button class="cat-option${c.key === selectedCategory ? ' selected' : ''}"
            data-cat="${c.key}" type="button">
      <span class="cat-emoji">${c.icon}</span>
      <span>${c.name}</span>
    </button>
  `).join('');
}

// ========== 日程视图（入口，实现在 calendar.js）==========

function renderScheduleView() {
  if (typeof renderCalendar !== 'function') return; // 文件未加载时跳过
  renderCalendar(scheduleViewMonth.year, scheduleViewMonth.month);
  renderUpcoming();
  renderDayDetail(scheduleSelectedDate);
}

// ========== 设置弹窗 ==========

function renderSettings() {
  const container = document.getElementById('settingsContent');
  const expenseCats = getMergedCategories('expense');
  const incomeCats = getMergedCategories('income');

  container.innerHTML = `
    <!-- ====== 💰 记账 ====== -->
    <div class="setting-block">
      <div class="setting-block-title">💰 记账</div>

      <div class="setting-subtitle">🔴 支出分类</div>
      <div class="cat-tag-list" id="expenseCatTags">
        ${expenseCats.map(c => {
          const isCustom = settings.customExpenseCategories.some(cc => cc.key === c.key);
          return `<span class="cat-tag${isCustom ? ' custom' : ''}">
            ${c.icon} ${c.name}
            <button class="cat-tag-del" data-cat-key="${c.key}" data-type="expense" data-is-custom="${isCustom}">✕</button>
          </span>`;
        }).join('')}
      </div>
      <div class="setting-item" style="padding-top:4px">
        <input type="text" class="input" id="newExpenseCatName" placeholder="新分类名称" maxlength="10" style="flex:1">
        <button class="btn btn-sm btn-primary" id="btnAddExpenseCat">+</button>
      </div>

      <div class="setting-subtitle">🟢 收入分类</div>
      <div class="cat-tag-list" id="incomeCatTags">
        ${incomeCats.map(c => {
          const isCustom = settings.customIncomeCategories.some(cc => cc.key === c.key);
          return `<span class="cat-tag${isCustom ? ' custom' : ''}">
            ${c.icon} ${c.name}
            <button class="cat-tag-del" data-cat-key="${c.key}" data-type="income" data-is-custom="${isCustom}">✕</button>
          </span>`;
        }).join('')}
      </div>
      <div class="setting-item" style="padding-top:4px">
        <input type="text" class="input" id="newIncomeCatName" placeholder="新分类名称" maxlength="10" style="flex:1">
        <button class="btn btn-sm btn-primary" id="btnAddIncomeCat">+</button>
      </div>
    </div>

    <!-- ====== ✅ 待办 ====== -->
    <div class="setting-block">
      <div class="setting-block-title">✅ 待办</div>

      <div class="setting-item">
        <div class="setting-label">
          <span>时间状态显示</span>
          <span class="setting-desc">临期（黄色）/ 超时（红色）边框</span>
        </div>
        <label class="switch-label">
          <input type="checkbox" id="settingShowTimeStatus" ${settings.showTimeStatus ? 'checked' : ''}>
          <span class="switch-track"></span>
        </label>
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>临期天数阈值</span>
          <span class="setting-desc">距截止日期几天内算"临期"</span>
        </div>
        <input type="number" class="setting-num" id="settingDueSoonDays" value="${settings.dueSoonDays}" min="1" max="30" step="1">
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>默认排序方式</span>
          <span class="setting-desc">页面加载时的排序方式</span>
        </div>
        <select class="setting-select" id="settingDefaultSort">
          <option value="deadline" ${settings.defaultSortMode === 'deadline' ? 'selected' : ''}>📅 截止日期</option>
          <option value="priority" ${settings.defaultSortMode === 'priority' ? 'selected' : ''}>🔴 优先级</option>
        </select>
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>默认排序方向</span>
          <span class="setting-desc">升序（早→晚）或倒序</span>
        </div>
        <label class="switch-label">
          <input type="checkbox" id="settingSortAsc" ${settings.sortAsc ? 'checked' : ''}>
          <span class="switch-track"></span>
          <span class="switch-hint">${settings.sortAsc ? '升序' : '倒序'}</span>
        </label>
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>子任务默认收起</span>
          <span class="setting-desc">开启后，进入页面时子任务默认折叠</span>
        </div>
        <label class="switch-label">
          <input type="checkbox" id="settingSubTodoCollapsed" ${settings.subTodoCollapsed ? 'checked' : ''}>
          <span class="switch-track"></span>
        </label>
      </div>
    </div>

    <!-- ====== ☁️ 同步 ====== -->
    <div class="setting-block" id="settingBlockSync">
      <div class="setting-block-title">☁️ 云同步</div>
      <div class="setting-desc" style="padding:0 4px 8px;font-size:0.75rem;color:var(--text-muted)">
        使用 GitHub Gist 作为免费云存储，实现手机与电脑数据实时同步。<br>
        需要创建 <a href="https://github.com/settings/tokens/new?scopes=gist&description=daily-tracker" target="_blank" style="color:var(--primary)">GitHub Token</a>（仅勾选 gist 权限）。
      </div>

      <div class="setting-item">
        <div class="setting-label">
          <span>启用云同步</span>
          <span class="setting-desc">自动上传+定时下载</span>
        </div>
        <label class="switch-label">
          <input type="checkbox" id="settingSyncEnabled" ${settings.syncEnabled ? 'checked' : ''}>
          <span class="switch-track"></span>
        </label>
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>GitHub Token</span>
          <span class="setting-desc">仅需 gist 权限，不碰代码仓库</span>
        </div>
        <input type="password" class="input" id="settingGistToken" value="${settings.gistToken || ''}" placeholder="ghp_xxxxxxxx" style="width:180px;flex:none">
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>同步间隔（秒）</span>
          <span class="setting-desc">建议 60 秒</span>
        </div>
        <input type="number" class="setting-num" id="settingSyncInterval" value="${settings.syncInterval || 60}" min="10" max="3600" step="10">
      </div>
      <div class="setting-item" style="justify-content:flex-start;gap:8px">
        <button class="btn btn-sm btn-primary" id="btnSyncNow">🔄 立即同步</button>
        <span style="font-size:0.72rem;color:var(--text-muted)" id="syncStatus"></span>
      </div>
    </div>

    <!-- ====== 📅 日程 ====== -->
    <div class="setting-block" id="settingBlockCalendar">
      <div class="setting-block-title">📅 日程</div>

      <div class="setting-item">
        <div class="setting-label">
          <span>显示农历日期</span>
          <span class="setting-desc">日历格中显示农历月日</span>
        </div>
        <label class="switch-label">
          <input type="checkbox" id="settingShowLunar" ${settings.showLunar ? 'checked' : ''}>
          <span class="switch-track"></span>
        </label>
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>显示节假日</span>
          <span class="setting-desc">日历格中显示节日/节气名称</span>
        </div>
        <label class="switch-label">
          <input type="checkbox" id="settingShowHolidays" ${settings.showHolidays ? 'checked' : ''}>
          <span class="switch-track"></span>
        </label>
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>显示日程标签</span>
          <span class="setting-desc">关闭后仅显示彩色圆点</span>
        </div>
        <label class="switch-label">
          <input type="checkbox" id="settingShowScheduleLabels" ${settings.showScheduleLabels ? 'checked' : ''}>
          <span class="switch-track"></span>
        </label>
      </div>
      <div class="setting-item">
        <div class="setting-label">
          <span>简洁日程模式</span>
          <span class="setting-desc">每格最多显示1条日程文字</span>
        </div>
        <label class="switch-label">
          <input type="checkbox" id="settingCompactSchedule" ${settings.compactSchedule ? 'checked' : ''}>
          <span class="switch-track"></span>
        </label>
      </div>
    </div>
  `;
}

function openSettings() {
  renderSettings();
  document.getElementById('settingsModal').classList.add('show');
  document.getElementById('settingsOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('show');
  document.getElementById('settingsOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

function handleSaveSettings() {
  settings.showTimeStatus = document.getElementById('settingShowTimeStatus').checked;
  settings.dueSoonDays = parseInt(document.getElementById('settingDueSoonDays').value) || 3;
  settings.defaultSortMode = document.getElementById('settingDefaultSort').value;
  settings.sortAsc = document.getElementById('settingSortAsc').checked;
  settings.subTodoCollapsed = document.getElementById('settingSubTodoCollapsed').checked;
  settings.showLunar = document.getElementById('settingShowLunar').checked;
  settings.showHolidays = document.getElementById('settingShowHolidays').checked;
  settings.showScheduleLabels = document.getElementById('settingShowScheduleLabels').checked;
  settings.compactSchedule = document.getElementById('settingCompactSchedule').checked;
  // 同步设置
  settings.syncEnabled = document.getElementById('settingSyncEnabled').checked;
  settings.gistToken = document.getElementById('settingGistToken').value.trim();
  settings.syncInterval = parseInt(document.getElementById('settingSyncInterval').value) || 60;
  saveSettings(settings);
  // 应用同步
  if (typeof initSync === 'function') initSync();
  // 应用排序
  todoSortAsc = settings.sortAsc;
  todoSortMode = settings.defaultSortMode;
  // 应用折叠默认值
  collapsedParents.clear();
  if (settings.subTodoCollapsed) {
    state.todos.forEach(t => {
      if (getChildCount(t.id) > 0) collapsedParents.add(t.id);
    });
  }
  renderTodoView();
  renderExpenseView();
  if (typeof renderScheduleView === 'function') renderScheduleView();
  showToast('⚙️ 设置已保存');
}

function handleSaveExpense() {
  const amountStr = document.getElementById('inputAmount').value;
  const amount = parseFloat(amountStr);
  const date = document.getElementById('inputDate').value || today();
  const note = document.getElementById('inputNote').value.trim();
  const saveTpl = document.getElementById('chkSaveTemplate').checked;

  if (!amount || amount <= 0) { showToast('请输入有效金额'); document.getElementById('inputAmount').focus(); return; }
  if (!selectedCategory) { showToast('请选择分类'); return; }

  addExpense({ type: modalType, amount, category: selectedCategory, note, date, image: pendingImage || null });

  if (saveTpl) {
    const cats = getMergedCategories(modalType);
    const cat = cats.find(c => c.key === selectedCategory);
    addTemplate({ name: note || (cat ? cat.name : ''), type: modalType, category: selectedCategory, amount, note });
  }

  // 先渲染DOM再关弹窗，确保列表数据已更新
  renderExpenseView();
  closeExpenseModal();
  showToast(modalType === 'expense' ? '支出已记录 ✓' : '收入已记录 ✓');
}
