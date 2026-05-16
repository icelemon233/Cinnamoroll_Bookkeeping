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

// ─────────────────────────────────────────────
// 分类预算
// ─────────────────────────────────────────────

const CAT_BUDGET_KEY = 'category_budgets'; // { 'YYYY-MM': { category: amount } }

/**
 * 获取指定月份某分类的预算
 * @param {string} yearMonth - 'YYYY-MM'
 * @param {string} category  - 分类名称
 * @returns {number} 预算金额，0 表示未设置
 */
function getCategoryBudget(yearMonth, category) {
  const all = wx.getStorageSync(CAT_BUDGET_KEY) || {};
  const monthBudgets = all[yearMonth] || {};
  return Number(monthBudgets[category]) || 0;
}

/**
 * 获取指定月份所有分类预算
 * @param {string} yearMonth - 'YYYY-MM'
 * @returns {{ [category: string]: number }}
 */
function getCategoryBudgets(yearMonth) {
  const all = wx.getStorageSync(CAT_BUDGET_KEY) || {};
  return all[yearMonth] || {};
}

/**
 * 设置指定月份某分类的预算
 * @param {string} yearMonth - 'YYYY-MM'
 * @param {string} category  - 分类名称
 * @param {number} amount    - 预算金额，0 表示清除
 */
function setCategoryBudget(yearMonth, category, amount) {
  const all = wx.getStorageSync(CAT_BUDGET_KEY) || {};
  if (!all[yearMonth]) all[yearMonth] = {};
  if (!amount || amount <= 0) {
    delete all[yearMonth][category];
    if (Object.keys(all[yearMonth]).length === 0) delete all[yearMonth];
  } else {
    all[yearMonth][category] = parseFloat(Number(amount).toFixed(2));
  }
  wx.setStorageSync(CAT_BUDGET_KEY, all);
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
 * 获取今日收支快速摘要
 * @returns {{ todayExpense: number, todayIncome: number, todayCount: number }}
 */
function getTodaySummary() {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const records = getRecords();
  const todayRecords = records.filter(r => r.date === todayStr);

  let todayExpense = 0;
  let todayIncome = 0;
  todayRecords.forEach(r => {
    if (r.type === 'income') {
      todayIncome += Number(r.amount) || 0;
    } else {
      todayExpense += Number(r.amount) || 0;
    }
  });

  return {
    todayExpense: parseFloat(todayExpense.toFixed(2)),
    todayIncome: parseFloat(todayIncome.toFixed(2)),
    todayCount: todayRecords.length
  };
}

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

// ─── 本月消费热力日历 ──────────────────────────────────

/**
 * 获取指定月份的逐日支出热力数据，用于首页热力日历卡片。
 *
 * 返回结构：
 *   {
 *     year: number,
 *     month: number,          // 1-12
 *     weeks: Array<Array<{    // 按周分组，每行 7 格（周一到周日）
 *       day: number,          // 1-31，0 表示占位空格
 *       amount: number,       // 当日支出合计（0 表示无支出）
 *       level: number,        // 0-4，热力等级（0=无数据，1-4=按四分位分级）
 *       isToday: boolean,
 *       isFuture: boolean     // 未来日期
 *     }>>,
 *     maxAmount: number,      // 当月最高单日支出
 *     totalDaysWithExpense: number
 *   }
 *
 * 周从周一开始（level 0 = 空/无支出）。
 */
function getMonthHeatmap(yearMonth) {
  if (!yearMonth) {
    const now = new Date();
    const m = now.getMonth() + 1;
    yearMonth = `${now.getFullYear()}-${m < 10 ? '0' + m : m}`;
  }

  const [year, month] = yearMonth.split('-').map(Number);
  const allRecords = getRecords();

  // 汇总当月每天的支出
  const dayExpense = {}; // key: 'YYYY-MM-DD', value: number
  allRecords.forEach(r => {
    if (!r.date || !r.date.startsWith(yearMonth) || r.type !== 'expense') return;
    dayExpense[r.date] = (dayExpense[r.date] || 0) + (Number(r.amount) || 0);
  });

  // 计算热力等级分界（四分位）
  const amounts = Object.values(dayExpense).filter(v => v > 0);
  const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 0;
  let thresholds = [0, 0, 0, 0]; // level 1/2/3/4 的下界
  if (maxAmount > 0) {
    thresholds = [
      maxAmount * 0.01,     // level 1: > 0
      maxAmount * 0.25,     // level 2: > 25%
      maxAmount * 0.55,     // level 3: > 55%
      maxAmount * 0.80      // level 4: > 80%
    ];
  }

  const getLevel = (amount) => {
    if (!amount || amount <= 0) return 0;
    if (amount >= thresholds[3]) return 4;
    if (amount >= thresholds[2]) return 3;
    if (amount >= thresholds[1]) return 2;
    return 1;
  };

  // 今天
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isCurrentMonth = (year === now.getFullYear() && month === (now.getMonth() + 1));

  // 当月第一天是星期几（0=周日，1=周一…，转为周一=0的偏移）
  const firstDay = new Date(year, month - 1, 1);
  const firstDayOfWeek = firstDay.getDay(); // 0=周日
  // 转为周一起始（周一=0, ..., 周日=6）
  const startOffset = (firstDayOfWeek === 0) ? 6 : firstDayOfWeek - 1;

  // 当月总天数
  const daysInMonth = new Date(year, month, 0).getDate();

  // 构建格子数组（含前置空格）
  const cells = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: 0, amount: 0, level: 0, isToday: false, isFuture: false, isEmpty: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const amount = parseFloat((dayExpense[dateStr] || 0).toFixed(2));
    const isFuture = isCurrentMonth && dateStr > todayStr;
    cells.push({
      day: d,
      amount,
      level: isFuture ? 0 : getLevel(amount),
      isToday: dateStr === todayStr,
      isFuture,
      isEmpty: false
    });
  }

  // 补齐末尾至整行（7的倍数）
  while (cells.length % 7 !== 0) {
    cells.push({ day: 0, amount: 0, level: 0, isToday: false, isFuture: false, isEmpty: true });
  }

  // 按每7个分为一周
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return {
    year,
    month,
    weeks,
    maxAmount,
    totalDaysWithExpense: amounts.length
  };
}

