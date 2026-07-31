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

function deleteTodo(id) {
  state.todos = state.todos.filter(t => t.id !== id);
  saveData(state);
}

function getActiveTodos() {
  return state.todos
    .filter(t => !t.completed)
    .sort((a, b) => {
      if (a.deadline !== b.deadline) return a.deadline.localeCompare(b.deadline);
      const pOrder = { high: 0, medium: 1, low: 2 };
      return pOrder[a.priority] - pOrder[b.priority];
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
  return deadline < today();
}
