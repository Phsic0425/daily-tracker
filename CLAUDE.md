# 日常记账 — PWA 个人记账与待办管理

## 技术栈

纯 HTML/CSS/JS，无框架、无构建工具、无 npm 依赖。PWA（Service Worker + Manifest）。
数据仅存 localStorage，无后端。移动端优先设计。

## 文件结构 & 职责

```
index.html              ← 所有 DOM 结构（弹窗、菜单、列表容器）
style.css               ← 全部样式（移动端优先 + 深色模式）
sw.js                   ← Service Worker（网络优先缓存 + skipWaiting 自动接管；版本号见首行 CACHE）
manifest.json           ← PWA 配置

js/
├── lunar.min.js        ← 第三方农历库（唯一外部依赖，纯静态文件，非 npm）
├── config.js           ← 常量：EXPENSE_CATEGORIES、INCOME_CATEGORIES、PRIORITY_MAP、STORAGE_KEY、ACCOUNT_TYPES、DEFAULT_PERIODS、COURSE_WEEKS_PRESETS
├── utils.js            ← 纯函数：genId、today、fmtMoney、fmtDate、fmtDateShort、escapeHtml
├── storage.js          ← 数据层：loadData、saveData、exportData、importData、loadSettings、saveSettings、云同步、全局变量 `state` + `settings`
├── account.js          ← 账户 CRUD：getAccounts、getAccountById、getTotalAssets、addAccount、updateAccount、deleteAccount、adjustAccountBalance、applyExpenseToAccount、revertExpenseFromAccount
├── expense.js          ← 记账 CRUD：addExpense、deleteExpense、getMonthExpenses、getMonthSummary、getCategoryBreakdown（记账时联动账户余额）
├── todo.js             ← 待办 CRUD + 排序：addTodo、toggleTodo、deleteTodo、toggleTodoLongTerm、getActiveTodos、getCompletedTodos、getActiveCount、isOverdue、isDueSoon
├── schedule.js         ← 日程 CRUD + 重复规则展开：addSchedule/updateSchedule/deleteSchedule、expandRepeats 系列、getSchedulesForDate、getScheduledDatesInMonth、checkAndNotify（提醒通知）
├── course.js           ← 课表数据层：parseWeeksText/formatWeeksText、getWeekNumberForDate、setCurrentWeekAnchor、updatePeriods、课程 CRUD、getCoursesForWeek
├── calendar.js         ← 月历视图渲染 + 日程弹窗：renderCalendar、renderDayDetail、renderUpcoming、日程弹窗 open/close/save/delete、导出 JSON/图片
├── timetable.js        ← 课表视图渲染 + 课程/周数/节次弹窗：renderCourseView、renderCourseGrid、课程弹窗、设置周数弹窗、节次设置弹窗
├── countdown.js        ← 倒数日：日期计算（cdDaysBetween/cdLunarToSolar/cdNextOccurrence）+ 数据层 + 渲染 + 弹窗 + 节日导入
├── templates.js        ← 快捷模板：getTemplates、addTemplate、deleteTemplate、recordFromTemplate
├── effects.js          ← 视觉：showToast、triggerConfetti、updateCameraButton、handleImageSelect、showImagePreview、clearPendingConfirm
├── help.js             ← 帮助文档：renderHelp、openHelp、closeHelp
├── report.js           ← 报表：openReport、closeReport、renderReport（独立年月变量 reportYear/reportMonth）
├── ui.js               ← 所有 DOM 渲染：记账视图、账户列表、待办视图、模板、弹窗、分类统计、日程视图切换
├── events.js           ← 全部事件绑定：标签切换、月份导航、FAB、弹窗操作、CRUD 触发、批量删除、PWA 安装
└── app.js              ← 全局状态 + 全局 onclick 函数 + init 入口
```

## 加载顺序（严格依赖链）

```
config → utils → storage → account → expense → todo → schedule → course → calendar → timetable
  → countdown → templates → effects → help → report → ui → events → app
```

## 数据模型

