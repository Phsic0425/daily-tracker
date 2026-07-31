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
