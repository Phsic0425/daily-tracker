/* ============================================
   todo.js — 待办 CRUD & 排序
   ============================================ */

function addTodo(todo) {
  state.todos.push({
    id: genId(),
    title: todo.title.trim(),
    deadline: todo.deadline,
    priority: todo.priority,
    note: todo.note || '',
    pinned: false,
    order: Date.now(),
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: Date.now(),
    parentId: todo.parentId || null,
  });
  saveData(state);
}

function toggleTodo(id) {
  const todo = state.todos.find(t => t.id === id);
  if (!todo) return;

  // 如果要完成且有未完成的子待办 → 返回 false 让调用方处理
  if (!todo.completed && hasIncompleteChildren(id)) {
    return 'has-incomplete-children';
  }

  todo.completed = !todo.completed;
  todo.completedAt = todo.completed ? new Date().toISOString() : null;
  touch(todo);
  saveData(state);
  return 'ok';
}

function togglePinTodo(id) {
  const todo = state.todos.find(t => t.id === id);
  if (!todo) return;
  todo.pinned = !todo.pinned;
  if (todo.pinned) todo.order = Date.now();
  touch(todo);
  saveData(state);
}

function deleteTodo(id) {
  // 同时删除所有子待办
  const idsToDelete = new Set([id]);
  collectDescendantIds(id, idsToDelete);
  idsToDelete.forEach(markDeleted);
  state.todos = state.todos.filter(t => !idsToDelete.has(t.id));
  saveData(state);
}

function updateTodoNote(id, note) {
  const todo = state.todos.find(t => t.id === id);
  if (!todo) return;
  todo.note = note;
  touch(todo);
  saveData(state);
}

// ---- 子待办 ----

function getChildren(parentId) {
  return state.todos.filter(t => t.parentId === parentId && !t.completed);
}

function getCompletedChildren(parentId) {
  return state.todos.filter(t => t.parentId === parentId && t.completed);
}

function hasIncompleteChildren(parentId) {
  return state.todos.some(t => t.parentId === parentId && !t.completed);
}

function getChildCount(parentId) {
  return state.todos.filter(t => t.parentId === parentId).length;
}

function getCompletedChildCount(parentId) {
  return state.todos.filter(t => t.parentId === parentId && t.completed).length;
}

function collectDescendantIds(parentId, set) {
  const children = state.todos.filter(t => t.parentId === parentId);
  children.forEach(c => {
    set.add(c.id);
    collectDescendantIds(c.id, set);
  });
}

/** 获取所有顶层待办（没有 parentId 的）+ 子待办递归结构 */
function getTodoTree(todos) {
  const roots = todos.filter(t => !t.parentId);
  return roots;
}

/** 强制完成父待办及其所有子待办 */
function forceCompleteWithChildren(parentId) {
  const todo = state.todos.find(t => t.id === parentId);
  if (!todo) return;
  todo.completed = true;
  todo.completedAt = new Date().toISOString();
  touch(todo);
  // 递归完成所有未完成的子待办
  const children = state.todos.filter(t => t.parentId === parentId);
  children.forEach(c => {
    if (!c.completed) forceCompleteWithChildren(c.id);
  });
  saveData(state);
}

// ---- 子待办表单 ----
let subTodoParentId = null;

function openSubTodoForm(parentId) {
  subTodoParentId = parentId;
  const parent = state.todos.find(t => t.id === parentId);
  document.getElementById('todoTitle').value = '';
  document.getElementById('todoNote').value = '';
  if (parent) {
    document.getElementById('todoDeadline').value = parent.deadline || today();
    document.getElementById('todoPriority').value = parent.priority || 'medium';
  } else {
    document.getElementById('todoDeadline').value = today();
  }
  document.getElementById('todoTitle').placeholder = '输入子任务...';
  document.getElementById('todoTitle').focus();
  const form = document.getElementById('todoForm');
  form.classList.add('sub-todo-form');
  form.dataset.parentId = parentId;
  // 显示退出横幅
  document.getElementById('subTodoBanner').style.display = 'flex';
  document.getElementById('btnTodoSubmit').textContent = '添加子任务';
}

function closeSubTodoForm() {
  subTodoParentId = null;
  const form = document.getElementById('todoForm');
  form.classList.remove('sub-todo-form');
  delete form.dataset.parentId;
  document.getElementById('todoTitle').placeholder = '输入待办事项...';
  document.getElementById('subTodoBanner').style.display = 'none';
  document.getElementById('btnTodoSubmit').textContent = '添加';
}

// ---- 待办编辑 ----
let editingTodoId = null;