```js
state = {
  expenses: [{ id, type, amount, category, note, date, image, accountId, createdAt }],
  todos:    [{ id, title, deadline, priority, note, pinned, order, completed, completedAt, createdAt, parentId, isLongTerm }],
  templates:[{ id, name, type, category, amount, note }],
  schedules:[{ id, title, date, time, repeatMode, repeatConfig, reminder, color, label, createdAt }],
  accounts: [{ id, name, type, icon, balance, note, createdAt }],
  countdowns: [{
    id, title, icon, color, note,
    mode: 'once' | 'yearly-solar' | 'yearly-lunar' | 'yearly-rule',
    direction: 'countdown' | 'countup',   // 倒数 / 累计（纪念日）
    baseDate: '1998-03-15',               // 基准日：单次=目标日；循环=首次发生日（也用于算「已过去N天」和「第K次」）
    lunar: { month, day, isLeap, startYear } | null,  // 仅 yearly-lunar，startYear=创建时的农历年
    rule:  { month, weekday, nth } | null,            // 仅 yearly-rule，weekday 0=周日
    pinned, festivalKey,                  // festivalKey 用于节日导入去重
    createdAt
  }],
  courseSchedule: {
    periods: [{ start, end, name, collapsed }], // 每节课起止时间 "HH:MM"，默认 12 节；collapsed=折叠压缩显示（如午休）
    currentWeek: 1,                 // 锚点：anchorDate 当天是第几周
    anchorDate: '2026-08-01',       // 锚点日期，用于按周一起始推算任意日期的周数
    courses: [{ id, name, location, weekday, startPeriod, endPeriod, weeks, color, createdAt }],
    // weekday: 1-7（周一=1）；weeks: number[]，来自 parseWeeksText 或预设
    scaleZones: [{ start, end, factor }] // 局部时间段缩放（时间轴任意区间自定义纵向缩放倍数），与 periods[].collapsed 独立叠加
  }
}
// 存于 localStorage key: 'daily_tracker_data'

settings = {
  dueSoonDays: 3,        // 距截止几天算临期（1-30）
  showTimeStatus: true,  // 待办是否显示临期/超时边框
  defaultSortMode: 'deadline', // 'deadline' | 'priority' | 'status'
  sortAsc: true,         // true=升序(早→晚)
  scheduleViewMode: 'month', // 'month'=月视图 / 'course'=课表视图
  courseScaleY: 1,       // 课表整体竖向缩放倍数（每分钟像素）
  courseScaleX: 1,       // 课表整体横向缩放倍数（每日列宽/最小总宽）
}
// 存于 localStorage key: 'daily_tracker_settings'
```

- `accountId` 为空字符串表示该笔记账未关联任何账户
- 课程的“本周是否上课”由 `getCoursesForWeek(weekNum)` 实时计算（`weeks.includes(weekNum)`），不持久化 `active` 状态
- 课表视图（`course`）与月历视图（`month`）互斥；课程本身不写入 `state.schedules`，也不出现在月历上；课表视图会调用 `getSchedulesForDate()` 把日程事件叠加渲染在时间轴上

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
| `selectedAccountId` | 记账弹窗中单选选中的账户 id（空字符串=未选） |
| `amountMode` | 记账金额输入方式 `'delta'`（变化量）/ `'final'`（末状态值） |
| `accountManaging` | 账户管理删除模式开关 |
| `todoViewMode` | 待办视图 `'normal'`（普通）/ `'longterm'`（长期，无截止日期强制要求，不参与超时/临期提醒） |
| `cdFormMode` / `cdFormDirection` | 倒数日弹窗当前选中的重复方式 / 显示方向 |
| `cdFormColor` / `cdFormIcon` | 倒数日弹窗当前选中的颜色 / 图标 |
| `cdEditingId` | 倒数日弹窗正在编辑的记录 id（null=新建） |
| `cdFestivalGroup` / `cdFestivalSelected` | 节日导入弹窗的分组筛选 / 已勾选的节日 key 集合 |

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
  ├── renderAccountList()    → #accountList（总资产 + 账户卡片）
  ├── renderTemplates()      → #templateList（含管理模式横幅）
  ├── renderCategoryBreakdown() → #categoryBreakdown
  ├── renderExpenseList()    → #expenseList（按日期分组）
  └── updateHeaderMonth()    → #monthPicker 同步

renderTodoView()
  ├── renderActiveTodos()    → #activeTodoList
  ├── renderCompletedTodos() → #completedTodoList
  └── updateTodoBadge()      → #todoBadge

renderScheduleView()          ← 按 settings.scheduleViewMode 二选一
  ├── 'month' → renderCalendar() + renderUpcoming()（calendar.js）
  └── 'course' → renderCourseView() → renderCourseGrid()（timetable.js，叠加 getSchedulesForDate()）

