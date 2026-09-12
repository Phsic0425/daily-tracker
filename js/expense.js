/* ============================================
   expense.js — 记账 CRUD & 查询
   ============================================ */

function addExpense(record) {
  const rec = {
    id: genId(),
    type: record.type,
    amount: parseFloat(record.amount),
    category: record.category,
    note: record.note || '',
    date: record.date,
    image: record.image || null,
    accountId: record.accountId || null,
    createdAt: new Date().toISOString(),
    updatedAt: Date.now(),
  };
  state.expenses.push(rec);
  // 资产联动：支出扣账户、收入进账户（asset.js 提供）
  if (typeof applyExpenseToAsset === 'function' && record.accountId) {
    applyExpenseToAsset(record.accountId, record.type, parseFloat(record.amount), record.note, record.date);
  }
  saveData(state);
}

// 按末余额记账：只填「记完后还剩多少」，差值自动算成一笔支出/收入
function addExpenseByBalance(accountId, endBalance, category, note, date) {
  const a = state.assets.find(x => x.id === accountId);
  if (!a) return { ok: false, error: '账户不存在' };
  endBalance = Number(endBalance);
  if (isNaN(endBalance)) return { ok: false, error: '请输入有效的末余额' };
  const diff = Math.round((a.balance - endBalance) * 100) / 100;
  if (diff === 0) return { ok: false, error: '余额未变化，无需记录' };
  const type = diff > 0 ? 'expense' : 'income';
  const amount = Math.abs(diff);
  const cats = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const cat = cats.find(c => c.key === category) ? category : 'other';
  addExpense({ type, amount, category: cat, note, date, image: null, accountId });
  // 修正浮点误差，让账户余额精确落在用户输入的末余额上（同一次操作内纠偏，不产生额外流水）
  a.balance = Math.round(endBalance * 100) / 100;
  touch(a);
  saveData(state);
  return { ok: true, type, amount };
}

function deleteExpense(id) {
  state.expenses = state.expenses.filter(e => e.id !== id);
  markDeleted(id);
  saveData(state);
}

function getMonthExpenses(year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return state.expenses.filter(e => e.date && e.date.startsWith(prefix));
}

function getMonthSummary(year, month) {
  const list = getMonthExpenses(year, month);
  let income = 0, expense = 0;
  list.forEach(e => {
    if (e.type === 'income') income += e.amount;
    else expense += e.amount;
  });
  return { income, expense, balance: income - expense };
}

function getCategoryBreakdown(year, month) {
  const list = getMonthExpenses(year, month);

  const expenseMap = {};
  list.filter(e => e.type === 'expense').forEach(e => {
    if (!expenseMap[e.category]) expenseMap[e.category] = 0;
    expenseMap[e.category] += e.amount;
  });

  const incomeMap = {};
  list.filter(e => e.type === 'income').forEach(e => {
    if (!incomeMap[e.category]) incomeMap[e.category] = 0;
    incomeMap[e.category] += e.amount;
  });

  const totalExpense = Object.values(expenseMap).reduce((a, b) => a + b, 0);
  const totalIncome = Object.values(incomeMap).reduce((a, b) => a + b, 0);

  const expenseCats = Object.entries(expenseMap)
    .map(([key, amount]) => {
      const def = EXPENSE_CATEGORIES.find(c => c.key === key) || { icon: '📦', name: key };
      return { key, icon: def.icon, name: def.name, amount, percent: totalExpense > 0 ? (amount / totalExpense * 100) : 0 };
    })
    .sort((a, b) => b.amount - a.amount);

  const incomeCats = Object.entries(incomeMap)
    .map(([key, amount]) => {
      const def = INCOME_CATEGORIES.find(c => c.key === key) || { icon: '📦', name: key };
      return { key, icon: def.icon, name: def.name, amount, percent: totalIncome > 0 ? (amount / totalIncome * 100) : 0 };
    })
    .sort((a, b) => b.amount - a.amount);

  return { expenseCats, incomeCats };
}
