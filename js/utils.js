/* ============================================
   utils.js — 纯工具函数（无副作用、无 DOM）
   ============================================ */

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function fmtMoney(n) {
  return '¥' + Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  // 尝试解析，YYYY-MM-DD 格式
  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '—';
  const d = new Date(match[0] + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  const now = new Date();
  const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');

  if (dateStr.slice(0, 10) === todayStr) return '今天';
  if (dateStr.slice(0, 10) === yesterdayStr) return '昨天';

  const m = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const wd = weekdays[d.getDay()];
  return `${m}月${day}日 周${wd}`;
}

function fmtDateShort(dateStr) {
  if (!dateStr) return '—';
  try {
    // 只取前10个字符 YYYY-MM-DD，防止带时间戳的字符串
    const clean = dateStr.slice(0, 10);
    const parts = clean.split('-');
    if (parts.length < 3) return '—';
    const m = parseInt(parts[1]);
    const d = parseInt(parts[2]);
    if (isNaN(m) || isNaN(d) || m < 1 || m > 12 || d < 1 || d > 31) return '—';
    return `${m}月${d}日`;
  } catch(e) { return '—'; }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
