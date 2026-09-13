/* ============================================
   config.js — 分类配置 & 常量
   ============================================ */

const EXPENSE_CATEGORIES = [
  { key: 'food',     icon: '🍜', name: '餐饮' },
  { key: 'transport',icon: '🚌', name: '交通' },
  { key: 'shopping', icon: '🛒', name: '购物' },
  { key: 'entertain',icon: '🎮', name: '娱乐' },
  { key: 'housing',  icon: '🏠', name: '居住' },
  { key: 'medical',  icon: '💊', name: '医疗' },
  { key: 'study',    icon: '📚', name: '学习' },
  { key: 'social',   icon: '🎁', name: '人情' },
  { key: 'digital',  icon: '📱', name: '数码' },
  { key: 'other',    icon: '📦', name: '其他' },
];

const INCOME_CATEGORIES = [
  { key: 'salary',   icon: '💰', name: '工资' },
  { key: 'parttime', icon: '💼', name: '兼职' },
  { key: 'bonus',    icon: '🧧', name: '红包' },
  { key: 'invest',   icon: '📈', name: '理财' },
  { key: 'refund',   icon: '💳', name: '退款' },
  { key: 'other',    icon: '📦', name: '其他' },
];

const PRIORITY_MAP = {
  high:   { label: '高', dot: 'high',   emoji: '🔴' },
  medium: { label: '中', dot: 'medium', emoji: '🟡' },
  low:    { label: '低', dot: 'low',    emoji: '🟢' },
};

const STORAGE_KEY = 'daily_tracker_data';

// ========== 日程常量 ==========

const REPEAT_MODES = [
  { key: 'once',          label: '仅一次',     icon: '1️⃣' },
  { key: 'daily',         label: '每天',       icon: '🔄' },
  { key: 'weekly',        label: '每周',       icon: '📅' },
  { key: 'monthly',       label: '每月',       icon: '📆' },
  { key: 'custom',        label: '自定义次数', icon: '🔢' },
  { key: 'yearly-solar',  label: '每年公历',   icon: '☀️' },
  { key: 'yearly-lunar',  label: '每年农历',   icon: '🌙' },
];

const SCHEDULE_COLORS = [
  '#6366F1', '#10B981', '#F43F5E', '#F59E0B',
  '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16',
];

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

const LUNAR_MONTH_NAMES = [
  '正', '二', '三', '四', '五', '六',
  '七', '八', '九', '十', '冬', '腊'
];

// 农历日名（初一～三十、以及特殊别名）
const LUNAR_DAY_NAMES = [
  '', '初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
  '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
  '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'
];

const REMINDER_OPTIONS = [
  { value: -1,  label: '不提醒' },
  { value: 0,   label: '准时' },
  { value: 5,   label: '提前5分钟' },
  { value: 10,  label: '提前10分钟' },
  { value: 15,  label: '提前15分钟' },
  { value: 30,  label: '提前30分钟' },
  { value: 60,  label: '提前1小时' },
  { value: 1440, label: '提前1天' },
];

// ========== 账户常量 ==========

const ACCOUNT_TYPES = [
  { key: 'bank',    icon: '💳', name: '银行卡' },
  { key: 'cash',    icon: '💵', name: '现金' },
  { key: 'virtual', icon: '📱', name: '虚拟账户' },
  { key: 'transit', icon: '🚋', name: '交通/一卡通' },
  { key: 'other',   icon: '📦', name: '其他' },
];

// ========== 课表常量 ==========

// 周一到周日显示顺序（课表专用，独立于日历的周日起始约定）
const WEEKDAY_NAMES_MON_START = ['一', '二', '三', '四', '五', '六', '日'];

// 默认节次时间（可在设置中自定义）
const DEFAULT_PERIODS = [
  { start: '08:00', end: '08:45', name: '' },
  { start: '08:55', end: '09:40', name: '' },
  { start: '10:00', end: '10:45', name: '' },
  { start: '10:55', end: '11:40', name: '' },
  { start: '14:00', end: '14:45', name: '' },
  { start: '14:55', end: '15:40', name: '' },
  { start: '16:00', end: '16:45', name: '' },
  { start: '16:55', end: '17:40', name: '' },
  { start: '19:00', end: '19:45', name: '' },
  { start: '19:55', end: '20:40', name: '' },
  { start: '20:50', end: '21:35', name: '' },
  { start: '21:45', end: '22:30', name: '' },
];

// ========== 同步模块 ==========

// 分模块导出/导入同步码时可选的模块列表
const SYNC_MODULES = [
  { key: 'expenses',       icon: '💰', name: '记账账单' },
  { key: 'todos',          icon: '✅', name: '待办事项' },
  { key: 'templates',      icon: '⚡', name: '快捷模板' },
  { key: 'schedules',      icon: '📅', name: '日程安排' },
  { key: 'accounts',       icon: '💼', name: '账户/总资产' },
  { key: 'courseSchedule', icon: '📚', name: '课表' },
  { key: 'settings',       icon: '⚙️', name: '设置选项' },
];

// 上课周数预设
const COURSE_WEEKS_PRESETS = [
  { key: 'all',  label: '全部周（1-20）', text: '1-20' },
  { key: 'odd',  label: '单周',           text: '1,3,5,7,9,11,13,15,17,19' },
  { key: 'even', label: '双周',           text: '2,4,6,8,10,12,14,16,18,20' },
  { key: 'custom', label: '自定义', text: '' },
];

// 合并默认分类和自定义分类（自定义优先覆盖同 key）
function getMergedCategories(type) {
  const defaults = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const customs = type === 'expense'
    ? (settings.customExpenseCategories || [])
    : (settings.customIncomeCategories || []);
  const deleted = type === 'expense'
    ? (settings.deletedExpenseCategories || [])
    : (settings.deletedIncomeCategories || []);
  // 先放默认（排除已删除），再放自定义；同key的自定义替代默认
  const map = {};
  defaults.forEach(c => {
    if (!deleted.includes(c.key)) map[c.key] = c;
  });
  customs.forEach(c => { map[c.key] = c; });
  return Object.values(map);
}
