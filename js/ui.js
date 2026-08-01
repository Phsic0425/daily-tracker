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
      const cats = t.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
      const cat = cats.find(c => c.key === t.category) || { icon: '📦', name: t.category };
      const amountClass = t.type === 'expense' ? '' : 'income-tpl';
      const label = t.name || cat.name;
      return `
        <button class="tpl-chip${tplManaging ? ' managing' : ''}" data-tpl-id="${t.id}" data-action="record-tpl">
          <span class="tpl-icon">${cat.icon}</span>
          <span>${escapeHtml(label)}</span>
          <span class="tpl-amount ${amountClass}">${fmtMoney(t.amount)}</span>
          <span class="tpl-delete-btn" data-action="delete-tpl" data-id="${t.id}">✕</span>
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
        const cats = item.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
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
  document.getElementById('activeCount').textContent = todos.length;

  // 更新排序模式按钮状态
  document.querySelectorAll('.sort-mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.sort === todoSortMode);
  });

  if (todos.length === 0) {
    container.innerHTML = '<p class="empty-hint">没有待办，添加一个吧</p>';
    return;
  }

  let html = '';
  todos.forEach(t => {
    const overdue = isOverdue(t.deadline);
    const p = PRIORITY_MAP[t.priority] || PRIORITY_MAP['medium'];
    const hasStart = t.startDate && t.startDate.trim();
    const dateHtml = hasStart
      ? `<span class="todo-deadline${overdue ? ' overdue' : ''}">📅 ${fmtDateShort(t.startDate)} → ${fmtDateShort(t.deadline)}${overdue ? ' ⚠️已逾期' : ''}</span>`
      : `<span class="todo-deadline${overdue ? ' overdue' : ''}">📅 ${fmtDateShort(t.deadline)}${overdue ? ' ⚠️已逾期' : ''}</span>`;
    const checked = todoBatchSelected.has(t.id);
    html += `
      <div class="todo-item${t.pinned ? ' pinned' : ''}" data-id="${t.id}">
        ${todoBatchDeleting ? `<div class="batch-checkbox${checked ? ' checked' : ''}" data-action="todo-batch-check" data-id="${t.id}">✓</div>` : ''}
        ${!todoBatchDeleting ? `<button class="todo-check" data-action="toggle-todo" data-id="${t.id}" title="点击两次完成">✓</button>` : ''}
        <div class="todo-body">
          <div class="todo-title-text">${t.pinned ? '📌 ' : ''}${escapeHtml(t.title)}</div>
          <div class="todo-meta">
            <span class="priority-dot ${p.dot}" title="${p.emoji} ${p.label}优先"></span>
            ${dateHtml}
          </div>
        </div>
        ${!todoBatchDeleting ? `<button class="todo-pin${t.pinned ? ' pinned' : ''}" data-action="pin-todo" data-id="${t.id}" title="${t.pinned ? '取消置顶' : '置顶'}">📌</button>` : ''}
        ${!todoBatchDeleting ? `<button class="todo-delete" data-action="delete-todo" data-id="${t.id}" title="删除">🗑</button>` : ''}
      </div>`;
  });
  container.innerHTML = html;
}

function renderCompletedTodos() {
  const container = document.getElementById('completedTodoList');
  const todos = getCompletedTodos();
  document.getElementById('completedCount').textContent = todos.length;

  // 收起时隐藏批量操作
  if (completedCollapsed) {
    container.innerHTML = '';
    document.getElementById('completedBatchActions').style.display = 'none';
    document.getElementById('btnCompletedBatchDel').style.display = 'none';
    return;
  }
  // 展开时恢复批量删除按钮
  document.getElementById('btnCompletedBatchDel').style.display = '';
  if (completedBatchDeleting) {
    document.getElementById('completedBatchActions').style.display = 'flex';
  }

  if (todos.length === 0) {
    container.innerHTML = '';
    // 无待办时隐藏批量删除
    document.getElementById('btnCompletedBatchDel').style.display = 'none';
    document.getElementById('completedBatchActions').style.display = 'none';
    return;
  }

  let html = '';
  todos.forEach(t => {
    const p = PRIORITY_MAP[t.priority] || PRIORITY_MAP['medium'];
    const doneDate = t.completedAt ? fmtDateShort(t.completedAt.slice(0, 10)) : '';
    const hasStart = t.startDate && t.startDate.trim();
    const dateHtml = hasStart
      ? `📅 ${fmtDateShort(t.startDate)} → ${fmtDateShort(t.deadline)}`
      : `📅 ${fmtDateShort(t.deadline)}`;
    const checked = completedBatchSelected.has(t.id);
    html += `
      <div class="todo-item completed-item" data-id="${t.id}">
        ${completedBatchDeleting ? `<div class="batch-checkbox${checked ? ' checked' : ''}" data-action="completed-batch-check" data-id="${t.id}">✓</div>` : ''}
        <div class="todo-check done">✓</div>
        <div class="todo-body">
          <div class="todo-title-text">${escapeHtml(t.title)}</div>
          <div class="todo-meta">
            <span class="priority-dot ${p.dot}"></span>
            <span class="todo-deadline">${dateHtml}</span>
            <span class="completed-at">· 完成于 ${doneDate}</span>
          </div>
        </div>
        ${!completedBatchDeleting ? `<button class="todo-delete" data-action="delete-todo" data-id="${t.id}" title="删除">🗑</button>` : ''}
      </div>`;
  });
  container.innerHTML = html;
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
  const cats = modalType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
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
    const cats = modalType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    const cat = cats.find(c => c.key === selectedCategory);
    addTemplate({ name: note || (cat ? cat.name : ''), type: modalType, category: selectedCategory, amount, note });
  }

  // 先渲染DOM再关弹窗，确保列表数据已更新
  renderExpenseView();
  closeExpenseModal();
  showToast(modalType === 'expense' ? '支出已记录 ✓' : '收入已记录 ✓');
}
