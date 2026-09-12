/* ============================================
   asset.js — 多账户资产 & 记账强联动
   ============================================ */

function addAsset(a) {
  state.assets.push({
    id: genId(),
    name: (a.name || '').trim(),
    icon: a.icon || '💰',
    type: a.type || 'cash',
    balance: Number(a.balance) || 0,
    unit: a.unit || '',
    quantity: a.quantity || null,
    price: a.price || null,
    createdAt: new Date().toISOString(),
    updatedAt: Date.now(),
  });
  saveData(state);
}

function updateAsset(id, data) {
  const a = state.assets.find(x => x.id === id);
  if (!a) return;
  if (data.name !== undefined) a.name = data.name.trim();
  if (data.icon !== undefined) a.icon = data.icon;
  if (data.type !== undefined) a.type = data.type;
  if (data.unit !== undefined) a.unit = data.unit;
  touch(a);
  saveData(state);
}

function deleteAsset(id) {
  state.assets = state.assets.filter(x => x.id !== id);
  markDeleted(id);
  saveData(state);
}

// 生成资产流水（余额变化时调用）
function _recordAssetChange(accountId, kind, amount, note, date) {
  state.assetRecords.push({
    id: genId(),
    accountId: accountId,
    kind: kind,
    amount: Math.round(amount * 100) / 100,
    note: note || '',
    date: date || today(),
    createdAt: new Date().toISOString(),
    updatedAt: Date.now(),
  });
}

// 记账联动：支出扣账户、收入进账户（由 expense.addExpense 调用，不在此 saveData）
function applyExpenseToAsset(accountId, type, amount, note, date) {
  const a = state.assets.find(x => x.id === accountId);
  if (!a) return;
  if (type === 'expense') {
    a.balance = Math.round((a.balance - amount) * 100) / 100;
    _recordAssetChange(accountId, 'expense', amount, note, date);
  } else if (type === 'income') {
    a.balance = Math.round((a.balance + amount) * 100) / 100;
    _recordAssetChange(accountId, 'income', amount, note, date);
  }
  touch(a);
}

// 对账：直接把某账户余额改成新值（差额记入流水）
function setAssetBalance(id, newBalance, note) {
  const a = state.assets.find(x => x.id === id);
  if (!a) return;
  newBalance = Number(newBalance) || 0;
  const diff = Math.round((newBalance - a.balance) * 100) / 100;
  if (diff === 0) return;
  a.balance = newBalance;
  _recordAssetChange(id, 'set', diff, note || '对账调整', today());
  touch(a);
  saveData(state);
}

// 转账：从 from 转到 to，总资产不变
function transferAsset(fromId, toId, amount, note) {
  const from = state.assets.find(x => x.id === fromId);
  const to = state.assets.find(x => x.id === toId);
  if (!from || !to || fromId === toId) return;
  amount = Math.round(Number(amount) * 100) / 100;
  if (amount <= 0) return;
  from.balance = Math.round((from.balance - amount) * 100) / 100;
  to.balance = Math.round((to.balance + amount) * 100) / 100;
  _recordAssetChange(fromId, 'transfer', -amount, note || ('转出到 ' + to.name), today());
  _recordAssetChange(toId, 'transfer', amount, note || ('来自 ' + from.name), today());
  touch(from); touch(to);
  saveData(state);
}

// ---- 汇总 ----

function getTotalAssets() {
  return state.assets.reduce((s, a) => s + (Number(a.balance) || 0), 0);
}

function getAssetChanges(year, month) {
  const prefix = year + '-' + String(month).padStart(2, '0');
  let inflow = 0, outflow = 0;
  state.assetRecords.forEach(r => {
    if (!r.date || !r.date.startsWith(prefix)) return;
    if (r.amount >= 0) inflow += r.amount;
    else outflow += -r.amount;
  });
  return { inflow, outflow, net: Math.round((inflow - outflow) * 100) / 100 };
}

function getAssetRecordList(accountId) {
  return state.assetRecords
    .filter(r => r.accountId === accountId)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
}
