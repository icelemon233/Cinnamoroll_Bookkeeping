// utils/storage.js - 封装本地存储操作

const STORAGE_KEY = 'records';

/**
 * 获取所有账单记录
 * @returns {Array} 账单数组，按时间倒序排列
 */
function getRecords() {
  const records = wx.getStorageSync(STORAGE_KEY);
  return records || [];
}

/**
 * 保存一条账单记录
 * @param {Object} record - 账单对象 { id, type, category, amount, note, date }
 * @returns {Array} 更新后的全部账单
 */
function saveRecord(record) {
  const records = getRecords();
  // 检查是否为更新操作（id 已存在）
  const existingIndex = records.findIndex(r => r.id === record.id);
  if (existingIndex >= 0) {
    records[existingIndex] = record;
  } else {
    records.unshift(record); // 新记录插到最前面
  }
  wx.setStorageSync(STORAGE_KEY, records);
  return records;
}

/**
 * 更新一条已有账单记录
 * @param {number|string} id - 账单 id
 * @param {Object} patch - 需要更新的字段
 * @returns {{ success: boolean, records: Array }}
 */
function updateRecord(id, patch) {
  const records = getRecords();
  const idx = records.findIndex(r => String(r.id) === String(id));
  if (idx < 0) return { success: false, records };
  records[idx] = Object.assign({}, records[idx], patch);
  wx.setStorageSync(STORAGE_KEY, records);
  return { success: true, records };
}

/**
 * 根据 id 获取单条账单
 * @param {number|string} id
 * @returns {Object|null}
 */
function getRecordById(id) {
  const records = getRecords();
  return records.find(r => String(r.id) === String(id)) || null;
}

/**
 * 删除一条账单记录
 * @param {number} id - 账单 id
 * @returns {Array} 更新后的全部账单
 */
function deleteRecord(id) {
  const records = getRecords();
  const newRecords = records.filter(r => r.id !== id);
  wx.setStorageSync(STORAGE_KEY, newRecords);
  return newRecords;
}

/**
 * 获取指定月份的收支汇总
 * @param {string} yearMonth - 格式 'YYYY-MM'，默认当前月
 * @returns {{ income: number, expense: number, net: number, records: Array }}
 */
function getMonthSummary(yearMonth) {
  if (!yearMonth) {
    const now = new Date();
    const m = now.getMonth() + 1;
    yearMonth = `${now.getFullYear()}-${m < 10 ? '0' + m : m}`;
  }
  const allRecords = getRecords();
  const monthRecords = allRecords.filter(r => r.date && r.date.startsWith(yearMonth));

  let income = 0;
  let expense = 0;
  monthRecords.forEach(r => {
    if (r.type === 'income') {
      income += Number(r.amount) || 0;
    } else {
      expense += Number(r.amount) || 0;
    }
  });

  return {
    income: parseFloat(income.toFixed(2)),
    expense: parseFloat(expense.toFixed(2)),
    net: parseFloat((income - expense).toFixed(2)),
    records: monthRecords
  };
}

/**
 * 按日期分组账单
 * @param {Array} records - 账单数组
 * @returns {Array} [{ date: 'YYYY-MM-DD', records: [...] }, ...]
 */
function groupByDate(records) {
  const map = {};
  records.forEach(r => {
    const key = r.date || '未知日期';
    if (!map[key]) map[key] = [];
    map[key].push(r);
  });
  // 按日期倒序排列
  return Object.keys(map)
    .sort((a, b) => b.localeCompare(a))
    .map(date => ({ date, records: map[date] }));
}

/**
 * 获取各分类支出统计
 * @param {string} yearMonth - 格式 'YYYY-MM'，默认当前月
 * @returns {Array} [{ category, amount, percent }, ...]
 */
function getCategoryStats(yearMonth) {
  const { records } = getMonthSummary(yearMonth);
  const expenseRecords = records.filter(r => r.type === 'expense');

  const map = {};
  let total = 0;
  expenseRecords.forEach(r => {
    const cat = r.category || '其他';
    map[cat] = (map[cat] || 0) + (Number(r.amount) || 0);
    total += Number(r.amount) || 0;
  });

  return Object.keys(map).map(category => ({
    category,
    amount: parseFloat(map[category].toFixed(2)),
    percent: total > 0 ? parseFloat((map[category] / total * 100).toFixed(1)) : 0
  })).sort((a, b) => b.amount - a.amount);
}

/**
 * 格式化日期显示
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {string} 友好日期，如 '今天'、'昨天' 或 '04月10日'
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  if (dateStr === todayStr) return '今天';
  if (dateStr === yesterdayStr) return '昨天';
  const parts = dateStr.split('-');
  return `${parts[1]}月${parts[2]}日`;
}

module.exports = {
  getRecords,
  saveRecord,
  updateRecord,
  getRecordById,
  deleteRecord,
  getMonthSummary,
  groupByDate,
  getCategoryStats,
  formatDate
};
