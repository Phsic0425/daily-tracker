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
  { start: '08:00', end: '08:45', name: '', collapsed: false },
  { start: '08:55', end: '09:40', name: '', collapsed: false },
  { start: '10:00', end: '10:45', name: '', collapsed: false },
  { start: '10:55', end: '11:40', name: '', collapsed: false },
  { start: '14:00', end: '14:45', name: '', collapsed: false },
  { start: '14:55', end: '15:40', name: '', collapsed: false },
  { start: '16:00', end: '16:45', name: '', collapsed: false },
  { start: '16:55', end: '17:40', name: '', collapsed: false },
  { start: '19:00', end: '19:45', name: '', collapsed: false },
  { start: '19:55', end: '20:40', name: '', collapsed: false },
  { start: '20:50', end: '21:35', name: '', collapsed: false },
  { start: '21:45', end: '22:30', name: '', collapsed: false },
];

// ========== 同步模块 ==========

// 分模块导出/导入同步码时可选的模块列表
const SYNC_MODULES = [
  { key: 'expenses',       icon: '💰', name: '记账账单' },
  { key: 'todos',          icon: '✅', name: '待办事项' },
  { key: 'templates',      icon: '⚡', name: '快捷模板' },
  { key: 'schedules',      icon: '📅', name: '日程安排' },
  { key: 'countdowns',     icon: '⏳', name: '倒数日' },
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

// ========== 倒数日常量 ==========

// 重复模式
const COUNTDOWN_MODES = [
  { key: 'once',         label: '单次',     icon: '1️⃣', desc: '只在某一天发生一次，过了之后显示「已经过去 N 天」' },
  { key: 'yearly-solar', label: '每年公历', icon: '☀️', desc: '每年同一个公历月日，如生日、结婚纪念日' },
  { key: 'yearly-lunar', label: '每年农历', icon: '🌙', desc: '每年同一个农历月日，如长辈生日、中秋' },
  { key: 'yearly-rule',  label: '节日规则', icon: '📐', desc: '某月第 N 个星期几，如母亲节' },
];

// 节日库：导入后建成循环倒数日
// group: solar=公历固定 / lunar=农历固定 / rule=某月第N个星期X
const COUNTDOWN_FESTIVALS = [
  // ---- 公历 ----
  { key: 'solar-newyear',   group: 'solar', mode: 'yearly-solar', name: '元旦',     icon: '🎊', color: '#F59E0B', month: 1,  day: 1 },
  { key: 'solar-valentine', group: 'solar', mode: 'yearly-solar', name: '情人节',   icon: '💕', color: '#EC4899', month: 2,  day: 14 },
  { key: 'solar-women',     group: 'solar', mode: 'yearly-solar', name: '妇女节',   icon: '🌸', color: '#EC4899', month: 3,  day: 8 },
  { key: 'solar-fool',      group: 'solar', mode: 'yearly-solar', name: '愚人节',   icon: '🃏', color: '#84CC16', month: 4,  day: 1 },
  { key: 'solar-labour',    group: 'solar', mode: 'yearly-solar', name: '劳动节',   icon: '🛠', color: '#F59E0B', month: 5,  day: 1 },
  { key: 'solar-youth',     group: 'solar', mode: 'yearly-solar', name: '青年节',   icon: '🚩', color: '#F43F5E', month: 5,  day: 4 },
  { key: 'solar-children',  group: 'solar', mode: 'yearly-solar', name: '儿童节',   icon: '🎈', color: '#06B6D4', month: 6,  day: 1 },
  { key: 'solar-party',     group: 'solar', mode: 'yearly-solar', name: '建党节',   icon: '🏛', color: '#F43F5E', month: 7,  day: 1 },
  { key: 'solar-army',      group: 'solar', mode: 'yearly-solar', name: '建军节',   icon: '🎖', color: '#10B981', month: 8,  day: 1 },
  { key: 'solar-teacher',   group: 'solar', mode: 'yearly-solar', name: '教师节',   icon: '📚', color: '#6366F1', month: 9,  day: 10 },
  { key: 'solar-national',  group: 'solar', mode: 'yearly-solar', name: '国庆节',   icon: '🇨🇳', color: '#F43F5E', month: 10, day: 1 },
  { key: 'solar-halloween', group: 'solar', mode: 'yearly-solar', name: '万圣夜',   icon: '🎃', color: '#F97316', month: 10, day: 31 },
  { key: 'solar-shopping',  group: 'solar', mode: 'yearly-solar', name: '光棍节',   icon: '🛍', color: '#8B5CF6', month: 11, day: 11 },
  { key: 'solar-xmas-eve',  group: 'solar', mode: 'yearly-solar', name: '平安夜',   icon: '🎄', color: '#10B981', month: 12, day: 24 },
  { key: 'solar-xmas',      group: 'solar', mode: 'yearly-solar', name: '圣诞节',   icon: '🎅', color: '#F43F5E', month: 12, day: 25 },
  { key: 'solar-newyear-eve', group: 'solar', mode: 'yearly-solar', name: '跨年夜', icon: '🥂', color: '#8B5CF6', month: 12, day: 31 },
  // ---- 农历 ----
  { key: 'lunar-spring',    group: 'lunar', mode: 'yearly-lunar', name: '春节',     icon: '🧧', color: '#F43F5E', month: 1,  day: 1 },
  { key: 'lunar-lantern',   group: 'lunar', mode: 'yearly-lunar', name: '元宵节',   icon: '🏮', color: '#F59E0B', month: 1,  day: 15 },
  { key: 'lunar-dragon',    group: 'lunar', mode: 'yearly-lunar', name: '龙抬头',   icon: '🐉', color: '#10B981', month: 2,  day: 2 },
  { key: 'lunar-duanwu',    group: 'lunar', mode: 'yearly-lunar', name: '端午节',   icon: '🐲', color: '#10B981', month: 5,  day: 5 },
  { key: 'lunar-qixi',      group: 'lunar', mode: 'yearly-lunar', name: '七夕节',   icon: '🌌', color: '#8B5CF6', month: 7,  day: 7 },
  { key: 'lunar-zhongyuan', group: 'lunar', mode: 'yearly-lunar', name: '中元节',   icon: '🕯', color: '#64748B', month: 7,  day: 15 },
  { key: 'lunar-midautumn', group: 'lunar', mode: 'yearly-lunar', name: '中秋节',   icon: '🥮', color: '#F59E0B', month: 8,  day: 15 },
  { key: 'lunar-chongyang', group: 'lunar', mode: 'yearly-lunar', name: '重阳节',   icon: '🍂', color: '#F97316', month: 9,  day: 9 },
  { key: 'lunar-laba',      group: 'lunar', mode: 'yearly-lunar', name: '腊八节',   icon: '🥣', color: '#F59E0B', month: 12, day: 8 },
  { key: 'lunar-xiaonian',  group: 'lunar', mode: 'yearly-lunar', name: '小年',     icon: '🍬', color: '#EC4899', month: 12, day: 23 },
  { key: 'lunar-chuxi',     group: 'lunar', mode: 'yearly-lunar', name: '除夕',     icon: '🏮', color: '#F43F5E', month: 12, day: 30 },
  // ---- 规则日 ----
  { key: 'rule-mother',     group: 'rule',  mode: 'yearly-rule',  name: '母亲节',   icon: '🌷', color: '#EC4899', month: 5,  weekday: 0, nth: 2 },
  { key: 'rule-father',     group: 'rule',  mode: 'yearly-rule',  name: '父亲节',   icon: '👔', color: '#6366F1', month: 6,  weekday: 0, nth: 3 },
  { key: 'rule-thanks',     group: 'rule',  mode: 'yearly-rule',  name: '感恩节',   icon: '🦃', color: '#F97316', month: 11, weekday: 4, nth: 4 },
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
