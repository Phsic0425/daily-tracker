/* ============================================
   account.js — 总资产 / 账户 CRUD
   ============================================ */

function getAccounts() {
  return state.accounts || [];
}

function getAccountById(id) {
  return state.accounts.find(a => a.id === id) || null;
}

function getTotalAssets() {
  return state.accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
}

function addAccount(record) {
  const acc = {
    id: genId(),
    name: record.name,
    type: record.type || 'other',
    icon: record.icon || (ACCOUNT_TYPES.find(t => t.key === record.type) || ACCOUNT_TYPES[4]).icon,
    balance: parseFloat(record.balance) || 0,
    note: record.note || '',
    createdAt: new Date().toISOString(),
  };
  state.accounts.push(acc);
  saveData(state);
  return acc;
}

function updateAccount(id, record) {
  const acc = getAccountById(id);
  if (!acc) return;
  acc.name = record.name;
  acc.type = record.type || acc.type;
  acc.icon = record.icon || (ACCOUNT_TYPES.find(t => t.key === acc.type) || ACCOUNT_TYPES[4]).icon;
  acc.note = record.note || '';
  saveData(state);
}

function deleteAccount(id) {
  state.accounts = state.accounts.filter(a => a.id !== id);
  // 解除该账户下所有记账的关联，但保留记账记录本身
  state.expenses.forEach(e => { if (e.accountId === id) e.accountId = ''; });
  saveData(state);
}

// 调整账户余额（delta 为正数增加，负数减少）
function adjustAccountBalance(id, delta) {
  const acc = getAccountById(id);
  if (!acc) return;
  acc.balance = Math.round((acc.balance + delta) * 100) / 100;
}

// 记账对账户余额的影响方向：支出减少余额，收入增加余额
function applyExpenseToAccount(record) {
  if (!record.accountId) return;
  const delta = record.type === 'income' ? record.amount : -record.amount;
  adjustAccountBalance(record.accountId, delta);
}

function revertExpenseFromAccount(record) {
  if (!record.accountId) return;
  const delta = record.type === 'income' ? -record.amount : record.amount;
  adjustAccountBalance(record.accountId, delta);
}