renderCountdownView()         ← 倒数日（countdown.js）
  ├── cdCompute(cd, today)    每条算出 nextDate / remain / passed / key / progress
  ├── #cdHeroArea  ← cdRenderHero()：排第一的那条大卡片
  └── #cdList      ← cdRenderItem()：其余按「置顶 → 剩余天数升序」排
```

**重要**: 每个 render 函数都有独立 try-catch，一个失败不影响其他。

## 事件委托模式

```
#expenseList click → [data-action] 路由到 batch-check / preview-img / delete-expense
#templateList click → [data-action="record-tpl"] 路由到 record/delete
#activeTodoList click → [data-action] 路由到 todo-batch-check / pin-todo / toggle-longterm / toggle-todo / delete-todo
#completedTodoList click → [data-action] 同上 + completed-batch-check
#accountList click → #btnAddAccount 打开新增弹窗 / [data-action="edit-account"]（受 accountManaging 控制）
#accountChipSelect click → 单选切换 selectedAccountId，重置 amountMode 为 'delta'
#courseGrid click → [data-action="edit-course"] / [data-action="edit-schedule-in-course"]
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
| `.todo-move-btn` | 顶层未完成待办 | 右侧按钮排第 1 个（✎ `+` 📌 🗑 之前），24×24 与其他图标按钮同尺寸；默认 `opacity:0`（同 `.todo-add-child`），`.todo-item:hover/:active` 或自身 `:focus-visible` 时显现；普通待办显示 🌱（转长期），长期待办显示 📅（转回普通，`.is-longterm`） |
| `.modal-fullscreen` | 报表打开 | 全屏模态，从底部滑入 |
| `.report-chart` | 报表渲染后 | Canvas 图表容器 |
| `.cat-tag` / `.cat-tag-del` | 设置中分类管理 | 分类标签 + 删除按钮 |
| `.account-chip.selected` | `selectedAccountId === id` | 蓝色边框高亮（单选） |
| `.amount-mode-btn.active` | `amountMode` 当前值 | 分段控件高亮态 |
| `.course-block.dimmed` | 课程本周不上课（`!active`） | 透明度降低 + 灰度，不隐藏 |
| `.course-block.sched-block` | 日程事件叠加块 | 与课程块区分样式，仅课表视图渲染 |

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
| 日程/重复规则不对 | `schedule.js`（expandRepeats 系列）|
| 账户余额/总资产不对 | `account.js`（applyExpenseToAccount/revertExpenseFromAccount）+ `expense.js` 联动 |
| 课表课程不显示或周数算错 | `course.js`（getWeekNumberForDate/getCoursesForWeek）+ `timetable.js`（renderCourseGrid） |
| 课表里日程没叠加显示 | `timetable.js` 是否正确调用 `getSchedulesForDate()` |
| 倒数日天数不对/农历差一天 | `countdown.js`（`cdDaysBetween` / `cdLunarToSolar` / `cdNextOccurrence`）；先用弹窗里的实时预览验证 |
| 倒数日按钮点了没反应 | `bindCountdownEvents()` 是否被 `events.js` 末尾调用；它是独立绑定，不会拖累其他事件 |

## UX 要点

- 待办完成需**双击确认**：第一次点击圆圈变橙+脉冲+「再点确认」提示，3秒超时自动取消
- 待办排序：📅截止日期 / 🔴优先级 两种模式 + ↑↓切换正倒序
  - priority 模式：pinned 只作为同级 tiebreaker，优先级高的排前面
  - deadline 模式：pinned 无条件置顶
