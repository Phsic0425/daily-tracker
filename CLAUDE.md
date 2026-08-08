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
├── storage.js          ← 数据层：loadData、saveData、exportData、importData、loadSettings、saveSettings、全局变量 `state` + `settings`
├── expense.js          ← 记账 CRUD：addExpense、deleteExpense、getMonthExpenses、getMonthSummary、getCategoryBreakdown
├── todo.js             ← 待办 CRUD + 排序：addTodo、toggleTodo、deleteTodo、getActiveTodos、getCompletedTodos、getActiveCount、isOverdue、isDueSoon
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
  todos:    [{ id, title, deadline, priority, note, pinned, order, completed, completedAt, createdAt }],
  templates:[{ id, name, type, category, amount, note }]
}
// 存于 localStorage key: 'daily_tracker_data'

settings = {
  dueSoonDays: 3,        // 距截止几天算临期（1-30）
  showTimeStatus: true,  // 待办是否显示临期/超时边框
  defaultSortMode: 'deadline', // 'deadline' | 'priority' | 'status'
  sortAsc: true,         // true=升序(早→晚)
}
// 存于 localStorage key: 'daily_tracker_settings'
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

## 关键工具函数签名

| 函数 | 输入 | 输出 | 示例 |
|------|------|------|------|
| `today()` | — | `"2026-08-01"` | 当前日期 YYYY-MM-DD |
| `fmtMoney(n)` | number | `"¥1,234.56"` | 金额格式化 |
| `fmtDate(str)` | YYYY-MM-DD | `"今天"` / `"昨天"` / `"8月1日 周四"` | 账单列表用 |
| `fmtDateShort(str)` | YYYY-MM-DD | `"8月1日"` / `"—"` | 待办列表用（短格式） |
| `escapeHtml(str)` | string | escaped | XSS 防护 |
| `genId()` | — | `"m2x...abc"` | 唯一 ID |

## 渲染函数调用链

```
renderExpenseView()          ← 主入口，各自独立 try-catch
  ├── renderSummary()        → #sumIncome, #sumExpense, #sumBalance
  ├── renderTemplates()      → #templateList（含管理模式横幅）
  ├── renderCategoryBreakdown() → #categoryBreakdown
  ├── renderExpenseList()    → #expenseList（按日期分组）
  └── updateHeaderMonth()    → #monthPicker 同步

renderTodoView()
  ├── renderActiveTodos()    → #activeTodoList
  ├── renderCompletedTodos() → #completedTodoList
  └── updateTodoBadge()      → #todoBadge
```

**重要**: 每个 render 函数都有独立 try-catch，一个失败不影响其他。

## 事件委托模式

```
#expenseList click → [data-action] 路由到 batch-check / preview-img / delete-expense
#templateList click → [data-action="record-tpl"] 路由到 record/delete
#activeTodoList click → [data-action] 路由到 todo-batch-check / pin-todo / toggle-todo / delete-todo
#completedTodoList click → [data-action] 同上 + completed-batch-check
```

模板列表的特殊处理：管理模式下点击模板→删除确认，普通模式→一键记账。

## CSS 状态类约定

| 类名 | 触发条件 | 效果 |
|------|----------|------|
| `.tpl-chip.managing` | `tplManaging === true` | 红色边框+背景+抖动动画，↗按钮可见 |
| `.tpl-delete-btn` | 父级 `.managing` | 默认 `display:none`，管理模式 `display:flex` |
| `.batch-checkbox.checked` | `batchSelected.has(id)` | 蓝色实心✓ |
| `.todo-check.confirming` | `pendingConfirmId === id` | 橙色脉冲动画+「再点确认」提示 |
| `.tab.active` | 当前标签页 | 蓝色底部边框 |
| `.tpl-manage-banner` | `tplManaging === true` | 红色提示条（模板列表首个元素，持续显示） |
| `.todo-item.overdue` | `deadline < today()` | 红色左边框 |
| `.todo-item.due-soon` | `today() ≤ deadline ≤ today()+dueSoonDays` | 黄色左边框 |
| `.todo-note` | todo 有备注 | 灰色小字，标题下方 |
| `.modal-fullscreen` | 报表打开 | 全屏模态，从底部滑入 |
| `.report-chart` | 报表渲染后 | Canvas 图表容器 |
| `.cat-tag` / `.cat-tag-del` | 设置中分类管理 | 分类标签 + 删除按钮 |

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
- 待办排序：📅截止日期 / 🔴优先级 两种模式 + ↑↓切换正倒序
  - priority 模式：pinned 只作为同级 tiebreaker，优先级高的排前面
  - deadline 模式：pinned 无条件置顶
- 待办时间状态：超时=红色左边框，临期=黄色左边框（阈值在设置中配置，默认3天）
- 待办备注：标题下方灰色小字
- 账单批量删除：toggleBatchDelete() 全局函数
- 模板管理：toggleTemplateManage() 全局函数，toast提示+红色横幅持续显示，点击模板直接删除
- 模板记账：点击模板自动以**当天日期**记录，无时间路径依赖
- **自动刷新**：`saveData()` 通过 `requestAnimationFrame` 自动触发 UI 重渲染
- 月份选择器同时监听 change + blur 事件
- PWA 安装入口在左下角 ⋯ 更多菜单中
- 设置入口 → ⚙️（临期天数、时间状态开关、默认排序、排序方向、自定义收支分类）
- 数据导出/导入 → 💾/📥
- **全屏报表** → 📊（月度/年度汇总 + Canvas 饼图/柱状图 + 趋势明细表）
- **可配置分类**：设置中可新增/删除自定义收支分类，合并到默认分类中

## 不要做的事

- 不要引入任何 npm 包或框架，保持零依赖
- 不要修改加载顺序
- 不要给已有的全局函数改名（inline onclick 依赖它们）
- 不要在 CSS 末尾追加样式后忘记检查是否有重复规则
- 不要把多个 render 函数放在同一个 try-catch 里——一个子渲染失败会导致后续渲染全部跳过

## 部署

### 方式一：GitHub Pages（推荐，免费）

1. 在 GitHub 创建**公开**仓库 `daily-tracker`
2. `git push origin master`
3. Settings → Pages → Source: `master` / `/(root)` → Save
4. 访问 `https://<用户名>.github.io/daily-tracker/`
5. 手机浏览器打开 → 菜单 →「添加到主屏幕」安装 PWA

### 方式二：腾讯云 EdgeOne Pages（大陆更快，需域名）

1. 控制台 → EdgeOne Pages → 上传文件
2. 绑定自定义域名（选「全球不含中国大陆」免 ICP 备案）

### 部署注意事项
- 所有路径均为相对路径（`./js/...`），无需适配
- Service Worker 采用网络优先策略，旧版本清理在 activate 事件中
- 每台设备 localStorage 独立，互不影响
- 跨设备迁移数据用「导出/导入」功能（左下角 ⋯ 菜单）

## 数据导出/导入

- `exportData()` — 序列化 `state` 为 JSON 文件下载（文件名含日期戳 `daily-tracker-backup-YYYY-MM-DD.json`）
- `importData(jsonStr)` — 解析 JSON → 校验结构 → 替换 `state.expenses/todos/templates` → `saveData()` → 返回结果对象 `{ok, error?, counts?}`
- 入口：左下角 ⋯ 菜单 → 💾 导出数据 / 📥 导入数据
- 导入后自动调用 `renderExpenseView()` + `renderTodoView()` + `updateTodoBadge()` 刷新界面
- 容错：导入文件缺少字段时自动补空数组，不丢已有数据的其他字段
