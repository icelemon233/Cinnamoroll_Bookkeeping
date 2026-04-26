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

// ─────────────────────────────────────────────
// 月度预算
// ─────────────────────────────────────────────

const BUDGET_KEY = 'monthly_budgets'; // { 'YYYY-MM': number }

/**
 * 获取指定月份的预算金额
 * @param {string} yearMonth - 'YYYY-MM'，默认当前月
 * @returns {number} 预算金额，0 表示未设置
 */
function getMonthBudget(yearMonth) {
  if (!yearMonth) {
    const now = new Date();
    const m = now.getMonth() + 1;
    yearMonth = `${now.getFullYear()}-${m < 10 ? '0' + m : m}`;
  }
  const budgets = wx.getStorageSync(BUDGET_KEY) || {};
  return Number(budgets[yearMonth]) || 0;
}

/**
 * 设置指定月份的预算金额
 * @param {string} yearMonth - 'YYYY-MM'
 * @param {number} amount - 预算金额，0 表示清除预算
 */
function setMonthBudget(yearMonth, amount) {
  const budgets = wx.getStorageSync(BUDGET_KEY) || {};
  if (!amount || amount <= 0) {
    delete budgets[yearMonth];
  } else {
    budgets[yearMonth] = parseFloat(Number(amount).toFixed(2));
  }
  wx.setStorageSync(BUDGET_KEY, budgets);
}

/**
 * 搜索账单记录
 * @param {string} keyword - 搜索关键词（匹配备注、分类）
 * @param {Object} options - 可选过滤条件 { type, yearMonth }
 * @returns {Array} 匹配的账单记录，按时间倒序
 */
function searchRecords(keyword, options = {}) {
  let records = getRecords();
  const kw = (keyword || '').trim().toLowerCase();

  // 按月份筛选
  if (options.yearMonth) {
    records = records.filter(r => r.date && r.date.startsWith(options.yearMonth));
  }

  // 按类型筛选
  if (options.type && options.type !== 'all') {
    records = records.filter(r => r.type === options.type);
  }

  // 关键词匹配（空关键词返回全部）
  if (kw) {
    records = records.filter(r => {
      const note = (r.note || '').toLowerCase();
      const category = (r.category || '').toLowerCase();
      const amount = String(r.amount);
      return note.includes(kw) || category.includes(kw) || amount.includes(kw);
    });
  }

  return records;
}

// ─── 导出功能 ──────────────────────────────────────────

/**
 * 导出账单为 CSV 格式
 * @param {Array} records - 账单记录数组
 * @returns {string} CSV 字符串
 */
function exportToCSV(records) {
  const headers = ['日期', '类型', '分类', '金额', '备注'];
  const rows = records.map(r => [
    r.date || '',
    r.type === 'income' ? '收入' : '支出',
    r.category || '',
    r.amount || '0',
    r.note || ''
  ]);

  // 处理备注中的特殊字符
  const escapeCSV = (str) => {
    if (!str) return '';
    const s = String(str);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');

  return '\uFEFF' + csvContent; // BOM for Excel
}

/**
 * 下载 CSV 文件（微信小程序环境）
 * @param {string} csvContent
 * @param {string} filename
 */
function downloadCSV(csvContent, filename) {
  const fs = wx.getFileSystemManager();
  const filePath = `${wx.env.USER_DATA_PATH}/${filename}`;

  fs.writeFile({
    filePath,
    data: csvContent,
    encoding: 'utf8',
    success: () => {
      wx.showModal({
        title: '导出成功',
        content: `文件已保存到: ${filename}`,
        showCancel: false,
        confirmText: '知道啦'
      });
    },
    fail: (err) => {
      console.error('downloadCSV error:', err);
      wx.showToast({ title: '导出失败', icon: 'none' });
    }
  });
}

// ─── 连续记账天数 ──────────────────────────────────────

/**
 * 获取连续记账天数（打卡连击数）
 * 从今天往前数，每天至少有一条记录算「已记账」，连续不中断的天数即为连击。
 * 今天如果还没记账，则从昨天开始往前数。
 * @returns {{ streak: number, todayDone: boolean, longestStreak: number }}
 */
function getStreakDays() {
  const records = getRecords();
  if (!records || records.length === 0) {
    return { streak: 0, todayDone: false, longestStreak: 0 };
  }

  // 收集所有有记账的日期（去重）
  const datesSet = new Set();
  records.forEach(r => { if (r.date) datesSet.add(r.date); });

  const today = new Date();
  const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayStr = toDateStr(today);

  const todayDone = datesSet.has(todayStr);

  // 计算当前连击：从今天（或昨天）往前连续数
  let streak = 0;
  const startOffset = todayDone ? 0 : 1;
  for (let i = startOffset; ; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = toDateStr(d);
    if (datesSet.has(ds)) {
      streak++;
    } else {
      break;
    }
  }

  // 计算历史最长连击
  const sortedDates = Array.from(datesSet).sort();
  let longestStreak = 0;
  let cur = 0;
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      cur = 1;
    } else {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diffDays = Math.round((curr - prev) / 86400000);
      if (diffDays === 1) {
        cur++;
      } else {
        cur = 1;
      }
    }
    if (cur > longestStreak) longestStreak = cur;
  }

  return { streak, todayDone, longestStreak };
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
  formatDate,
  getMonthBudget,
  setMonthBudget,
  searchRecords,
  exportToCSV,
  downloadCSV,
  getStreakDays
};
