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
      if (target === 'expense') document.getElementById('tabExpense').classList.add('active');
      else if (target === 'todo') document.getElementById('tabTodo').classList.add('active');
      else if (target === 'schedule') document.getElementById('tabSchedule').classList.add('active');
      if (target === 'todo') { renderTodoView(); closeSubTodoForm(); }
      if (target === 'expense') { renderExpenseView(); closeSubTodoForm(); }
      if (target === 'schedule') {
        scheduleSelectedDate = today();
        scheduleViewMonth = { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
        renderScheduleView();
      }
    });
  });

  // ---- 待办排序模式切换 ----
  document.querySelectorAll('.sort-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      todoSortMode = btn.dataset.sort;
      renderActiveTodos();
    });
  });
  // 排序正倒序切换
  const sortDirBtn = document.getElementById('btnSortDir');
  if (sortDirBtn) {
    sortDirBtn.addEventListener('click', () => {
      todoSortAsc = !todoSortAsc;
      settings.sortAsc = todoSortAsc;
      saveSettings(settings);
      renderActiveTodos();
    });
  }

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
    } else if (activeTab && activeTab.dataset.tab === 'schedule') {
      if (scheduleViewMode === 'timetable') openCourseModal(null);
      else openScheduleModal(scheduleSelectedDate);
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
  document.getElementById('chkByBalance').addEventListener('change', e => {
    byBalanceMode = e.target.checked;
    updateByBalanceUI();
  });
  document.getElementById('inputAccount').addEventListener('change', () => {
    if (byBalanceMode) refreshByBalanceHint();
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
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (document.getElementById('helpModal').classList.contains('show')) closeHelp();
      else if (document.getElementById('scheduleModal').classList.contains('show')) closeScheduleModal();
      else if (document.getElementById('courseModal').classList.contains('show')) closeCourseModal();
      else if (document.getElementById('assetModal').classList.contains('show')) closeAssetModal();
      else closeExpenseModal();
    }
  });

  // ---- 资产 ----
  document.getElementById('btnOpenAssets').addEventListener('click', () => openAssetModal());
  document.getElementById('btnCloseAsset').addEventListener('click', closeAssetModal);
  document.getElementById('assetOverlay').addEventListener('click', closeAssetModal);
  document.getElementById('btnShowAssetForm').addEventListener('click', () => showAssetForm(null));
  document.getElementById('btnCancelAssetForm').addEventListener('click', () => { hideAssetForms(); renderAssets(); });
  document.getElementById('btnSaveAsset').addEventListener('click', handleSaveAsset);
  document.getElementById('btnShowTransfer').addEventListener('click', showTransferForm);
  document.getElementById('btnCancelTransfer').addEventListener('click', () => { hideAssetForms(); renderAssets(); });
  document.getElementById('btnDoTransfer').addEventListener('click', handleTransfer);
  document.getElementById('assetList').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'asset-set') {
      const a = state.assets.find(x => x.id === id);
      if (!a) return;
      const val = prompt('把「' + a.name + '」余额设为（当前 ' + fmtMoney(a.balance) + '）：', a.balance);
      if (val === null) return;
      const num = parseFloat(val);
      if (isNaN(num)) { showToast('无效金额'); return; }
      setAssetBalance(id, num);
      showToast('✅ 余额已更新');
      renderAssets();
      renderAssetOverview();
      return;
    }
    if (btn.dataset.action === 'asset-edit') { showAssetForm(id); return; }
    if (btn.dataset.action === 'asset-delete') {
      const a = state.assets.find(x => x.id === id);
      if (!confirm('确定删除账户「' + (a ? a.name : '') + '」？')) return;
      deleteAsset(id);
      showToast('已删除');
      renderAssets();
      renderAssetOverview();
      renderAccountOptions();
      return;
    }
  });

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

  // ---- 退出子任务模式 ----
  document.getElementById('btnExitSubTodo').addEventListener('click', () => {
    closeSubTodoForm();
    document.getElementById('todoTitle').focus();
  });
  // Escape 退出子任务模式
  document.getElementById('todoTitle').addEventListener('keydown', e => {
    if (e.key === 'Escape' && subTodoParentId) {
      closeSubTodoForm();
      document.getElementById('todoTitle').placeholder = '输入待办事项...';
    }
  });

  // ---- 待办表单 ----
  document.getElementById('todoForm').addEventListener('submit', e => {
    e.preventDefault();
    const title = document.getElementById('todoTitle').value.trim();
    const deadline = document.getElementById('todoDeadline').value;
    const priority = document.getElementById('todoPriority').value;
    const note = document.getElementById('todoNote').value.trim();
    if (!title) { showToast('请输入待办内容'); return; }
    if (!deadline) { showToast('请选择截止时间'); return; }

    const form = document.getElementById('todoForm');
    const parentId = form.dataset.parentId || null;

    addTodo({ title, deadline, priority, note, parentId });

    document.getElementById('todoTitle').value = '';
    document.getElementById('todoNote').value = '';
    document.getElementById('todoDeadline').value = today();
    document.getElementById('todoTitle').focus();
    showToast(parentId ? '子任务已添加 ✓' : '待办已添加 ✓');
    closeSubTodoForm();
    renderTodoView();
  });

  // ---- 待办列表（双击确认完成 / 批量勾选 / 编辑 / 子任务）----
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
    // 置顶
    const pinBtn = e.target.closest('[data-action="pin-todo"]');
    if (pinBtn) {
      togglePinTodo(pinBtn.dataset.id);
      renderActiveTodos();
      return;
    }
    // 添加子任务
    const addChildBtn = e.target.closest('[data-action="add-child"]');
    if (addChildBtn) {
      openSubTodoForm(addChildBtn.dataset.id);
      return;
    }
    // 折叠/展开子任务
    const collapseBtn = e.target.closest('[data-action="collapse-todo"]');
    if (collapseBtn) {
      const id = collapseBtn.dataset.id;
      if (collapsedParents.has(id)) collapsedParents.delete(id);
      else collapsedParents.add(id);
      renderTodoView();
      return;
    }
    // 编辑待办
    const editBtn = e.target.closest('[data-action="edit-todo"]');
    if (editBtn) {
      openTodoEditForm(editBtn.dataset.id);
      return;
    }
    // 编辑备注
    const noteEl = e.target.closest('[data-action="edit-note"]');
    if (noteEl) {
      startInlineNoteEdit(noteEl.dataset.id, noteEl);
      return;
    }
    // 保存编辑
    const saveEditBtn = e.target.closest('[data-action="save-edit"]');
    if (saveEditBtn) {
      const item = saveEditBtn.closest('.todo-item');
      if (item) { saveTodoEdit(item.dataset.id); }
      return;
    }
    // 取消编辑
    const cancelEditBtn = e.target.closest('[data-action="cancel-edit"]');
    if (cancelEditBtn) {
      cancelTodoEdit();
      return;
    }
    // 完成/恢复
    const checkBtn = e.target.closest('[data-action="toggle-todo"]');
    if (checkBtn) {
      const id = checkBtn.dataset.id;
      if (pendingConfirmId === id) {
        clearPendingConfirm();
        const result = toggleTodo(id);
        if (result === 'has-incomplete-children') {
          if (confirm('该待办下还有未完成的子任务，确定要全部完成吗？')) {
            // 强制完成：先完成所有子待办，再完成父待办
            forceCompleteWithChildren(id);
            const item = checkBtn.closest('.todo-item');
            if (item) triggerConfetti(item);
            showToast('🎉 已全部完成！');
          }
        } else {
          const item = checkBtn.closest('.todo-item');
          if (item) triggerConfetti(item);
          showToast('🎉 已完成！');
        }
        renderTodoView();
      } else {
        clearPendingConfirm();
        // 如果已经完成，直接恢复
        const todo = state.todos.find(t => t.id === id);
        if (todo && todo.completed) {
          toggleTodo(id);
          showToast('已恢复');
          renderTodoView();
          return;
        }
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
      if (confirm('确定要删除这个待办吗？（含所有子任务）')) { deleteTodo(delBtn.dataset.id); showToast('已删除'); renderTodoView(); }
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
    const collapseBtn2 = e.target.closest('[data-action="collapse-todo"]');
    if (collapseBtn2) {
      const id = collapseBtn2.dataset.id;
      if (collapsedParents.has(id)) collapsedParents.delete(id);
      else collapsedParents.add(id);
      renderTodoView();
      return;
    }
    const checkBtn = e.target.closest('[data-action="toggle-todo"]');
    if (checkBtn) { clearPendingConfirm(); toggleTodo(checkBtn.dataset.id); showToast('已恢复'); renderTodoView(); return; }
    const delBtn = e.target.closest('[data-action="delete-todo"]');
    if (delBtn) {
      clearPendingConfirm();
      if (confirm('确定要删除这个待办吗？（含所有子任务）')) { deleteTodo(delBtn.dataset.id); showToast('已删除'); renderTodoView(); }
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

  // ---- 设置弹窗 ----
  document.getElementById('btnShowSettings').addEventListener('click', (e) => {
    e.stopPropagation();
    openSettings();
    moreMenu.style.display = 'none';
  });
  document.getElementById('btnCloseSettings').addEventListener('click', () => {
    handleSaveSettings();
    closeSettings();
  });
  document.getElementById('settingsOverlay').addEventListener('click', () => {
    handleSaveSettings();
    closeSettings();
  });
  // 设置内实时联动
  document.getElementById('settingsContent').addEventListener('change', (e) => {
    const id = e.target.id;
    if (id === 'settingSortAsc') {
      const hint = e.target.closest('.switch-label').querySelector('.switch-hint');
      if (hint) hint.textContent = e.target.checked ? '升序' : '倒序';
    }
  });
  // 云端同步按钮
  document.getElementById('settingsContent').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const statusEl = document.getElementById('syncStatus');
    const id = btn.id;

    if (id === 'btnSyncCreate') {
      if (!settings.gistToken) { showToast('请先在上方填写 GitHub Token'); return; }
      statusEl.textContent = '创建中...';
      syncCreate(function(gid) {
        if (gid) {
          showToast('☁️ 同步已创建，可用「复制连接码」连接另一台设备');
          initSync();
          renderSettings();
        } else {
          statusEl.textContent = '❌ 失败，检查 Token 与网络';
        }
      });
      return;
    }
    if (id === 'btnSyncConnect') {
      (async function() {
        let code = '';
        try { code = await navigator.clipboard.readText(); } catch(err) {}
        if (!code || code.indexOf('DT4:') !== 0) {
          code = prompt('请粘贴连接码：', '') || '';
        }
        if (!code) return;
        const result = await importConnectionCode(code.trim());
        if (result.ok) {
          showToast('🔗 已连接，正在拉取数据...');
          initSync();
          syncDownload();
          renderSettings();
        } else {
          showToast('❌ ' + result.error);
        }
      })();
      return;
    }
    if (id === 'btnSyncCopyConn') {
      (async function() {
        const code = await exportConnectionCode();
        try { await navigator.clipboard.writeText(code); showToast('📋 连接码已复制，在另一设备「连接同步」粘贴'); }
        catch(err) { prompt('请手动复制连接码：', code); }
      })();
      return;
    }
    if (id === 'btnSyncPull') {
      if (!settings.gistId) { showToast('请先新建或连接同步'); return; }
      statusEl.textContent = '下载中...';
      syncDownload(function(ok) {
        statusEl.textContent = ok ? '✅ 下载完成' : '❌ 下载失败';
        setTimeout(function() { statusEl.textContent = ''; }, 3000);
      });
      return;
    }
    if (id === 'btnSyncPush') {
      if (!settings.gistId) { showToast('请先新建或连接同步'); return; }
      statusEl.textContent = '上传中...';
      syncUpload(function(ok) {
        statusEl.textContent = ok ? '✅ 上传完成' : '❌ 上传失败';
        setTimeout(function() { statusEl.textContent = ''; }, 3000);
      });
      return;
    }
    if (id === 'btnSyncHistory') { renderSyncHistoryList(); return; }
    if (id === 'btnSnapshotExport') { exportSnapshotsFile(); return; }
    if (id === 'btnSnapshotList') { renderSnapshotList(); return; }

    // 历史回滚
    if (btn.dataset.action === 'sync-revert') {
      if (!confirm('回滚到该历史版本？当前数据会被替换为那个时间点的云端数据。')) return;
      syncRevert(btn.dataset.sha, function(ok) {
        if (ok) { showToast('✅ 已回滚，正在拉取...'); syncDownload(); }
        else showToast('❌ 回滚失败');
      });
      return;
    }
    // 快照恢复
    if (btn.dataset.action === 'snapshot-restore') {
      if (!confirm('恢复到此快照？当前数据会被替换。')) return;
      if (restoreSnapshot(parseInt(btn.dataset.ts))) {
        showToast('✅ 已恢复');
        renderExpenseView(); renderTodoView(); updateTodoBadge();
        if (typeof renderScheduleView === 'function') renderScheduleView();
      } else {
        showToast('❌ 恢复失败');
      }
      return;
    }
  });

  // 分类管理事件
  document.getElementById('settingsContent').addEventListener('click', e => {
    // 删除分类
    const delBtn = e.target.closest('.cat-tag-del');
    if (delBtn) {
      const key = delBtn.dataset.catKey;
      const type = delBtn.dataset.type;
      const isCustom = delBtn.dataset.isCustom === 'true';
      if (isCustom) {
        // 自定义分类：从 custom 列表移除
        if (type === 'expense') {
          settings.customExpenseCategories = settings.customExpenseCategories.filter(c => c.key !== key);
        } else {
          settings.customIncomeCategories = settings.customIncomeCategories.filter(c => c.key !== key);
        }
      } else {
        // 默认分类：加入 deleted 列表
        const deletedKey = type === 'expense' ? 'deletedExpenseCategories' : 'deletedIncomeCategories';
        if (!settings[deletedKey]) settings[deletedKey] = [];
        if (!settings[deletedKey].includes(key)) settings[deletedKey].push(key);
      }
      saveSettings(settings);
      renderSettings();
      return;
    }
    // 添加支出分类（默认图标 📦）
    if (e.target.id === 'btnAddExpenseCat') {
      const nameEl = document.getElementById('newExpenseCatName');
      const name = nameEl.value.trim();
      if (!name) { showToast('请输入分类名称'); return; }
      const key = 'custom_' + Date.now().toString(36);
      if (!settings.customExpenseCategories) settings.customExpenseCategories = [];
      settings.customExpenseCategories.push({ key, icon: '📦', name });
      saveSettings(settings);
      renderSettings();
      nameEl.value = '';
      return;
    }
    // 添加收入分类（默认图标 📦）
    if (e.target.id === 'btnAddIncomeCat') {
      const nameEl = document.getElementById('newIncomeCatName');
      const name = nameEl.value.trim();
      if (!name) { showToast('请输入分类名称'); return; }
      const key = 'custom_' + Date.now().toString(36);
      if (!settings.customIncomeCategories) settings.customIncomeCategories = [];
      settings.customIncomeCategories.push({ key, icon: '📦', name });
      saveSettings(settings);
      renderSettings();
      nameEl.value = '';
      return;
    }
  });

  // ---- 说明书 ----
  document.getElementById('btnShowHelp').addEventListener('click', (e) => {
    e.stopPropagation();
    openHelp();
    moreMenu.style.display = 'none';
  });
  document.getElementById('btnCheckUpdate').addEventListener('click', (e) => {
    e.stopPropagation();
    moreMenu.style.display = 'none';
    if (typeof checkForUpdate === 'function') checkForUpdate();
  });
  document.getElementById('btnCloseHelp').addEventListener('click', closeHelp);
  document.getElementById('helpOverlay').addEventListener('click', closeHelp);
  // 复制同步码
  document.getElementById('btnCopySync').addEventListener('click', async (e) => {
    e.stopPropagation();
    moreMenu.style.display = 'none';
    var code = await exportSyncCode();
    try {
      await navigator.clipboard.writeText(code);
      showToast('📋 同步码已复制（' + Math.round(code.length/1024) + 'KB），在另一设备粘贴即可');
    } catch(err) {
      // fallback：显示在 prompt 中
      prompt('请手动复制同步码（Cmd+C）：', code);
    }
  });
  // 粘贴同步码
  document.getElementById('btnPasteSync').addEventListener('click', async (e) => {
    e.stopPropagation();
    moreMenu.style.display = 'none';
    var code = '';
    try {
      code = await navigator.clipboard.readText();
    } catch(err) { /* ignore */ }
    if (!code || code.length < 10) {
      code = prompt('请粘贴同步码：', '') || '';
    }
    if (!code) return;
    var result = await importSyncCode(code.trim());
    if (result.ok) {
      showToast('✅ 已同步：' + result.expenses + '账单 ' + result.todos + '待办 ' + result.schedules + '日程');
      renderExpenseView();
      renderTodoView();
      updateTodoBadge();
      if (typeof renderScheduleView === 'function') renderScheduleView();
    } else {
      showToast('❌ ' + result.error);
    }
  });
  // ========== 日程事件 ==========

  // ---- 日程视图模式切换（月/周）----
  document.querySelectorAll('.cal-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      scheduleViewMode = btn.dataset.mode;
      settings.scheduleViewMode = scheduleViewMode;
      saveSettings(settings);
      renderScheduleView();
    });
  });

  // ---- 日历月份/周导航 ----
  document.getElementById('btnCalPrev').addEventListener('click', () => {
    if (scheduleViewMode === 'week') {
      const d = new Date(scheduleSelectedDate + 'T00:00:00');
      d.setDate(d.getDate() - 7);
      scheduleSelectedDate = fmtDateStr(d);
      scheduleViewMonth = { year: d.getFullYear(), month: d.getMonth() + 1 };
      renderScheduleView();
      return;
    }
    scheduleViewMonth.month--;
    if (scheduleViewMonth.month === 0) { scheduleViewMonth.month = 12; scheduleViewMonth.year--; }
    renderScheduleView();
  });
  document.getElementById('btnCalNext').addEventListener('click', () => {
    if (scheduleViewMode === 'week') {
      const d = new Date(scheduleSelectedDate + 'T00:00:00');
      d.setDate(d.getDate() + 7);
      scheduleSelectedDate = fmtDateStr(d);
      scheduleViewMonth = { year: d.getFullYear(), month: d.getMonth() + 1 };
      renderScheduleView();
      return;
    }
    scheduleViewMonth.month++;
    if (scheduleViewMonth.month === 13) { scheduleViewMonth.month = 1; scheduleViewMonth.year++; }
    renderScheduleView();
  });
  document.getElementById('btnCalToday').addEventListener('click', () => {
    const now = new Date();
    scheduleViewMonth.year = now.getFullYear();
    scheduleViewMonth.month = now.getMonth() + 1;
    scheduleSelectedDate = today();
    renderScheduleView();
  });

  // ---- 日历设置快捷入口 ----
  document.getElementById('btnCalSettings').addEventListener('click', () => {
    openSettings();
    // 滚动到日历设置区域
    setTimeout(() => {
      const block = document.getElementById('settingBlockCalendar');
      if (block) block.scrollIntoView({ behavior: 'smooth' });
    }, 300);
  });

  // ---- 日程导出 ----
  // 长按导出日历图片
  let exportLongPressTimer;
  document.getElementById('btnExportSched').addEventListener('pointerdown', () => {
    exportLongPressTimer = setTimeout(() => {
      exportCalendarImage();
    }, 800);
  });
  document.getElementById('btnExportSched').addEventListener('pointerup', () => {
    clearTimeout(exportLongPressTimer);
  });
  document.getElementById('btnExportSched').addEventListener('pointerleave', () => {
    clearTimeout(exportLongPressTimer);
  });

  // ---- 日历日期点击 ----
  document.getElementById('calendarGrid').addEventListener('click', e => {
    const dayEl = e.target.closest('[data-action="select-date"]');
    if (!dayEl) return;
    scheduleSelectedDate = dayEl.dataset.date;
    renderCalendar(scheduleViewMonth.year, scheduleViewMonth.month);
    renderDayDetail(scheduleSelectedDate);
  });

  // ---- 周视图日期条点击 ----
  document.getElementById('weekStrip').addEventListener('click', e => {
    const dayEl = e.target.closest('[data-action="select-week-day"]');
    if (!dayEl) return;
    scheduleSelectedDate = dayEl.dataset.date;
    renderWeekView();
  });

  // ---- 周视图详情：点击日程项编辑 ----
  document.getElementById('weekDayDetail').addEventListener('click', e => {
    const item = e.target.closest('[data-action="edit-schedule"]');
    if (!item) return;
    openScheduleModal(scheduleSelectedDate, item.dataset.id);
  });

  // ---- 选中日期详情：点击日程项编辑 ----
  document.getElementById('scheduleDayDetail').addEventListener('click', e => {
    const item = e.target.closest('[data-action="edit-schedule"]');
    if (!item) return;
    openScheduleModal(scheduleSelectedDate, item.dataset.id);
  });

  // ---- 即将到来：点击跳转日期 ----
  document.getElementById('upcomingContent').addEventListener('click', e => {
    const item = e.target.closest('[data-action="goto-date"]');
    if (!item) return;
    const dateStr = item.dataset.date;
    scheduleSelectedDate = dateStr;
    const d = new Date(dateStr + 'T00:00:00');
    scheduleViewMonth.year = d.getFullYear();
    scheduleViewMonth.month = d.getMonth() + 1;
    renderScheduleView();
  });

  // ---- 日程弹窗 ----
  document.getElementById('btnSaveSchedule').addEventListener('click', handleSaveSchedule);
  document.getElementById('btnCancelSchedule').addEventListener('click', closeScheduleModal);
  document.getElementById('scheduleOverlay').addEventListener('click', closeScheduleModal);
  document.getElementById('btnDeleteSchedule').addEventListener('click', handleDeleteSchedule);

  // ---- 课程弹窗 ----
  document.getElementById('btnAddCourse').addEventListener('click', () => openCourseModal(null));
  document.getElementById('btnSaveCourse').addEventListener('click', handleSaveCourse);
  document.getElementById('btnCancelCourse').addEventListener('click', closeCourseModal);
  document.getElementById('courseOverlay').addEventListener('click', closeCourseModal);
  document.getElementById('btnDeleteCourse').addEventListener('click', handleDeleteCourse);
  document.getElementById('courseColorPicker').addEventListener('click', e => {
    const opt = e.target.closest('[data-action="pick-course-color"]');
    if (opt) setCourseColor(opt.dataset.color);
  });
  // 课表格子点击 → 编辑课程
  document.getElementById('timetable').addEventListener('click', e => {
    const item = e.target.closest('[data-action="edit-course"]');
    if (!item) return;
    openCourseModal(item.dataset.id);
  });

  // ---- 节次配置弹窗 ----
  document.addEventListener('click', e => {
    if (e.target.id === 'btnAddClassPeriod') {
      openPeriodModal(null);
      return;
    }
    const editBtn = e.target.closest('[data-action="edit-period"]');
    if (editBtn) {
      openPeriodModal(editBtn.dataset.id);
      return;
    }
    const delBtn = e.target.closest('[data-action="delete-period"]');
    if (delBtn) {
      handleDeletePeriod(delBtn.dataset.id);
      return;
    }
  });
  document.getElementById('btnSavePeriod').addEventListener('click', handleSavePeriod);
  document.getElementById('btnCancelPeriod').addEventListener('click', closePeriodModal);
  document.getElementById('periodOverlay').addEventListener('click', closePeriodModal);

  // 重复模式切换 → 动态配置区
  document.getElementById('schedRepeatMode').addEventListener('change', renderRepeatConfig);

  // 类型切换（事件 / 背景）
  document.getElementById('btnSchedTypeEvent').addEventListener('click', () => {
    scheduleFormType = 'event';
    renderScheduleType();
  });
  document.getElementById('btnSchedTypeBackground').addEventListener('click', () => {
    scheduleFormType = 'background';
    renderScheduleType();
  });

  // 结束日期变化 → 联动重复区显隐
  document.getElementById('schedEndDate').addEventListener('change', renderScheduleType);

  // 颜色选择
  document.getElementById('schedColorPicker').addEventListener('click', e => {
    const opt = e.target.closest('[data-action="pick-color"]');
    if (!opt) return;
    setScheduleColor(opt.dataset.color);
  });
}
