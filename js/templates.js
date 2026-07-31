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
  });
  saveData(state);
}

function deleteTemplate(id) {
  state.templates = state.templates.filter(t => t.id !== id);
  saveData(state);
}

function recordFromTemplate(tpl) {
  addExpense({
    type: tpl.type,
    amount: tpl.amount,
    category: tpl.category,
    note: tpl.note,
    date: today(),
  });
  renderExpenseView();
  const txt = tpl.type === 'expense' ? '支出' : '收入';
  showToast(`⚡ ${tpl.name || txt} ${fmtMoney(tpl.amount)} 已记录`);
}