/**
 * 获取最近 N 个月的收支汇总数组（从早到晚排列）
 * @param {number} n - 月份数，默认 6
 * @returns {Array<{ ym: string, label: string, income: number, expense: number, net: number }>}
 */
function getRecentMonthsSummary(n) {
  const count = n || 6;
  const result = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const ym = `${year}-${month < 10 ? '0' + month : month}`;
    const label = `${month}月`;
    const summary = getMonthSummary(ym);
    result.push({ ym, label, income: summary.income, expense: summary.expense, net: summary.net });
  }
  return result;
}

/**
 * 获取本周（周一~今天）每日收支数据
 * @returns {{
 *   days: Array<{ dateStr: string, label: string, shortLabel: string, income: number, expense: number, isToday: boolean, isFuture: boolean }>,
 *   weekIncome: number,
 *   weekExpense: number,
 *   weekNet: number,
 *   maxAmount: number,
 *   topCategory: string | null,
 *   topCategoryAmount: number
 * }}
 */
function getWeekSummary() {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // 找到本周一（周一=1，周日=0转为7）
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1=Mon...7=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek - 1));

  const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];
  const SHORT_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const allRecords = getRecords();

  // 构建本周7天数组
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const isFuture = dateStr > todayStr;
    const isToday = dateStr === todayStr;

    let income = 0, expense = 0;
    if (!isFuture) {
      allRecords.forEach(r => {
        if (r.date !== dateStr) return;
        if (r.type === 'income') income += Number(r.amount) || 0;
        else expense += Number(r.amount) || 0;
      });
    }

    days.push({
      dateStr,
      label: WEEK_LABELS[i],
      shortLabel: SHORT_LABELS[i],
      income: parseFloat(income.toFixed(2)),
      expense: parseFloat(expense.toFixed(2)),
      isToday,
      isFuture
    });
  }

  // 汇总
  let weekIncome = 0, weekExpense = 0;
  days.forEach(d => {
    weekIncome += d.income;
    weekExpense += d.expense;
  });
  weekIncome = parseFloat(weekIncome.toFixed(2));
  weekExpense = parseFloat(weekExpense.toFixed(2));
  const weekNet = parseFloat((weekIncome - weekExpense).toFixed(2));
  const maxAmount = Math.max(...days.map(d => d.expense), 0);

  // 本周支出最多分类
  const categoryMap = {};
  allRecords.forEach(r => {
    if (!r.date || r.type !== 'expense') return;
    if (r.date < days[0].dateStr || r.date > todayStr) return;
    const cat = r.category || '其他';
    categoryMap[cat] = (categoryMap[cat] || 0) + (Number(r.amount) || 0);
  });
  let topCategory = null, topCategoryAmount = 0;
  Object.keys(categoryMap).forEach(cat => {
    if (categoryMap[cat] > topCategoryAmount) {
      topCategoryAmount = categoryMap[cat];
      topCategory = cat;
    }
  });

  return {
    days,
    weekIncome,
    weekExpense,
    weekNet,
    maxAmount,
    topCategory,
    topCategoryAmount: parseFloat(topCategoryAmount.toFixed(2))
  };
}

