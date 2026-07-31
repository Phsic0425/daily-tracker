# 日常记账 — PWA 个人记账与待办管理

## 技术栈

纯 HTML/CSS/JS，无框架、无构建工具、无 npm 依赖。PWA（Service Worker + Manifest）。
数据仅存 localStorage，无后端。移动端优先设计。

## 文件结构 & 职责

```
index.html              ← 所有 DOM 结构（弹窗、菜单、列表容器）
style.css               ← 全部样式（移动端优先 + 深色模式）
sw.js                   ← Service Worker（缓存策略 v2）
manifest.json           ← PWA 配置

js/
├── config.js           ← 常量：EXPENSE_CATEGORIES、INCOME_CATEGORIES、PRIORITY_MAP、STORAGE_KEY
├── utils.js            ← 纯函数：genId、today、fmtMoney、fmtDate、fmtDateShort、escapeHtml
├── storage.js          ← 数据层：loadData、saveData、全局变量 `state`
├── expense.js          ← 记账 CRUD：addExpense、deleteExpense、getMonthExpenses、getMonthSummary、getCategoryBreakdown
├── todo.js             ← 待办 CRUD：addTodo、toggleTodo、deleteTodo、getActiveTodos、getCompletedTodos、getActiveCount、isOverdue
├── templates.js        ← 快捷模板：getTemplates、addTemplate、deleteTemplate、recordFromTemplate
├── effects.js          ← 视觉：showToast、triggerConfetti、updateCameraButton、handleImageSelect、showImagePreview、clearPendingConfirm
├── report.js           ← 报表：openReport、closeReport、renderReport（独立年月变量 reportYear/reportMonth）
├── ui.js               ← 所有 DOM 渲染：记账视图、待办视图、模板、弹窗、分类统计
├── events.js           ← 全部事件绑定：标签切换、月份导航、FAB、弹窗操作、CRUD 触发、批量删除、PWA 安装
└── app.js              ← 全局状态 + 全局 onclick 函数 + init 入口
```

## 加载顺序（严格依赖链）

```
config → utils → storage → expense → todo → templates → effects → report → ui → events → app
```

## 数据模型

```js
state = {
  expenses: [{ id, type, amount, category, note, date, image, createdAt }],
  todos:    [{ id, title, startDate, deadline, priority, completed, completedAt, createdAt }],
  templates:[{ id, name, type, category, amount, note }]
}
// 存于 localStorage key: 'daily_tracker_data'
```

## 全局状态变量（app.js）

| 变量 | 用途 |
|------|------|
| `viewMonth` | 主页面当前查看的年月 `{year, month}` |
| `modalType` | 记账弹窗类型 `'expense'` / `'income'` |
| `tplManaging` | 模板管理删除模式开关 |
| `batchDeleting` / `batchSelected` | 账单批量删除状态 |
| `todoBatchDeleting` / `todoBatchSelected` | 待办批量删除状态 |
| `reportYear` / `reportMonth` | 报表独立年月 |
| `pendingImage` | 暂存的截图 base64 |
| `deferredPrompt` | PWA 安装事件对象 |

## 调试指南

| 症状 | 查哪个文件 |
|------|-----------|
| 记账数据不对 | `expense.js` + `storage.js` |
| 待办排序/逾期不显示 | `todo.js` |
| 页面不刷新/显示过时 | `ui.js` 对应渲染函数 + `events.js` 的事件触发 |
| 模板/批量删除状态不对 | `app.js` 全局函数 + CSS `.managing` / `.checked` |
| 弹窗行为异常 | `ui.js`（open/close/handleSaveExpense）+ `events.js`（弹窗事件） |
| 样式问题 | `style.css`，注意文件中有紧凑风格，检查是否有重复规则 |
| 月份切换不生效 | `events.js`（monthPicker 事件）+ `app.js`（viewMonth） |

## UX 要点

- 待办完成需**双击确认**：第一次点击圆圈变橙+脉冲+「再点确认」提示，3秒超时自动取消
- 账单批量删除：toggleBatchDelete() 全局函数，勾选不重绘列表（局部 class 切换）
- 模板管理：toggleTemplateManage() 全局函数，红色抖动动画+显示 ✕ 删除按钮
- 记账弹窗关闭前先 renderExpenseView()，确保数据立即刷新
- 月份选择器同时监听 change + blur 事件，去重防止重复渲染
- 截图存入 expense.image 字段（压缩至 200px 宽的 JPEG）
- PWA 安装入口在左下角 ⋯ 更多菜单中

## 不要做的事

- 不要引入任何 npm 包或框架，保持零依赖
- 不要修改加载顺序
- 不要给已有的全局函数改名（inline onclick 依赖它们）
- 不要在 CSS 末尾追加样式后忘记检查是否有重复规则
