# 日常记账 — PWA 个人记账与待办管理

## 技术栈

纯 HTML/CSS/JS，无框架、无构建工具、无 npm 依赖。PWA（Service Worker + Manifest）。
数据仅存 localStorage，无后端。移动端优先设计。

## 文件结构 & 职责

```
index.html              ← 所有 DOM 结构（弹窗、菜单、列表容器）
style.css               ← 全部样式（移动端优先 + 深色模式）
sw.js                   ← Service Worker（缓存策略 vN，全自动更新）
manifest.json           ← PWA 配置

js/
├── config.js           ← 常量：分类、ASSET_TYPES、SCHEDULE_COLORS、PRIORITY_MAP、STORAGE_KEY
├── utils.js            ← 纯函数：genId、today、fmtMoney、fmtDate、fmtDateShort、escapeHtml
├── storage.js          ← 数据层 + 云同步：loadData、saveData、mergeStates、touch、markDeleted、Gist 后端、快照、同步码/连接码、导出导入
├── expense.js          ← 记账 CRUD（含 accountId + 资产联动）
├── todo.js             ← 待办 CRUD + 排序
├── schedule.js         ← 日程 CRUD + 7 种重复规则 + 提醒 + 即将到来（不含课表——课表本质不是待办，只在课表视图展示）
├── asset.js            ← 资产账户 CRUD + 记账联动 + 转账/对账 + 汇总
├── course.js           ← 课表：课程/节次 CRUD + 学期/单双周 + 两种课表渲染（时间网格/节次网格）+ 课程/节次弹窗
├── calendar.js         ← 日历/周视图渲染 + 日程弹窗
├── templates.js        ← 快捷模板
├── effects.js          ← 视觉：showToast、triggerConfetti 等
├── help.js             ← 使用说明书
├── report.js           ← 报表
├── ui.js               ← 所有 DOM 渲染（含资产总览/资产管理、同步历史/快照 UI）
├── events.js           ← 全部事件绑定
└── app.js              ← 全局状态 + init 入口
```

## 加载顺序（严格依赖链）

```
config → utils → storage → expense → todo → schedule → asset → course → calendar → templates → effects → help → report → ui → events → app
```

## 数据模型

```js
state = {
  expenses:    [{ id, type, amount, category, note, date, image, accountId, createdAt, updatedAt }],
  todos:       [{ id, title, deadline, priority, note, pinned, order, completed, completedAt, parentId, createdAt, updatedAt }],
  templates:   [{ id, name, type, category, amount, note, createdAt, updatedAt }],
  schedules:   [{ id, title, type, date, endDate, time, endTime, displayText, repeat, reminder, note, color, createdAt, updatedAt }],
  assets:      [{ id, name, icon, type, balance, unit, quantity, price, createdAt, updatedAt }],
  assetRecords:[{ id, accountId, kind, amount, note, date, createdAt, updatedAt }],   // kind: expense|income|transfer|set
  courses:     [{ id, name, location, teacher, weekday, startTime, endTime, classPeriodIds, weeks:{start,end,parity}, color, note, createdAt, updatedAt }],
  semester:    { name, startDate, endDate, weekOffset },  // weekOffset：手动周数校准（调休/补课导致自然周对不上时用）
  classPeriods:[{ id, name, startTime, endTime, order, createdAt, updatedAt }],  // 节次配置
  tombstones:  { '<id>': ts },   // 删除墓碑，供按记录合并使用
  updatedAt:   <ms>,
}
// 存于 localStorage key: 'daily_tracker_data'

settings = {
  dueSoonDays: 3,
  showTimeStatus: true,
  defaultSortMode: 'deadline',
  sortAsc: true,
  customExpenseCategories: [], customIncomeCategories: [],
  deletedExpenseCategories: [], deletedIncomeCategories: [],
  subTodoCollapsed: false, showLunar: true, showHolidays: true,
  showScheduleLabels: true, compactSchedule: false,
  scheduleViewMode: 'month',   // 'month' | 'week' | 'timetable'
  syncAuto: true,
  syncBackend: 'gist', gistToken: '', gistId: '',
}
// 存于 localStorage key: 'daily_tracker_settings'
```

## 云同步（GitHub Gist）

- 后端抽象在 storage.js：`syncCreate` / `syncDownload` / `syncUpload` / `syncHistory` / `syncRevert`，用原生 `fetch` 调 GitHub Gist API（细粒度 token，`Authorization: Bearer`）。
- 数据存为 secret gist 单文件 `daily-tracker-data.json`，每次 `PATCH` 产生一个 revision（天然历史存档）。
- 同步策略 = **pull → merge → push**：拉远端 → `mergeStates` 按记录 `id + updatedAt` 合并（墓碑 `tombstones` 标记的 id 永久丢弃）→ 本地保存 → 推回。
- `saveData` 在每次存盘时自动 `syncUpload`（`_syncBusy` 防重入）；`initSync` 每 60 秒 `syncDownload`。
- 连接码（`exportConnectionCode`/`importConnectionCode`）用 gzip+base64 打包 `{backend, gistId, token}`，前缀 `DT4:`，供第二台设备「连接同步」。
- 同步码（`exportSyncCode`/`importSyncCode`）传数据不含 token；本地快照存独立 key `daily_tracker_snapshots`（最多 30 份，不含图片）。

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
| `byBalanceMode` | 记账弹窗是否处于「按余额记账」模式 |

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
- **每次发布前必须同步递增两处版本号**：`sw.js` 里的 `const CACHE = 'daily-tracker-vN'` 和 `index.html` 里所有 `?v=N` 查询参数（manifest.json / style.css / lunar.min.js / 全部 js/*.js）。两处漏改任一处都会导致浏览器/PWA 判断资源未变化，用户端只能靠手动清缓存才能看到新版本

## 数据导出/导入

- `exportData()` — 序列化 `state` 为 JSON 文件下载（文件名含日期戳 `daily-tracker-backup-YYYY-MM-DD.json`）
- `importData(jsonStr)` — 解析 JSON → 校验结构 → 替换 `state.expenses/todos/templates` → `saveData()` → 返回结果对象 `{ok, error?, counts?}`
- 入口：左下角 ⋯ 菜单 → 💾 导出数据 / 📥 导入数据
- 导入后自动调用 `renderExpenseView()` + `renderTodoView()` + `updateTodoBadge()` 刷新界面
- 容错：导入文件缺少字段时自动补空数组，不丢已有数据的其他字段
