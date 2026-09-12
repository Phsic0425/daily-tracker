/* ============================================
   templates.js — 快捷模板 CRUD
   ============================================ */

function getTemplates() {
  if (!state.templates) state.templates = [];
  return state.templates;
}

function addTemplate(tpl) {
  state.templates.push({
    id: genId(),
    name: tpl.name,
    type: tpl.type,
    category: tpl.category,
    amount: parseFloat(tpl.amount),
    note: tpl.note || '',
    createdAt: new Date().toISOString(),
    updatedAt: Date.now(),
  });
  saveData(state);
}

function deleteTemplate(id) {
  state.templates = state.templates.filter(t => t.id !== id);
  markDeleted(id);
  saveData(state);
}

function recordFromTemplate(tpl) {
  addExpense({
    type: tpl.type,
    amount: tpl.amount,
    category: tpl.category,
    note: tpl.note,
    date: today(),
    accountId: (typeof lastAccountId !== 'undefined' && lastAccountId) || (state.assets[0] && state.assets[0].id) || null,
  });
  renderExpenseView();
  const txt = tpl.type === 'expense' ? '支出' : '收入';
  showToast(`⚡ ${tpl.name || txt} ${fmtMoney(tpl.amount)} 已记录`);
}
