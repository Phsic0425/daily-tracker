/* ============================================
   events.js — 所有事件绑定
   ============================================ */

function setupEvents() {
  // ---- 标签切换 ----
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(target === 'expense' ? 'tabExpense' : 'tabTodo').classList.add('active');
      if (target === 'todo') renderTodoView();
      if (target === 'expense') renderExpenseView();
    });
  });

  // ---- 待办排序模式切换 ----
  document.querySelectorAll('.sort-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      todoSortMode = btn.dataset.sort;
      renderActiveTodos();
    });
  });

  // ---- 月份导航 ----
  document.getElementById('btnPrevMonth').addEventListener('click', () => {
    viewMonth.month--;
    if (viewMonth.month === 0) { viewMonth.month = 12; viewMonth.year--; }
    try { renderExpenseView(); } catch(e) { console.error(e); }
  });
  document.getElementById('btnNextMonth').addEventListener('click', () => {
    viewMonth.month++;
    if (viewMonth.month === 13) { viewMonth.month = 1; viewMonth.year++; }
    try { renderExpenseView(); } catch(e) { console.error(e); }
  });
  const monthPicker = document.getElementById('monthPicker');
  let _applyingMonth = false; // 防重入
  function applyMonthChange() {
    if (_applyingMonth) return;
    const val = monthPicker.value;
    if (!val) return;
    const [y, m] = val.split('-');
    const ny = parseInt(y), nm = parseInt(m);
    if (ny === viewMonth.year && nm === viewMonth.month) return; // 没变化
    _applyingMonth = true;
    viewMonth.year = ny;
    viewMonth.month = nm;
    try { renderExpenseView(); } catch(e) { console.error(e); }
    _applyingMonth = false;
  }
  monthPicker.addEventListener('change', applyMonthChange);
  // 移动端只监听 change，避免 blur+change 双重触发
  if (!('ontouchstart' in window)) {
    monthPicker.addEventListener('blur', applyMonthChange);
  }

  // ---- FAB ----
  document.getElementById('fabAdd').addEventListener('click', () => {
    const activeTab = document.querySelector('.tab.active');
    if (activeTab && activeTab.dataset.tab === 'todo') {
      document.getElementById('todoTitle').focus();
    } else {
      openExpenseModal();
    }
  });

  // ---- 记账弹窗 ----
  document.querySelector('.type-toggle').addEventListener('click', e => {
    const btn = e.target.closest('.type-btn');
    if (!btn) return;
    modalType = btn.dataset.type;
    selectedCategory = (modalType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES)[0].key;
    updateTypeToggle();
    renderCategoryOptions();
  });
  document.getElementById('categoryGrid').addEventListener('click', e => {
    const btn = e.target.closest('.cat-option');
    if (!btn) return;
    selectedCategory = btn.dataset.cat;
    renderCategoryOptions();
  });
  document.getElementById('btnSave').addEventListener('click', handleSaveExpense);
  document.getElementById('btnCancel').addEventListener('click', closeExpenseModal);
  document.getElementById('overlay').addEventListener('click', closeExpenseModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeExpenseModal(); });

  // ---- 拍照 & 剪贴板 ----
  document.getElementById('btnRemoveImg').addEventListener('click', (e) => {
    e.preventDefault();
    pendingImage = null;
    updateCameraButton();
  });
  document.getElementById('inputAmount').addEventListener('focus', async () => {
    if (document.getElementById('inputAmount').value) return;
    try {
      const text = await navigator.clipboard.readText();
      const match = text.match(/(?:¥|￥)?\s*([\d,]+\.?\d{0,2})/);
      if (match) {
        const num = parseFloat(match[1].replace(/,/g, ''));
        if (num > 0 && num < 1000000) {
          document.getElementById('inputAmount').value = num;
          showToast('📋 已从剪贴板提取金额: ' + fmtMoney(num));
        }
      }
    } catch(e) {}
  });
  document.getElementById('btnCamera').addEventListener('click', () => document.getElementById('inputImage').click());
  document.getElementById('inputImage').addEventListener('change', (e) => {
    if (e.target.files[0]) handleImageSelect(e.target.files[0]);
    e.target.value = '';
  });

  // ---- 账单列表（图片预览 / 删除 / 批量勾选）----
  document.getElementById('expenseList').addEventListener('click', e => {
    const checkBtn = e.target.closest('[data-action="batch-check"]');
    if (checkBtn) {
      const id = checkBtn.dataset.id;
      if (batchSelected.has(id)) { batchSelected.delete(id); checkBtn.classList.remove('checked'); }
      else { batchSelected.add(id); checkBtn.classList.add('checked'); }
      document.getElementById('batchCount').textContent = `已选 ${batchSelected.size} 条`;
      return;
    }
    const imgBtn = e.target.closest('[data-action="preview-img"]');
    if (imgBtn) { showImagePreview(imgBtn.dataset.src); return; }
    const delBtn = e.target.closest('[data-action="delete-expense"]');
    if (!delBtn) return;
    if (confirm('确定要删除这条记录吗？')) {
      deleteExpense(delBtn.dataset.id);
      showToast('已删除');
      renderExpenseView();
    }
  });

  // ---- 批量删除操作 ----
  document.getElementById('btnSelectAll').addEventListener('click', () => {
    const list = getMonthExpenses(viewMonth.year, viewMonth.month);
    if (batchSelected.size === list.length) { batchSelected.clear(); }
    else { list.forEach(e => batchSelected.add(e.id)); }
    renderExpenseList();
    document.getElementById('batchCount').textContent = `已选 ${batchSelected.size} 条`;
  });
  document.getElementById('btnDeleteSelected').addEventListener('click', () => {
    if (batchSelected.size === 0) { showToast('请先选择要删除的账单'); return; }
    if (!confirm(`确定要删除选中的 ${batchSelected.size} 条记录吗？此操作不可恢复。`)) return;
    const delCount = batchSelected.size;
    batchSelected.forEach(id => deleteExpense(id));
    batchSelected.clear();
    showToast(`已删除 ${delCount} 条`);
    batchDeleting = false;
    document.getElementById('batchActions').style.display = 'none';
    document.getElementById('btnBatchDel').textContent = '批量删除';
    renderExpenseView();
  });

  // ---- 模板：点击记账 / 管理 ----
  document.getElementById('templateList').addEventListener('click', e => {
    const chip = e.target.closest('[data-action="record-tpl"]');
    if (!chip) {
      const addBtn = e.target.closest('#btnAddTpl');
      if (addBtn) openExpenseModal();
      return;
    }
    const id = chip.dataset.tplId;
    if (tplManaging) {
      if (confirm('确定要删除这个模板吗？')) { deleteTemplate(id); renderTemplates(); showToast('模板已删除'); }
      return;
    }
    const tpl = getTemplates().find(t => t.id === id);
    if (tpl) recordFromTemplate(tpl);
  });

  // ---- 待办批量删除操作 ----
  document.getElementById('btnTodoSelectAll').addEventListener('click', () => {
    const list = getActiveTodos(todoSortMode);
    if (todoBatchSelected.size === list.length) { todoBatchSelected.clear(); }
    else { list.forEach(t => todoBatchSelected.add(t.id)); }
    renderActiveTodos();
    document.getElementById('todoBatchCount').textContent = `已选 ${todoBatchSelected.size} 条`;
  });
  document.getElementById('btnTodoDeleteSelected').addEventListener('click', () => {
    if (todoBatchSelected.size === 0) { showToast('请先选择要删除的待办'); return; }
    if (!confirm(`确定要删除选中的 ${todoBatchSelected.size} 条待办吗？此操作不可恢复。`)) return;
    const delCount = todoBatchSelected.size;
    todoBatchSelected.forEach(id => deleteTodo(id));
    todoBatchSelected.clear();
    showToast(`已删除 ${delCount} 条`);
    todoBatchDeleting = false;
    document.getElementById('todoBatchActions').style.display = 'none';
    document.getElementById('btnTodoBatchDel').textContent = '批量删除';
    renderTodoView();
  });

  // ---- 已完成待办批量删除操作 ----
  document.getElementById('btnCompletedSelectAll').addEventListener('click', () => {
    const list = getCompletedTodos();
    if (completedBatchSelected.size === list.length) { completedBatchSelected.clear(); }
    else { list.forEach(t => completedBatchSelected.add(t.id)); }
    renderCompletedTodos();
    document.getElementById('completedBatchCount').textContent = `已选 ${completedBatchSelected.size} 条`;
  });
  document.getElementById('btnCompletedDeleteSelected').addEventListener('click', () => {
    if (completedBatchSelected.size === 0) { showToast('请先选择要删除的已完成待办'); return; }
    if (!confirm(`确定要删除选中的 ${completedBatchSelected.size} 条已完成待办吗？此操作不可恢复。`)) return;
    const delCount = completedBatchSelected.size;
    completedBatchSelected.forEach(id => deleteTodo(id));
    completedBatchSelected.clear();
    showToast(`已删除 ${delCount} 条`);
    completedBatchDeleting = false;
    document.getElementById('completedBatchActions').style.display = 'none';
    document.getElementById('btnCompletedBatchDel').textContent = '批量删除';
    renderCompletedTodos();
    updateTodoBadge();
  });

  // ---- 待办表单 ----
  document.getElementById('todoForm').addEventListener('submit', e => {
    e.preventDefault();
    const title = document.getElementById('todoTitle').value.trim();
    const startDate = document.getElementById('todoStartDate').value;
    const deadline = document.getElementById('todoDeadline').value;
    const priority = document.getElementById('todoPriority').value;
    if (!title) { showToast('请输入待办内容'); return; }
    if (!deadline) { showToast('请选择截止时间'); return; }
    if (startDate && startDate > deadline) { showToast('开始日期不能晚于截止日期'); return; }
    addTodo({ title, startDate, deadline, priority });
    document.getElementById('todoTitle').value = '';
    document.getElementById('todoStartDate').value = '';
    document.getElementById('todoDeadline').value = today(); // 重置为当天
    document.getElementById('todoTitle').focus();
    showToast('待办已添加 ✓');
    renderTodoView();
  });

  // ---- 待办列表（双击确认完成 / 批量勾选）----
  document.getElementById('activeTodoList').addEventListener('click', e => {
    // 批量勾选
    const batchCheck = e.target.closest('[data-action="todo-batch-check"]');
    if (batchCheck) {
      const id = batchCheck.dataset.id;
      if (todoBatchSelected.has(id)) { todoBatchSelected.delete(id); batchCheck.classList.remove('checked'); }
      else { todoBatchSelected.add(id); batchCheck.classList.add('checked'); }
      document.getElementById('todoBatchCount').textContent = `已选 ${todoBatchSelected.size} 条`;
      return;
    }
    const pinBtn = e.target.closest('[data-action="pin-todo"]');
    if (pinBtn) {
      togglePinTodo(pinBtn.dataset.id);
      renderActiveTodos();
      return;
    }
    const checkBtn = e.target.closest('[data-action="toggle-todo"]');
    if (checkBtn) {
      const id = checkBtn.dataset.id;
      if (pendingConfirmId === id) {
        clearPendingConfirm();
        toggleTodo(id);
        const item = checkBtn.closest('.todo-item');
        if (item) triggerConfetti(item);
        showToast('🎉 已完成！');
        renderTodoView();
      } else {
        clearPendingConfirm();
        pendingConfirmId = id;
        checkBtn.classList.add('confirming');
        const hint = document.createElement('span');
        hint.className = 'todo-confirm-hint';
        hint.textContent = '再点确认';
        checkBtn.after(hint);
        pendingConfirmTimer = setTimeout(clearPendingConfirm, 3000);
      }
      return;
    }
    const delBtn = e.target.closest('[data-action="delete-todo"]');
    if (delBtn) {
      clearPendingConfirm();
      if (confirm('确定要删除这个待办吗？')) { deleteTodo(delBtn.dataset.id); showToast('已删除'); renderTodoView(); }
      return;
    }
    clearPendingConfirm();
  });

  // ---- 已完成列表 ----
  document.getElementById('completedTodoList').addEventListener('click', e => {
    // 批量勾选
    const batchCheck = e.target.closest('[data-action="completed-batch-check"]');
    if (batchCheck) {
      const id = batchCheck.dataset.id;
      if (completedBatchSelected.has(id)) { completedBatchSelected.delete(id); batchCheck.classList.remove('checked'); }
      else { completedBatchSelected.add(id); batchCheck.classList.add('checked'); }
      document.getElementById('completedBatchCount').textContent = `已选 ${completedBatchSelected.size} 条`;
      return;
    }
    const checkBtn = e.target.closest('[data-action="toggle-todo"]');
    if (checkBtn) { clearPendingConfirm(); toggleTodo(checkBtn.dataset.id); showToast('已恢复'); renderTodoView(); return; }
    const delBtn = e.target.closest('[data-action="delete-todo"]');
    if (delBtn) {
      clearPendingConfirm();
      if (confirm('确定要删除这个待办吗？')) { deleteTodo(delBtn.dataset.id); showToast('已删除'); renderTodoView(); }
    }
  });
  document.getElementById('completedHeader').addEventListener('click', (e) => {
    // 不拦截按钮点击（批量删除等）
    if (e.target.closest('button')) return;
    completedCollapsed = !completedCollapsed;
    document.querySelector('.collapse-arrow').classList.toggle('collapsed', completedCollapsed);
    renderCompletedTodos();
  });

  // ---- 更多菜单 ----
  const moreMenu = document.getElementById('moreMenu');
  document.getElementById('btnMore').addEventListener('click', (e) => {
    e.stopPropagation();
    moreMenu.style.display = moreMenu.style.display === 'none' ? 'block' : 'none';
  });
  document.addEventListener('click', () => { moreMenu.style.display = 'none'; });

  // ---- 报表 ----
  document.getElementById('btnShowReport').addEventListener('click', (e) => {
    e.stopPropagation(); moreMenu.style.display = 'none'; openReport();
  });
  document.getElementById('btnCloseReport').addEventListener('click', closeReport);
  document.getElementById('reportOverlay').addEventListener('click', closeReport);
  document.getElementById('btnReportPrev').addEventListener('click', () => {
    reportMonth--;
    if (reportMonth === 0) { reportMonth = 12; reportYear--; }
    renderReport();
  });
  document.getElementById('btnReportNext').addEventListener('click', () => {
    reportMonth++;
    if (reportMonth === 13) { reportMonth = 1; reportYear++; }
    renderReport();
  });
  document.getElementById('btnReportPrevYear').addEventListener('click', () => {
    reportYear--;
    renderReport();
  });
  document.getElementById('btnReportNextYear').addEventListener('click', () => {
    reportYear++;
    renderReport();
  });

  // ---- PWA 安装 ----
  const banner = document.getElementById('installBanner');
  const installEntry = document.getElementById('installEntry');
  const installDismissed = localStorage.getItem('install_banner_dismissed');
  if (window.matchMedia('(display-mode: standalone)').matches) {
    banner.style.display = 'none';
    installEntry.style.display = 'none';
  }
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    if (!installDismissed) banner.style.display = 'flex';
  });
  async function doInstall() {
    if (!deferredPrompt) { showToast('💡 用 Chrome/Safari 打开，在浏览器菜单中选择「添加到主屏幕」'); return; }
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') { showToast('安装成功！'); banner.style.display = 'none'; installEntry.style.display = 'none'; }
    deferredPrompt = null;
    moreMenu.style.display = 'none';
  }
  document.getElementById('btnInstall').addEventListener('click', doInstall);
  document.getElementById('btnInstallEntry').addEventListener('click', doInstall);
  document.getElementById('btnDismissInstall').addEventListener('click', (e) => {
    e.stopPropagation(); banner.style.display = 'none'; localStorage.setItem('install_banner_dismissed', '1');
  });

  // ---- 数据导出/导入 ----
  document.getElementById('btnExportData').addEventListener('click', (e) => {
    e.stopPropagation();
    exportData();
    showToast('💾 数据已导出');
    moreMenu.style.display = 'none';
  });
  document.getElementById('btnImportData').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('importFileInput').click();
    moreMenu.style.display = 'none';
  });
  document.getElementById('importFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importData(reader.result);
      if (result.ok) {
        showToast(`📥 已导入：${result.counts.expenses} 条账单、${result.counts.todos} 条待办、${result.counts.templates} 个模板`);
        renderExpenseView();
        renderTodoView();
        updateTodoBadge();
      } else {
        showToast('❌ ' + result.error);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}