- 待办时间状态：超时=红色左边框，临期=黄色左边框（阈值在设置中配置，默认3天）
- 待办备注：标题下方灰色小字
- **待办 ⇄ 长期待办 一键互转**：顶层未完成待办卡片右侧的 🌱 / 📅 图标按钮（排在 ✎ 之前，与其它图标按钮同尺寸、同样平时隐藏）可切换 `isLongTerm`；`toggleTodoLongTerm(id)` 会级联所有子待办一起换归属；转回普通时若没有截止日期自动补今天（可再点 ✎ 修改）；已完成的待办不显示该按钮，子待办也不显示（跟随父待办批量换）
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
- **账户单选**：记账弹窗内账户选择是单选（`.account-chip`），再点同一账户会取消选中，不支持多账户联动一笔
- **两种记账方式**：`amountMode='delta'` 直接填变化量（默认，行为与选账户前一致）；`amountMode='final'` 填末状态余额，保存时按 `delta = 输入值 - 账户当前余额` 反算，`delta===0` 会被拒绝保存
- **课表周一起始**：课表视图按周一~周日排列，与月历的周日起始惯例不同，两套周计算逻辑（`getMondayOfWeek` vs 月历内部逻辑）互不影响
- **课表周数锚点**：手动设置一次"某天是第几周"（`setCurrentWeekAnchor`），之后所有周数按该锚点线性推算，不需要每周手动更新
- **课程虚化不隐藏**：非本周课程仍渲染在时间轴对应位置，只是加 `.dimmed` 降低视觉权重，方便看到整学期课表结构
- **倒数日四种模式**：`once` 单次 / `yearly-solar` 每年公历 / `yearly-lunar` 每年农历 / `yearly-rule` 某月第N个星期X；前三者覆盖"生日/纪念日/中秋"，`yearly-rule` 专门处理母亲节、感恩节这类浮动节日
- **倒数日两种方向**：`countdown` 以「还剩N天」为主（副行给「已过去N天 · 第K次」），`countup` 以「已经过去N天」为主（副行给「距下次周年还剩N天」）
- **倒数日规律**：所有日期计算走 `Date.UTC` 整数天，不碰本地时区；农历「三十」遇 29 天小月自动回退到廿九（除夕靠这条）；公历 2/29 在平年回退到 2/28
- **倒数日排序**：置顶优先，其次按剩余天数升序，已过期（负数）排最后
- **节日导入去重**：导入的记录带 `festivalKey`，再次导入同一节日会跳过，弹窗里显示「已导入」且不可勾选
- **倒数日预览**：弹窗里改动任何字段都会实时算出「下次 X月X日 周X · 农历X · 还剩N天」，避免选错日期

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
- **发版必做**：把 `sw.js` 首行 `CACHE` 版本号 +1，否则浏览器不认为有新版本（SW 字节没变就不触发更新）
- Service Worker 更新策略：网络优先取文件 + `install` 里 `skipWaiting()` 静默接管 + `activate` 里删旧缓存并 `clients.claim()`；页面侧监听 `controllerchange` 自动 `location.reload()`。首次安装不刷新（用 `_hadController` 区分）；若用户开着弹窗（`.modal.show`）则改为顶部横幅提示，避免清掉正在填的表单
- 更新有延迟：GitHub Pages 构建 30s~2min，之后 CDN 还会缓存约 10min（`max-age=600`）。push 后别立刻验，急验可在网址后加 `?v=2` 绕过
- 每台设备 localStorage 独立，互不影响
- 跨设备迁移数据用「导出/导入」JSON 文件（左下角 ⋯ 菜单），或同步码

## 数据导出/导入

- `exportData()` — 打包成 JSON 文件下载，文件名 `daily-tracker-backup-YYYY-MM-DD-HHmm.json`。包格式 `{ v:3, exportedAt, expenses, todos, templates, schedules, accounts, countdowns, courseSchedule, settings }`，**含 settings**（自定义分类、同步ID、课表缩放等）；不加缩进，避免带截图的备份体积翻倍。返回 `{ bytes, counts }`
- `importData(jsonStr)` — 解析 JSON → 校验结构 → 替换 `state` 对应字段 → 若文件带 `settings` 则 `Object.assign` 回 settings 并 `saveSettings` → `saveData()` → 返回 `{ok, error?, settingsRestored?, counts?}`。旧版备份（只有 state、无 settings）仍可导入
- 云同步（npoint.io）/ 同步码导出导入同样覆盖 `accounts`/`countdowns`/`courseSchedule`（与 `schedules` 走同一套 pack/merge 逻辑）
- **同步码分两种**：⋯ → 复制/粘贴同步码 = 全模块整体覆盖（`exportSyncCode`/`importSyncCode`）；⋯ → 分模块同步 = 可勾选只导出/导入部分模块（`exportSyncCodeModules`/`previewSyncCodeModules`/`importSyncCodeModules`，模块清单见 `SYNC_MODULES`），两者都是**整体覆盖对应字段，不做合并/去重**——导入会直接替换本设备该模块的数据
- 入口：左下角 ⋯ 菜单 → 💾 导出数据 / 📥 导入数据
- 导入后自动调用 `renderExpenseView()` + `renderTodoView()` + `updateTodoBadge()` 刷新界面
- 容错：导入文件缺少字段时自动补空数组/默认对象，不丢已有数据的其他字段（`storage.js` 的 migration 逻辑会补全 `accounts`/`courseSchedule` 缺失字段）
