/* ============================================
   help.js — 使用说明书
   ============================================ */

function renderHelp() {
  var h = '';
  h += '<div class="help-block">';
  h += '<div class="help-h2">📒 日常记账 v7</div>';
  h += '<p>个人记账 + 待办管理 + 日程规划，支持手机/平板/电脑，数据云端同步。</p>';
  h += '</div>';

  // === 记账 ===
  h += '<div class="help-block">';
  h += '<div class="help-h2">💰 记账</div>';

  h += '<div class="help-h3">记一笔</div>';
  h += '<p>点右下角 <b>+</b> 按钮 → 输入金额 → 选分类 → 确认日期 → 保存。</p>';
  h += '<p>📷 金额框旁的相机按钮可拍照/上传截图，系统会自动从剪贴板提取金额。</p>';
  h += '<p>✅ 勾选「同时保存为快捷模板」可复用常用账单。</p>';

  h += '<div class="help-h3">月度汇总</div>';
  h += '<p>顶部三张卡片显示当月 <b>收入/支出/结余</b>。左右箭头切换月份，也可直接点日期选择器。</p>';

  h += '<div class="help-h3">分类统计</div>';
  h += '<p>按支出/收入分类展示占比柱状图，一目了然钱花在哪。</p>';

  h += '<div class="help-h3">快捷模板</div>';
  h += '<p>常用账单可保存为模板，一键记账。点「管理」进入删除模式。</p>';

  h += '<div class="help-h3">报表</div>';
  h += '<p>点左下角 ⋯ → 📊 报表，查看月度/年度汇总、月度趋势柱状图和分类饼图。</p>';
  h += '</div>';

  // === 待办 ===
  h += '<div class="help-block">';
  h += '<div class="help-h2">✅ 待办</div>';

  h += '<div class="help-h3">添加待办</div>';
  h += '<p>输入标题 → 选截止日期 → 选优先级 → 添加。备注可选。</p>';

  h += '<div class="help-h3">完成待办</div>';
  h += '<p>点 ✓ 第一次变黄色，<b>再点一次确认完成</b>，防止误触。3 秒后自动取消确认状态。</p>';

  h += '<div class="help-h3">子任务（拆解大任务）</div>';
  h += '<p>每个待办右侧有 <b>+</b> 按钮 → 添加子任务。支持无限层级嵌套。</p>';
  h += '<p>点击 ▶/▼ 可折叠展开子任务。父任务显示 <b>[2/5]</b> 进度。</p>';
  h += '<p>⚠️ 父任务下有未完成子任务时，确认完成会弹出提醒。</p>';

  h += '<div class="help-h3">编辑待办</div>';
  h += '<p>点 ✎ 按钮 → 修改标题、截止日期、优先级、备注 → 保存。</p>';
  h += '<p>直接点击备注文字可快速修改备注。</p>';

  h += '<div class="help-h3">排序与筛选</div>';
  h += '<p>📅 按截止日期 / 🔴 按优先级排序。↑↓ 切换升序降序。</p>';
  h += '<p>📌 置顶重要待办。超时显示红色边框+⚠️标记，临期显示黄色边框+⏳倒计时。</p>';
  h += '</div>';

  // === 日程 ===
  h += '<div class="help-block">';
  h += '<div class="help-h2">📅 日程</div>';

  h += '<div class="help-h3">日历视图</div>';
  h += '<p>月历网格显示每天日程。格子内显示 <b>日程文字标签</b>（彩色）+ 农历日期。</p>';
  h += '<p>今天有蓝色标记，点击日期查看当天所有日程。</p>';
  h += '<p>左右箭头翻月，「今天」回到当月。📤 导出 JSON，长按导出日历图片。</p>';

  h += '<div class="help-h3">添加日程</div>';
  h += '<p>点右下角 +（需在日程 Tab）→ 填写标题、日期、时间 → 保存。</p>';

  h += '<div class="help-h3">重复规则（7种）</div>';
  h += '<table class="help-table"><tr><td>仅一次</td><td>只在指定日期</td></tr>';
  h += '<tr><td>每天</td><td>可设间隔（每N天）和结束日期</td></tr>';
  h += '<tr><td>每周</td><td>勾选星期几，可设间隔</td></tr>';
  h += '<tr><td>每月</td><td>每月同一天，自动处理月末</td></tr>';
  h += '<tr><td>自定义次数</td><td>指定重复次数和间隔天数</td></tr>';
  h += '<tr><td>每年公历</td><td>每年同月同日，如生日</td></tr>';
  h += '<tr><td>每年农历</td><td>农历同日，如春节、中秋节</td></tr></table>';

  h += '<div class="help-h3">提醒</div>';
  h += '<p>设置提醒时间（不提醒/准时/提前5分钟~1天）。</p>';
  h += '<p>到达提醒时间后弹出浏览器通知。首次使用需授权。</p>';

  h += '<div class="help-h3">日历显示文字</div>';
  h += '<p>可自定义日历格显示的简短文字（最多6字）。留空则自动截取标题前4字。</p>';

  h += '<div class="help-h3">即将到来</div>';
  h += '<p>倒计时卡片显示 <b>下一个日程</b> 还有多少天/时/分。</p>';
  h += '<p>下方列出近期日程，点击可跳转到对应日期。</p>';
  h += '</div>';

  // === 同步 ===
  h += '<div class="help-block">';
  h += '<div class="help-h2">☁️ 云端同步</div>';

  h += '<div class="help-h3">设置方法（1分钟，无需注册）</div>';
  h += '<ol>';
  h += '<li>电脑打开设置 → ☁️ 云端同步 → 点 <b>✨ 创建同步ID</b></li>';
  h += '<li>复制生成的同步ID（一串字母数字）</li>';
  h += '<li>手机打开同一个网站 → 设置 → ☁️ 云端同步 → 填入<b>同一个</b>同步ID</li>';
  h += '<li>打开「自动同步」开关</li>';
  h += '</ol>';
  h += '<p><b>之后电脑改了什么，手机30秒内自动看到。反过来也一样。</b></p>';

  h += '<div class="help-h3">手动同步</div>';
  h += '<p>设置里有 📥 手动下载 和 📤 手动上传 按钮，不想等自动同步时可以手动操作。</p>';

  h += '<div class="help-h3">同步码（备用）</div>';
  h += '<p>如果不想用云端同步，也可以用 ⋯ → 📋 复制同步码 / 📌 粘贴同步码 手动传输。</p>';
  h += '</div>';

  // === 设置 ===
  h += '<div class="help-block">';
  h += '<div class="help-h2">⚙️ 设置</div>';

  h += '<div class="help-h3">记账</div>';
  h += '<p>管理支出/收入分类：添加自定义分类，删除不需要的默认分类。</p>';

  h += '<div class="help-h3">待办</div>';
  h += '<p>时间状态显示、临期阈值（几天内算临期）、默认排序方式和方向、子任务默认展开/收起。</p>';

  h += '<div class="help-h3">日程</div>';
  h += '<p>显示农历日期、显示节假日和节气、日程标签/圆点切换、简洁模式。</p>';

  h += '<div class="help-h3">云端同步</div>';
  h += '<p>创建同步ID、自动上传下载、手动上传下载按钮。</p>';
  h += '</div>';

  // === 快捷键 ===
  h += '<div class="help-block">';
  h += '<div class="help-h2">⌨️ 快捷操作</div>';
  h += '<table class="help-table">';
  h += '<tr><td>Esc</td><td>关闭弹窗 / 退出子任务模式</td></tr>';
  h += '<tr><td>Enter</td><td>提交表单（添加待办等）</td></tr>';
  h += '<tr><td>长按 📤</td><td>导出日历图片</td></tr>';
  h += '<tr><td>双击 ✓</td><td>确认完成待办</td></tr>';
  h += '</table>';
  h += '</div>';

  h += '<p style="text-align:center;color:var(--text-muted);font-size:0.75rem;padding:16px 0">日常记账 v7 · 数据存储在浏览器 + GitHub Gist · 离线可用</p>';

  document.getElementById('helpContent').innerHTML = h;
}

function openHelp() {
  renderHelp();
  document.getElementById('helpModal').classList.add('show');
  document.getElementById('helpOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeHelp() {
  document.getElementById('helpModal').classList.remove('show');
  document.getElementById('helpOverlay').classList.remove('show');
  document.body.style.overflow = '';
}
