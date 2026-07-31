/* ============================================
   expense.js — 记账 CRUD & 查询
   ============================================ */

function addExpense(record) {
  state.expenses.push({
    id: genId(),
    type: record.type,
    amount: parseFloat(record.amount),
    category: record.category,
    note: record.note || '',
    date: record.date,
    image: record.image || null,
    createdAt: new Date().toISOString(),
  });
  saveData(state);
}

function deleteExpense(id) {
  state.expenses = state.expenses.filter(e => e.id !== id);
  saveData(state);
}

function getMonthExpenses(year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return state.expenses.filter(e => e.date.startsWith(prefix));
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