/**
 * 获取指定分类下最近的 N 条历史记录，用于记账页快速填入
 * @param {string} category - 分类名称
 * @param {string} type - 'expense' | 'income'
 * @param {number} limit - 最多返回条数，默认 3
 * @returns {Array<{ amount: number, note: string, date: string }>}
 *   已去重（按 amount+note 组合），按时间倒序
 */
function getRecentCategoryRecords(category, type, limit) {
  const n = limit || 3;
  const records = getRecords();
  const seen = new Set();
  const result = [];

  for (const r of records) {
    if (r.category !== category || r.type !== type) continue;
    const key = `${r.amount}|${r.note || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      amount: r.amount,
      note: r.note || '',
      date: r.date || ''
    });
    if (result.length >= n) break;
  }

  return result;
}

// ─── 搜索历史记录 ──────────────────────────────────────────

const SEARCH_HISTORY_KEY = 'search_history';
const SEARCH_HISTORY_MAX = 8; // 最多保存 8 条历史

/**
 * 获取搜索历史记录列表
 * @returns {string[]} 最近搜索词数组，从新到旧排列
 */
function getSearchHistory() {
  return wx.getStorageSync(SEARCH_HISTORY_KEY) || [];
}

/**
 * 保存一条搜索词到历史记录
 * 相同关键词会移到最前面；超出上限时删除最旧的条目
 * @param {string} keyword - 搜索关键词（trim 后不为空）
 */
function saveSearchHistory(keyword) {
  if (!keyword || !keyword.trim()) return;
  const kw = keyword.trim();
  let history = getSearchHistory();
  // 去重：已存在则先移除
  history = history.filter(h => h !== kw);
  // 插到最前面
  history.unshift(kw);
  // 截断至最大条数
  if (history.length > SEARCH_HISTORY_MAX) {
    history = history.slice(0, SEARCH_HISTORY_MAX);
  }
  wx.setStorageSync(SEARCH_HISTORY_KEY, history);
}

/**
 * 删除单条搜索历史记录
 * @param {string} keyword
 */
function deleteSearchHistory(keyword) {
  let history = getSearchHistory();
  history = history.filter(h => h !== keyword);
  wx.setStorageSync(SEARCH_HISTORY_KEY, history);
}

/**
 * 清空所有搜索历史
 */
function clearSearchHistory() {
  wx.setStorageSync(SEARCH_HISTORY_KEY, []);
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
  getStreakDays,
  getTodaySummary,
  getMonthHeatmap,
  getRecentMonthsSummary,
  getWeekSummary,
  getRecentCategoryRecords,
  getSearchHistory,
  saveSearchHistory,
  deleteSearchHistory,
  clearSearchHistory,
  getCategoryBudget,
  getCategoryBudgets,
  setCategoryBudget
};
