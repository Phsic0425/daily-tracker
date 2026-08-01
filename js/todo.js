/* ============================================
   todo.js — 待办 CRUD & 排序
   ============================================ */

function addTodo(todo) {
  state.todos.push({
    id: genId(),
    title: todo.title.trim(),
    startDate: todo.startDate || null,
    deadline: todo.deadline,
    priority: todo.priority,
    pinned: false,
    order: Date.now(), // 用于自定义排序
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
  });
  saveData(state);
}

function toggleTodo(id) {
  const todo = state.todos.find(t => t.id === id);
  if (!todo) return;
  todo.completed = !todo.completed;
  todo.completedAt = todo.completed ? new Date().toISOString() : null;
  saveData(state);
}

function togglePinTodo(id) {
  const todo = state.todos.find(t => t.id === id);
  if (!todo) return;
  todo.pinned = !todo.pinned;
  if (todo.pinned) todo.order = Date.now(); // 置顶时刷新 order
  saveData(state);
}

function deleteTodo(id) {
  state.todos = state.todos.filter(t => t.id !== id);
  saveData(state);
}

function getActiveTodos(sortMode) {
  const mode = sortMode || 'deadline';
  return state.todos
    .filter(t => !t.completed)
    .sort((a, b) => {
      // pinned 置顶优先
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      // 都置顶或都不置顶时按模式排序
      if (mode === 'priority') {
        const pOrder = { high: 0, medium: 1, low: 2 };
        const pa = pOrder[a.priority] || 1;
        const pb = pOrder[b.priority] || 1;
        if (pa !== pb) return pa - pb;
        // 同优先级按截止日期
        const da = a.deadline || '';
        const db = b.deadline || '';
        return da.localeCompare(db);
      }
      // deadline 模式（默认）
      const da = a.deadline || '';
      const db = b.deadline || '';
      if (da !== db) return da.localeCompare(db);
      const pOrder = { high: 0, medium: 1, low: 2 };
      return (pOrder[a.priority] || 1) - (pOrder[b.priority] || 1);
    });
}

function getCompletedTodos() {
  return state.todos
    .filter(t => t.completed)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
}

function getActiveCount() {
  return state.todos.filter(t => !t.completed).length;
}

function isOverdue(deadline) {
  if (!deadline) return false;
  return deadline < today();
}
