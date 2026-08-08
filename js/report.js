/* ============================================
   report.js — 月度 / 年度报表 + Canvas 统计图
   ============================================ */

function openReport() {
  reportYear = viewMonth.year;
  reportMonth = viewMonth.month;
  document.getElementById('reportModal').classList.add('show');
  document.body.style.overflow = 'hidden';
  renderReport();
}

function closeReport() {
  document.getElementById('reportModal').classList.remove('show');
  document.body.style.overflow = '';
}

function renderReport() {
  const container = document.getElementById('reportContent');
  const year = reportYear;
  const month = reportMonth;
  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  document.getElementById('reportTitle').textContent = `📊 ${year}年${months[month-1]} 报告`;

  const monSum = getMonthSummary(year, month);
  const { expenseCats, incomeCats } = getCategoryBreakdown(year, month);

  // 年度汇总
  let yIncome = 0, yExpense = 0;
  for (let m = 1; m <= 12; m++) {
    const s = getMonthSummary(year, m);
    yIncome += s.income;
    yExpense += s.expense;
  }

  let html = `
    <div class="report-block">
      <div class="report-summary">
        <div class="report-num income"><div class="rn-val">${fmtMoney(monSum.income)}</div><div class="rn-label">本月收入</div></div>
        <div class="report-num expense"><div class="rn-val">${fmtMoney(monSum.expense)}</div><div class="rn-label">本月支出</div></div>
        <div class="report-num balance"><div class="rn-val">${fmtMoney(monSum.balance)}</div><div class="rn-label">本月结余</div></div>
      </div>
    </div>

    <div class="report-block">
      <div class="report-summary">
        <div class="report-num income"><div class="rn-val">${fmtMoney(yIncome)}</div><div class="rn-label">年度收入</div></div>
        <div class="report-num expense"><div class="rn-val">${fmtMoney(yExpense)}</div><div class="rn-label">年度支出</div></div>
        <div class="report-num balance"><div class="rn-val">${fmtMoney(yIncome - yExpense)}</div><div class="rn-label">年度结余</div></div>
      </div>
    </div>

    <!-- 月度趋势柱状图 -->
    <div class="report-block">
      <h4>📈 ${year}年 月度趋势</h4>
      <canvas id="chartTrend" class="report-chart" width="700" height="280"></canvas>
    </div>`;

  // 支出分类饼图
  if (expenseCats.length > 0) {
    html += `
    <div class="report-block">
      <h4>🔴 本月支出分布</h4>
      <canvas id="chartExpensePie" class="report-chart" width="320" height="280"></canvas>
      <table class="report-table">
        <thead><tr><th>分类</th><th>金额</th><th>占比</th></tr></thead>
        <tbody>${expenseCats.map(c => `<tr>
          <td>${c.icon} ${c.name}</td>
          <td class="col-exp">${fmtMoney(c.amount)}</td>
          <td>${c.percent.toFixed(1)}%</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  }

  // 收入分类饼图
  if (incomeCats.length > 0) {
    html += `
    <div class="report-block">
      <h4>🟢 本月收入来源</h4>
      <canvas id="chartIncomePie" class="report-chart" width="320" height="280"></canvas>
      <table class="report-table">
        <thead><tr><th>分类</th><th>金额</th><th>占比</th></tr></thead>
        <tbody>${incomeCats.map(c => `<tr>
          <td>${c.icon} ${c.name}</td>
          <td class="col-inc">${fmtMoney(c.amount)}</td>
          <td>${c.percent.toFixed(1)}%</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  }

  // 年度月度趋势表
  html += `
    <div class="report-block">
      <h4>📋 ${year}年 月度明细</h4>
      <table class="report-table">
        <thead><tr><th>月份</th><th>收入</th><th>支出</th><th>结余</th></tr></thead>
        <tbody>`;

  let totalInc = 0, totalExp = 0;
  for (let m = 1; m <= 12; m++) {
    const s = getMonthSummary(year, m);
    totalInc += s.income; totalExp += s.expense;
    if (s.income > 0 || s.expense > 0) {
      html += `<tr>
        <td>${months[m-1]}</td>
        <td class="col-inc">${s.income > 0 ? fmtMoney(s.income) : '-'}</td>
        <td class="col-exp">${s.expense > 0 ? fmtMoney(s.expense) : '-'}</td>
        <td class="col-bal" style="color:${s.balance >= 0 ? 'var(--income)' : 'var(--expense)'}">${fmtMoney(s.balance)}</td>
      </tr>`;
    }
  }
  html += `<tr>
    <td><b>合计</b></td><td class="col-inc">${fmtMoney(totalInc)}</td>
    <td class="col-exp">${fmtMoney(totalExp)}</td>
    <td class="col-bal">${fmtMoney(totalInc - totalExp)}</td>
  </tr></tbody></table></div>`;

  container.innerHTML = html;

  // 绘制图表（在 DOM 插入后）
  requestAnimationFrame(() => {
    drawTrendChart(year, months);
    if (expenseCats.length > 0) drawPieChart('chartExpensePie', expenseCats, '#F43F5E');
    if (incomeCats.length > 0) drawPieChart('chartIncomePie', incomeCats, '#10B981');
  });
}

