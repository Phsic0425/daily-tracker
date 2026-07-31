/* ============================================
   report.js — 月度 / 年度报表
   ============================================ */

function openReport() {
  const modal = document.getElementById('reportModal');
  const overlay = document.getElementById('reportOverlay');
  modal.classList.add('show');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
  renderReport();
}

function closeReport() {
  document.getElementById('reportModal').classList.remove('show');
  document.getElementById('reportOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

function renderReport() {
  const container = document.getElementById('reportContent');
  const year = viewMonth.year;
  const month = viewMonth.month;
  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  const monSum = getMonthSummary(year, month);

  let yIncome = 0, yExpense = 0;
  for (let m = 1; m <= 12; m++) {
    const s = getMonthSummary(year, m);
    yIncome += s.income;
    yExpense += s.expense;
  }

  let html = `
    <div class="report-block">
      <h4>📅 ${year}年${months[month-1]} — 月度汇总</h4>
      <div class="report-summary">
        <div class="report-num income"><div class="rn-val">${fmtMoney(monSum.income)}</div><div class="rn-label">收入</div></div>
        <div class="report-num expense"><div class="rn-val">${fmtMoney(monSum.expense)}</div><div class="rn-label">支出</div></div>
        <div class="report-num balance"><div class="rn-val">${fmtMoney(monSum.balance)}</div><div class="rn-label">结余</div></div>
      </div>
    </div>

    <div class="report-block">
      <h4>📆 ${year}年 — 年度总览</h4>
      <div class="report-summary">
        <div class="report-num income"><div class="rn-val">${fmtMoney(yIncome)}</div><div class="rn-label">总收入</div></div>
        <div class="report-num expense"><div class="rn-val">${fmtMoney(yExpense)}</div><div class="rn-label">总支出</div></div>
        <div class="report-num balance"><div class="rn-val">${fmtMoney(yIncome - yExpense)}</div><div class="rn-label">总结余</div></div>
      </div>
    </div>

    <div class="report-block">
      <h4>📈 ${year}年 月度趋势</h4>
      <table class="report-table">
        <thead><tr><th>月份</th><th>收入</th><th>支出</th><th>结余</th></tr></thead>
        <tbody>`;

  let totalInc = 0, totalExp = 0;
  for (let m = 1; m <= 12; m++) {
    const s = getMonthSummary(year, m);
    totalInc += s.income;
    totalExp += s.expense;
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
        <td><b>合计</b></td>
        <td class="col-inc">${fmtMoney(totalInc)}</td>
        <td class="col-exp">${fmtMoney(totalExp)}</td>
        <td class="col-bal">${fmtMoney(totalInc - totalExp)}</td>
      </tr>`;

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}