function openTodoEditForm(id) {
  const todo = state.todos.find(t => t.id === id);
  if (!todo) return;
  editingTodoId = id;
  const item = document.querySelector(`.todo-item[data-id="${id}"]`);
  if (!item) return;

  // 替换为编辑表单
  const body = item.querySelector('.todo-body');
  const originalHtml = body.innerHTML;
  body._originalHtml = originalHtml;

  body.innerHTML = `
    <input type="text" class="todo-edit-title" placeholder="标题" maxlength="100">
    <div class="todo-edit-row">
      <input type="date" class="todo-edit-date">
      <select class="todo-edit-priority">
        <option value="high">🔴 高</option>
        <option value="medium">🟡 中</option>
        <option value="low">🟢 低</option>
      </select>
    </div>
    <input type="text" class="todo-edit-note" placeholder="备注（选填）" maxlength="100">
    <div class="todo-edit-actions">
      <button class="btn btn-sm btn-primary" data-action="save-edit">保存</button>
      <button class="btn btn-sm btn-ghost" data-action="cancel-edit">取消</button>
    </div>
  `;
  body.querySelector('.todo-edit-title').value = todo.title;
  body.querySelector('.todo-edit-date').value = todo.deadline || today();
  body.querySelector('.todo-edit-priority').value = todo.priority || 'medium';
  body.querySelector('.todo-edit-note').value = todo.note || '';
  body.querySelector('.todo-edit-title').focus();
}

function saveTodoEdit(id) {
  const body = document.querySelector(`.todo-item[data-id="${id}"] .todo-body`);
  if (!body) return;
  const titleEl = body.querySelector('.todo-edit-title');
  const noteEl = body.querySelector('.todo-edit-note');
  if (!titleEl) return;
  const title = titleEl.value.trim();
  if (!title) { showToast('标题不能为空'); return; }
  const todo = state.todos.find(t => t.id === id);
  if (todo) {
    todo.title = title;
    todo.note = (noteEl ? noteEl.value.trim() : '');
    var dateEl = body.querySelector('.todo-edit-date');
    var priEl = body.querySelector('.todo-edit-priority');
    if (dateEl) todo.deadline = dateEl.value;
    if (priEl) todo.priority = priEl.value;
    touch(todo);
    saveData(state);
    showToast('待办已更新 ✓');
  }
  editingTodoId = null;
  renderTodoView();
}

function cancelTodoEdit() {
  editingTodoId = null;
  renderTodoView();
}

// ---- 备注快速编辑 ----
function startInlineNoteEdit(id, noteEl) {
  if (editingTodoId) return;
  const todo = state.todos.find(t => t.id === id);
  if (!todo) return;
  const currentText = todo.note || '';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'todo-note-edit';
  input.value = currentText;
  input.placeholder = '备注...';
  input.maxLength = 100;
  noteEl.replaceWith(input);
  input.focus();
  input.select();

  function finish() {
    const newNote = input.value.trim();
    if (todo) {
      todo.note = newNote;
      saveData(state);
    }
    renderTodoView();
  }

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { input.value = currentText; input.blur(); }
  });
}

function isOverdue(deadline) {
  if (!deadline) return false;
  return deadline < today();
}

function isDueSoon(deadline) {
  if (!deadline) return false;
  if (isOverdue(deadline)) return false;
  const d = new Date(deadline + 'T00:00:00');
  const t = new Date(today() + 'T00:00:00');
  const diff = Math.ceil((d - t) / (1000 * 60 * 60 * 24));
  return diff >= 0 && diff <= settings.dueSoonDays;
}

function getActiveTodos(sortMode) {
  const mode = sortMode || 'deadline';
  const asc = todoSortAsc;

  function cmpDeadline(a, b) {
    const da = a.deadline || '';
    const db = b.deadline || '';
    return asc ? da.localeCompare(db) : db.localeCompare(da);
  }

  function cmpPriority(a, b) {
    const pOrder = { high: 0, medium: 1, low: 2 };
    return (pOrder[a.priority] || 1) - (pOrder[b.priority] || 1);
  }

  function cmpPin(a, b) {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  }

  // 只返回顶层待办（parentId 为 null），子待办在渲染时递归展开
  return state.todos
    .filter(t => !t.completed && !t.parentId)
    .sort((a, b) => {
      if (mode === 'priority') {
        const pc = cmpPriority(a, b);
        if (pc !== 0) return pc;
        const pin = cmpPin(a, b);
        if (pin !== 0) return pin;
        return cmpDeadline(a, b);
      }
      const pin = cmpPin(a, b);
      if (pin !== 0) return pin;
      const dc = cmpDeadline(a, b);
      if (dc !== 0) return dc;
      return cmpPriority(a, b);
    });
}

function getCompletedTodos() {
  return state.todos
    .filter(t => t.completed && !t.parentId)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
}

function getActiveCount() {
  // 只计算主任务（顶层待办）
  return state.todos.filter(t => !t.completed && !t.parentId).length;
}