// ---- Canvas 饼图 ----
function drawPieChart(canvasId, categories, baseColor) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 320;
  const h = 280;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const total = categories.reduce((s, c) => s + c.amount, 0);
  if (total === 0) return;

  const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 30;
  const colors = ['#F43F5E','#F97316','#F59E0B','#84CC16','#10B981','#06B6D4','#6366F1','#8B5CF6','#EC4899','#64748B'];

  let angle = -Math.PI / 2;
  categories.forEach((cat, i) => {
    const slice = (cat.amount / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();

    // 标签
    const midAngle = angle + slice / 2;
    const lx = cx + Math.cos(midAngle) * (r + 20);
    const ly = cy + Math.sin(midAngle) * (r + 20);
    ctx.fillStyle = '#64748B';
    ctx.font = '11px sans-serif';
    ctx.textAlign = midAngle > Math.PI / 2 && midAngle < Math.PI * 1.5 ? 'right' : 'left';
    const pct = (cat.percent >= 5 ? cat.percent.toFixed(0) + '%' : '');
    ctx.fillText(pct, lx, ly);

    angle += slice;
  });
}

// ---- Canvas 月度趋势柱状图 ----
function drawTrendChart(year, months) {
  const canvas = document.getElementById('chartTrend');
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 340;
  const h = 280;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // 收集数据
  const data = [];
  let maxVal = 0;
  for (let m = 1; m <= 12; m++) {
    const s = getMonthSummary(year, m);
    data.push({ month: months[m-1], income: s.income, expense: s.expense });
    maxVal = Math.max(maxVal, s.income, s.expense);
  }
  maxVal = Math.max(maxVal, 1);

  const pad = { top: 16, right: 16, bottom: 36, left: 44 };
  const pw = w - pad.left - pad.right;
  const ph = h - pad.top - pad.bottom;
  const barW = Math.max(4, (pw / 12) * 0.35);
  const gap = pw / 12;

  // Y 轴
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (ph / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = '#94A3B8';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(fmtMoneyShort(maxVal * (1 - i / 4)), pad.left - 4, y + 4);
  }

  // 柱状图
  data.forEach((d, i) => {
    const x = pad.left + gap * i + gap / 2;
    // 收入柱（绿色）
    const incH = (d.income / maxVal) * ph;
    ctx.fillStyle = '#10B981';
    ctx.fillRect(x - barW, pad.top + ph - incH, barW, incH);
    // 支出柱（红色）
    const expH = (d.expense / maxVal) * ph;
    ctx.fillStyle = '#F43F5E';
    ctx.fillRect(x, pad.top + ph - expH, barW, expH);
    // 月份标签
    ctx.fillStyle = '#94A3B8';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.month, x, h - 8);
  });

  // 图例
  ctx.fillStyle = '#10B981';
  ctx.fillRect(w - 120, 4, 10, 10);
  ctx.fillStyle = '#64748B';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('收入', w - 106, 13);
  ctx.fillStyle = '#F43F5E';
  ctx.fillRect(w - 60, 4, 10, 10);
  ctx.fillStyle = '#64748B';
  ctx.fillText('支出', w - 46, 13);
}

function fmtMoneyShort(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return Math.round(n).toString();
}
