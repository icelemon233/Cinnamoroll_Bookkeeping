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
 * 获取今日 vs 昨日消费对比数据
 * 用于记账页「今日速览」中的同比提示条
 * @returns {{
 *   todayExpense: number,
 *   yesterdayExpense: number,
 *   diff: number,           // 今日 - 昨日，正值表示花更多
 *   diffAbs: number,        // 差值绝对值
 *   diffPct: number,        // 变化百分比（昨日为0时返回null）
 *   isUp: boolean,          // 今日 > 昨日
 *   isDown: boolean,        // 今日 < 昨日
 *   isSame: boolean,        // 今日 == 昨日
 *   hasYesterday: boolean,  // 昨日是否有消费记录（昨日=0则隐藏对比）
 *   hasTodayExpense: boolean // 今日是否有支出
 * }}
 */
function getDailySummaryCompare() {
  const now = new Date();
  const toStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayStr = toStr(now);
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  const yesterdayStr = toStr(yest);

  const records = getRecords();
  let todayExpense = 0;
  let yesterdayExpense = 0;
  let hasYesterdayRecord = false;

  records.forEach(r => {
    if (r.type === 'expense') {
      if (r.date === todayStr) todayExpense += Number(r.amount) || 0;
      if (r.date === yesterdayStr) {
        yesterdayExpense += Number(r.amount) || 0;
        hasYesterdayRecord = true;
      }
    }
  });

  todayExpense = parseFloat(todayExpense.toFixed(2));
  yesterdayExpense = parseFloat(yesterdayExpense.toFixed(2));
  const diff = parseFloat((todayExpense - yesterdayExpense).toFixed(2));
  const diffAbs = Math.abs(diff);
  const diffPct = hasYesterdayRecord && yesterdayExpense > 0
    ? Math.round(Math.abs(diff / yesterdayExpense) * 100)
    : null;

  return {
    todayExpense,
    yesterdayExpense,
    diff,
    diffAbs,
    diffPct,
    isUp: diff > 0,
    isDown: diff < 0,
    isSame: diff === 0,
    hasYesterday: hasYesterdayRecord,
    hasTodayExpense: todayExpense > 0
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
 * 获取本周 vs 上周同期的消费对比数据，用于记账页本周速览
 * @returns {{
 *   weekExpense: number,       // 本周（截至今天）支出合计
 *   prevWeekExpense: number,   // 上周同期（相同天数）支出合计
 *   diff: number,              // 差值（本周 - 上周）
 *   diffAbs: number,           // 差值绝对值
 *   isUp: boolean,             // 本周 > 上周
 *   isDown: boolean,           // 本周 < 上周
 *   isSame: boolean,           // 持平
 *   hasPrevWeek: boolean,      // 上周是否有数据
 *   weekDaysPassed: number,    // 本周已过天数（含今天，1-7）
 *   topCategory: string|null,  // 本周最大支出分类
 *   topEmoji: string,          // 对应 emoji
 *   topAmount: number,         // 本周最大分类金额
 *   hasData: boolean           // 本周是否有支出记录
 * }}
 */
function getWeekCompare() {
  const CAT_EMOJI = {
    '餐饮': '🍜', '交通': '🚌', '购物': '🛍️', '娱乐': '🎮',
    '住房': '🏠', '医疗': '💊', '教育': '📚', '运动': '🏃',
    '旅行': '✈️', '宠物': '🐾', '日用': '🧴',
    '工资': '💼', '奖金': '🎁', '副业': '💡', '理财': '📈', '红包': '🧧',
    '其他': '📦'
  };

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // 本周一日期
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1=Mon...7=Sun
  const weekDaysPassed = dayOfWeek; // 本周已过天数（含今天）

  const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (dayOfWeek - 1));

  // 本周各天 dateStr（仅已过天数，含今天）
  const thisWeekDates = [];
  for (let i = 0; i < weekDaysPassed; i++) {
    const d = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + i);
    thisWeekDates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }

  // 上周同期各天 dateStr（同样天数）
  const prevWeekDates = [];
  for (let i = 0; i < weekDaysPassed; i++) {
    const d = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7 + i);
    prevWeekDates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }

  const allRecords = getRecords();

  let weekExpense = 0;
  let prevWeekExpense = 0;
  const catMap = {};

  allRecords.forEach(r => {
    if (r.type !== 'expense') return;
    const amt = Number(r.amount) || 0;
    if (thisWeekDates.includes(r.date)) {
      weekExpense += amt;
      const cat = r.category || '其他';
      catMap[cat] = (catMap[cat] || 0) + amt;
    } else if (prevWeekDates.includes(r.date)) {
      prevWeekExpense += amt;
    }
  });

  weekExpense = parseFloat(weekExpense.toFixed(2));
  prevWeekExpense = parseFloat(prevWeekExpense.toFixed(2));
  const diff = parseFloat((weekExpense - prevWeekExpense).toFixed(2));

  // 本周最大支出分类
  let topCategory = null, topAmount = 0;
  Object.keys(catMap).forEach(cat => {
    if (catMap[cat] > topAmount) { topAmount = catMap[cat]; topCategory = cat; }
  });
  topAmount = parseFloat(topAmount.toFixed(2));

  const DAY_LABELS = ['', '一', '二', '三', '四', '五', '六', '日'];

  return {
    weekExpense,
    prevWeekExpense,
    diff,
    diffAbs: Math.abs(diff),
    isUp: diff > 0,
    isDown: diff < 0,
    isSame: diff === 0,
    hasPrevWeek: prevWeekExpense > 0,
    weekDaysPassed,
    weekDayLabel: DAY_LABELS[weekDaysPassed] || '日', // 周几
    topCategory,
    topEmoji: topCategory ? (CAT_EMOJI[topCategory] || '📦') : '',
    topAmount,
    hasData: weekExpense > 0
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

/**
 * 获取指定分类/类型的高频常用金额
 * 统计历史记录中每个金额出现频率，返回 top-N 去重金额
 * @param {string} category - 分类名称
 * @param {string} type - 'expense' | 'income'
 * @param {number} limit - 最多返回条数，默认 5
 * @returns {number[]} 常用金额数组（降频排序，最多 limit 个）
 */
function getTopAmounts(category, type, limit) {
  const n = limit || 5;
  const records = getRecords();
  const freqMap = {};

  for (const r of records) {
    if (r.category !== category || r.type !== type) continue;
    const amt = Number(r.amount);
    if (!amt || amt <= 0) continue;
    freqMap[amt] = (freqMap[amt] || 0) + 1;
  }

  return Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))
    .slice(0, n)
    .map(([amt]) => Number(amt));
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

/**
 * 计算财务健康评分
 *
 * 评分维度（总分 100）：
 *   1. 收支比健康度（40分）：本月收入 > 0 时，储蓄率越高分越高；无收入但无支出给满分
 *   2. 记账习惯（25分）：基于当前连续记账天数
 *   3. 预算执行（20分）：设置预算且不超支给满分，未设置给一半，超支给 0
 *   4. 近3月趋势（15分）：连续三月有净储蓄给满分，两月给 2/3，一月给 1/3，皆无给 0
 *
 * @param {string} yearMonth - 当前月份，如 '2026-05'
 * @returns {{
 *   score: number,           // 0-100 整数
 *   level: string,           // '优秀' | '良好' | '一般' | '需改善'
 *   levelEmoji: string,
 *   levelColor: string,      // 主色调（用于进度环）
 *   tip: string,             // 核心建议文案（一句话）
 *   dimensions: Array<{ label: string, score: number, maxScore: number, icon: string }>
 * }}
 */
function getFinanceHealthScore(yearMonth) {
  // ── 维度1：收支比健康度（40分）──
  const summary = getMonthSummary(yearMonth);
  let dim1 = 0;
  if (summary.income > 0) {
    // 储蓄率 = net / income，0~1 线性映射到 0~40分，超支时为 0
    const savingRate = Math.max(0, summary.net / summary.income);
    dim1 = Math.min(40, Math.round(savingRate * 40));
  } else if (summary.expense === 0) {
    // 本月既无收入也无支出：可能刚开始，给满分（不惩罚）
    dim1 = 40;
  } else {
    // 有支出无收入，说明纯花费，给 0
    dim1 = 0;
  }

  // ── 维度2：记账习惯（25分）──
  const { streak, longestStreak } = getStreakDays();
  // 综合当前连击和历史最长连击，取较大值作为参考，上限 30 天对应满分
  const habitRef = Math.max(streak, longestStreak);
  let dim2 = 0;
  if (habitRef >= 30) dim2 = 25;
  else if (habitRef >= 14) dim2 = 20;
  else if (habitRef >= 7)  dim2 = 15;
  else if (habitRef >= 3)  dim2 = 10;
  else if (habitRef >= 1)  dim2 = 5;
  else dim2 = 0;

  // ── 维度3：预算执行（20分）──
  const budget = getMonthBudget(yearMonth);
  let dim3 = 0;
  if (budget > 0) {
    if (summary.expense <= budget) {
      // 有预算且未超支，按使用率给分（用了少一点给满分，用到边缘略扣分）
      const usageRate = summary.expense / budget; // 0~1
      if (usageRate <= 0.9) dim3 = 20;
      else dim3 = Math.round((1 - usageRate) * 20 / 0.1); // 90%~100%线性降到0
      dim3 = Math.max(0, dim3);
    } else {
      dim3 = 0; // 超预算
    }
  } else {
    // 未设预算：给一半分作为鼓励
    dim3 = 10;
  }

  // ── 维度4：近3月净储蓄趋势（15分）──
  const recent3 = getRecentMonthsSummary(3);
  // 排除当前月（数据不完整），看前两个月；若当月为完整月，一起算
  const savingMonths = recent3.filter(m => m.net > 0).length;
  let dim4 = 0;
  if (savingMonths >= 3) dim4 = 15;
  else if (savingMonths === 2) dim4 = 10;
  else if (savingMonths === 1) dim4 = 5;
  else dim4 = 0;

  const score = dim1 + dim2 + dim3 + dim4;

  // ── 等级和颜色 ──
  let level, levelEmoji, levelColor;
  if (score >= 85) {
    level = '优秀'; levelEmoji = '🏆'; levelColor = '#4FB8D4';
  } else if (score >= 65) {
    level = '良好'; levelEmoji = '🌟'; levelColor = '#7EC8E3';
  } else if (score >= 40) {
    level = '一般'; levelEmoji = '🌱'; levelColor = '#F0B966';
  } else {
    level = '需改善'; levelEmoji = '💪'; levelColor = '#FF8BAB';
  }

  // ── 最薄弱维度 → 生成建议 ──
  const dims = [
    { key: 'spending', score: dim1, maxScore: 40 },
    { key: 'habit',    score: dim2, maxScore: 25 },
    { key: 'budget',   score: dim3, maxScore: 20 },
    { key: 'trend',    score: dim4, maxScore: 15 }
  ];
  const weakest = dims.reduce((a, b) => (a.score / a.maxScore < b.score / b.maxScore ? a : b));

  const tipMap = {
    spending: summary.income > 0
      ? `本月储蓄率偏低，尝试控制非必要支出 💰`
      : '记录收入来源，让财务画面更完整 📊',
    habit: streak === 0
      ? '今天还没记账哦，坚持每日记录更准确 📝'
      : `连续记账 ${streak} 天，继续保持好习惯 🔥`,
    budget: budget === 0
      ? '设置月度预算，帮助控制消费节奏 🎯'
      : `预算使用已超支，下月提前规划分类开销 ⚠️`,
    trend: '近几个月储蓄偏少，制定存钱目标有助于积累 🐾'
  };

  const tip = tipMap[weakest.key];

  // ── 维度详情（用于展示） ──
  const dimensions = [
    { label: '收支比', score: dim1, maxScore: 40, icon: '💰' },
    { label: '记账习惯', score: dim2, maxScore: 25, icon: '📝' },
    { label: '预算执行', score: dim3, maxScore: 20, icon: '🎯' },
    { label: '储蓄趋势', score: dim4, maxScore: 15, icon: '📈' }
  ];

  return { score, level, levelEmoji, levelColor, tip, dimensions };
}

// ─────────────────────────────────────────────
// 月度复盘报告
// ─────────────────────────────────────────────

/**
 * 分类 emoji 映射（内部使用）
 */
const REPORT_CATEGORY_EMOJI = {
  '餐饮': '🍜', '交通': '🚌', '购物': '🛍️', '娱乐': '🎮',
  '住房': '🏠', '医疗': '💊', '教育': '📚', '运动': '🏃',
  '旅行': '✈️', '宠物': '🐾', '日用': '🧴',
  '工资': '💼', '奖金': '🎁', '副业': '💡', '理财': '📈', '红包': '🧧',
  '其他': '📦'
};

/**
 * 生成月度复盘文字报告
 * @param {string} yearMonth - 'YYYY-MM'
 * @returns {string} 可直接复制/分享的纯文字报告
 */
function generateMonthReport(yearMonth) {
  if (!yearMonth) {
    const now = new Date();
    const m = now.getMonth() + 1;
    yearMonth = `${now.getFullYear()}-${m < 10 ? '0' + m : m}`;
  }

  const [year, month] = yearMonth.split('-');
  const monthLabel = `${year}年${month}月`;

  const summary = getMonthSummary(yearMonth);
  const { income, expense, net, records } = summary;

  // 没有任何数据时，返回提示
  if (records.length === 0) {
    return `📒 ${monthLabel} 月度复盘\n\n本月暂无账单记录，快去记一笔吧～ 🐾`;
  }

  // ── 基础统计 ──
  const recordCount = records.length;
  const expenseRecords = records.filter(r => r.type === 'expense');
  const incomeRecords  = records.filter(r => r.type === 'income');

  // 计算有账单的天数
  const recordDays = new Set(records.map(r => r.date)).size;

  // 日均支出（只算有记录的天数，避免除以0）
  const avgDailyExpense = recordDays > 0
    ? parseFloat((expense / recordDays).toFixed(2))
    : 0;

  // ── 分类排名 ──
  const catMap = {};
  expenseRecords.forEach(r => {
    const cat = r.category || '其他';
    catMap[cat] = (catMap[cat] || 0) + (Number(r.amount) || 0);
  });
  const catList = Object.keys(catMap)
    .map(cat => ({ cat, amount: parseFloat(catMap[cat].toFixed(2)) }))
    .sort((a, b) => b.amount - a.amount);

  // ── 上月对比 ──
  const [y, m] = [parseInt(year), parseInt(month)];
  const prevDate = new Date(y, m - 2, 1); // JS月从0开始，m-2就是上上个月
  const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const prevSummary = getMonthSummary(prevYM);
  const prevExpense = prevSummary.expense;
  const hasCompare = prevSummary.records.length > 0;

  // ── 储蓄率 ──
  const savingRate = income > 0
    ? Math.round((net / income) * 100)
    : null;

  // ── 最大单笔支出 ──
  const maxRecord = expenseRecords.length > 0
    ? expenseRecords.reduce((max, r) => (Number(r.amount) > Number(max.amount) ? r : max), expenseRecords[0])
    : null;

  // ─── 组装报告文字 ───

  const lines = [];

  // 标题
  lines.push(`📒 ${monthLabel} 月度复盘`);
  lines.push('─'.repeat(20));

  // 收支概览
  lines.push('💰 收支概览');
  if (income > 0) lines.push(`  收入：¥${income}`);
  lines.push(`  支出：¥${expense}`);
  if (income > 0) {
    const netSign = net >= 0 ? '+' : '';
    lines.push(`  结余：${netSign}¥${net}`);
    if (savingRate !== null) {
      lines.push(`  储蓄率：${savingRate}%`);
    }
  }
  lines.push('');

  // 记账概况
  lines.push('📝 记账概况');
  lines.push(`  共记账 ${recordCount} 条，覆盖 ${recordDays} 天`);
  if (expense > 0) {
    lines.push(`  日均支出：¥${avgDailyExpense}（仅计有记录天数）`);
  }
  lines.push('');

  // Top3 支出分类
  if (catList.length > 0) {
    lines.push('🏆 支出分类 TOP' + Math.min(3, catList.length));
    const medals = ['🥇', '🥈', '🥉'];
    catList.slice(0, 3).forEach((item, i) => {
      const emoji = REPORT_CATEGORY_EMOJI[item.cat] || '📦';
      const pct = expense > 0 ? ` (${(item.amount / expense * 100).toFixed(1)}%)` : '';
      lines.push(`  ${medals[i]} ${emoji}${item.cat}：¥${item.amount}${pct}`);
    });
    lines.push('');
  }

  // 最大单笔支出
  if (maxRecord) {
    const maxEmoji = REPORT_CATEGORY_EMOJI[maxRecord.category] || '📦';
    const noteStr = maxRecord.note ? `「${maxRecord.note}」` : '';
    lines.push(`💸 最大单笔支出`);
    lines.push(`  ${maxEmoji}${maxRecord.category} ${noteStr}¥${maxRecord.amount}（${maxRecord.date}）`);
    lines.push('');
  }

  // 与上月对比
  if (hasCompare) {
    const diff = parseFloat((expense - prevExpense).toFixed(2));
    const diffSign = diff > 0 ? '+' : '';
    const diffEmoji = diff > 0 ? '📈' : (diff < 0 ? '📉' : '➡️');
    const prevMonth = `${prevDate.getFullYear()}年${String(prevDate.getMonth() + 1).padStart(2, '0')}月`;
    lines.push(`${diffEmoji} 与上月对比（${prevMonth}）`);
    lines.push(`  上月支出：¥${prevExpense}`);
    lines.push(`  本月${diff > 0 ? '多花' : diff < 0 ? '少花' : '持平'} ${diffSign}¥${Math.abs(diff)}`);
    lines.push('');
  }

  // 简洁小建议（规则驱动）
  const tips = [];
  if (savingRate !== null && savingRate < 20) {
    tips.push('储蓄率偏低，可尝试为每个分类设置月度预算 🎯');
  }
  if (catList.length > 0 && catList[0].amount / expense > 0.5) {
    const topCat = catList[0].cat;
    tips.push(`「${topCat}」占总支出超过一半，下月可重点关注 💡`);
  }
  if (recordDays < 7 && recordCount > 0) {
    tips.push('记账天数较少，坚持每天记录账单会更准确哦 📝');
  }
  if (net > 0 && income > 0 && savingRate >= 30) {
    tips.push(`储蓄率达到 ${savingRate}%，保持这个好习惯 🌟`);
  }
  if (tips.length > 0) {
    lines.push('💡 小建议');
    tips.slice(0, 2).forEach(t => lines.push(`  · ${t}`));
    lines.push('');
  }

  lines.push('─'.repeat(20));
  lines.push('由肉桂卷记账小程序生成 🐾');

  return lines.join('\n');
}

// ─────────────────────────────────────────────
// 月度储蓄目标
// ─────────────────────────────────────────────

const SAVING_GOAL_KEY = 'saving_goals'; // { 'YYYY-MM': number }

/**
 * 获取指定月份的储蓄目标
 * @param {string} yearMonth - 'YYYY-MM'，默认当前月
 * @returns {number} 储蓄目标金额，0 表示未设置
 */
function getSavingGoal(yearMonth) {
  if (!yearMonth) {
    const now = new Date();
    const m = now.getMonth() + 1;
    yearMonth = `${now.getFullYear()}-${m < 10 ? '0' + m : m}`;
  }
  const goals = wx.getStorageSync(SAVING_GOAL_KEY) || {};
  return Number(goals[yearMonth]) || 0;
}

/**
 * 设置指定月份的储蓄目标
 * @param {string} yearMonth - 'YYYY-MM'
 * @param {number} amount - 目标金额，0 表示清除
 */
function setSavingGoal(yearMonth, amount) {
  const goals = wx.getStorageSync(SAVING_GOAL_KEY) || {};
  if (!amount || amount <= 0) {
    delete goals[yearMonth];
  } else {
    goals[yearMonth] = parseFloat(Number(amount).toFixed(2));
  }
  wx.setStorageSync(SAVING_GOAL_KEY, goals);
}

/**
 * 获取月度储蓄目标进度数据
 * @param {string} yearMonth - 'YYYY-MM'
 * @returns {Object|null}
 *   {
 *     goal: number,         // 目标金额
 *     actual: number,       // 实际净结余（income - expense）
 *     percent: number,      // 完成进度 0-100
 *     isAchieved: boolean,  // 是否已达标
 *     diff: number,         // 距离目标的差值（正=还需，负=已超额）
 *     tipText: string,
 *     tipEmoji: string
 *   }
 * 若未设置目标则返回 null
 */
function getSavingGoalProgress(yearMonth) {
  const goal = getSavingGoal(yearMonth);
  if (!goal || goal <= 0) return null;

  const summary = getMonthSummary(yearMonth);
  const actual = summary.net; // 收入 - 支出 = 净结余

  const percent = goal > 0 ? Math.min(100, parseFloat((actual / goal * 100).toFixed(1))) : 0;
  const isAchieved = actual >= goal;
  const diff = parseFloat((goal - actual).toFixed(2)); // 正=还差多少，负=已超额

  // 生成激励文案
  let tipText = '';
  let tipEmoji = '🐾';

  if (actual <= 0) {
    tipText = '本月还没有结余，继续记录收支来追踪进度～';
    tipEmoji = '🌱';
  } else if (isAchieved) {
    const extra = Math.abs(diff);
    if (extra > 0) {
      tipText = `目标已达成！还超额储蓄了 ¥${extra}，太棒了 🎉`;
    } else {
      tipText = '恰好达成储蓄目标，收支控制得很好！';
    }
    tipEmoji = '🎉';
  } else if (percent >= 80) {
    tipText = `已完成 ${percent}%，距目标还差 ¥${diff}，加油冲刺！`;
    tipEmoji = '💪';
  } else if (percent >= 50) {
    tipText = `已完成一半！还差 ¥${diff} 就能达成目标～`;
    tipEmoji = '✨';
  } else if (percent >= 20) {
    tipText = `完成了 ${percent}%，注意控制支出，争取达成目标～`;
    tipEmoji = '🎯';
  } else {
    tipText = `刚刚起步，离目标还差 ¥${diff}，多记录多规划～`;
    tipEmoji = '🌸';
  }

  return {
    goal,
    actual,
    percent: Math.max(0, percent), // 结余为负时显示 0
    isAchieved,
    diff,
    tipText,
    tipEmoji
  };
}

// ─────────────────────────────────────────────
// 备注智能联想补全
// ─────────────────────────────────────────────

/**
 * 根据关键词从历史记录中获取备注联想建议
 *
 * 优先级排序：
 *   1. 当前分类/类型下的历史备注（权重高）
 *   2. 其他分类的历史备注
 * 同一备注按出现频率排序，去重后返回
 *
 * @param {string} keyword        - 用户已输入的关键词（trim 后）
 * @param {string} category       - 当前选中分类（用于提升权重）
 * @param {string} type           - 'expense' | 'income'
 * @param {number} [limit=6]      - 最多返回条数
 * @returns {string[]}            - 匹配的备注文字数组
 */
function getNoteAutoComplete(keyword, category, type, limit) {
  const n = limit || 6;
  if (!keyword || !keyword.trim()) return [];
  const kw = keyword.trim().toLowerCase();

  const records = getRecords();
  // 统计每条备注出现频率，同时标记是否来自当前分类
  const noteMap = {}; // { note: { count, sameCat } }

  for (const r of records) {
    if (!r.note || !r.note.trim()) continue;
    const note = r.note.trim();
    const noteLower = note.toLowerCase();
    // 必须包含关键词
    if (!noteLower.includes(kw)) continue;
    // 跳过与关键词完全相同的条目（用户已输入，无需再建议）
    if (noteLower === kw) continue;

    if (!noteMap[note]) {
      noteMap[note] = { count: 0, sameCat: false };
    }
    noteMap[note].count++;
    if (r.category === category && r.type === type) {
      noteMap[note].sameCat = true;
    }
  }

  // 排序：同分类优先，其次按频率降序
  return Object.entries(noteMap)
    .sort((a, b) => {
      const [, av] = a;
      const [, bv] = b;
      if (av.sameCat !== bv.sameCat) return bv.sameCat ? 1 : -1;
      return bv.count - av.count;
    })
    .slice(0, n)
    .map(([note]) => note);
}

// ─────────────────────────────────────────────
// 快捷记账模板
// ─────────────────────────────────────────────

const TEMPLATES_KEY = 'record_templates';
const TEMPLATES_MAX = 10; // 最多保存 10 个模板

/**
 * 获取所有快捷记账模板
 * @returns {Array<{ id: number, type: string, category: string, amount: number, note: string, name: string }>}
 */
function getTemplates() {
  return wx.getStorageSync(TEMPLATES_KEY) || [];
}

/**
 * 保存一个快捷记账模板
 * 若已达上限（10个），移除最旧的那条
 * @param {{ type: string, category: string, amount: number, note: string, name: string }} tpl
 * @returns {{ success: boolean, templates: Array }}
 */
function saveTemplate(tpl) {
  const templates = getTemplates();
  if (templates.length >= TEMPLATES_MAX) {
    // 移除最旧的（数组末尾）
    templates.pop();
  }
  const newTpl = {
    id: Date.now(),
    type: tpl.type || 'expense',
    category: tpl.category || '其他',
    amount: parseFloat(Number(tpl.amount).toFixed(2)),
    note: (tpl.note || '').trim(),
    name: (tpl.name || '').trim()
  };
  templates.unshift(newTpl);
  wx.setStorageSync(TEMPLATES_KEY, templates);
  return { success: true, templates };
}

/**
 * 删除指定 id 的模板
 * @param {number|string} id
 * @returns {{ success: boolean, templates: Array }}
 */
function deleteTemplate(id) {
  const templates = getTemplates();
  const filtered = templates.filter(t => String(t.id) !== String(id));
  wx.setStorageSync(TEMPLATES_KEY, filtered);
  return { success: templates.length !== filtered.length, templates: filtered };
}

// ─────────────────────────────────────────────
// 分类消费排行榜（跨时间段）
// ─────────────────────────────────────────────

/**
 * 获取指定时间范围内的分类消费排行榜
 *
 * @param {string} startYM - 起始月份 'YYYY-MM'（含）
 * @param {string} endYM   - 结束月份 'YYYY-MM'（含）
 * @param {string} [type='expense'] - 'expense' | 'income'
 * @returns {{
 *   items: Array<{ category: string, amount: number, percent: number, count: number, avgAmount: number }>,
 *   total: number,
 *   months: number,
 *   dailyAvg: number
 * }}
 */
function getCategoryRanking(startYM, endYM, type) {
  const rankType = type || 'expense';
  const allRecords = getRecords();

  // 过滤时间范围和类型
  const filtered = allRecords.filter(r => {
    if (!r.date || r.type !== rankType) return false;
    const ym = r.date.substring(0, 7); // 'YYYY-MM'
    return ym >= startYM && ym <= endYM;
  });

  // 统计各分类金额与次数
  const categoryMap = {}; // { cat: { amount, count } }
  let total = 0;

  filtered.forEach(r => {
    const cat = r.category || '其他';
    if (!categoryMap[cat]) categoryMap[cat] = { amount: 0, count: 0 };
    const amt = Number(r.amount) || 0;
    categoryMap[cat].amount += amt;
    categoryMap[cat].count += 1;
    total += amt;
  });

  total = parseFloat(total.toFixed(2));

  // 计算跨越的月份数（用于日均）
  const [sy, sm] = startYM.split('-').map(Number);
  const [ey, em] = endYM.split('-').map(Number);
  const months = Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
  const daysApprox = months * 30;
  const dailyAvg = total > 0 ? parseFloat((total / daysApprox).toFixed(2)) : 0;

  const items = Object.keys(categoryMap)
    .map(category => ({
      category,
      amount: parseFloat(categoryMap[category].amount.toFixed(2)),
      count: categoryMap[category].count,
      avgAmount: categoryMap[category].count > 0
        ? parseFloat((categoryMap[category].amount / categoryMap[category].count).toFixed(2))
        : 0,
      percent: total > 0
        ? parseFloat((categoryMap[category].amount / total * 100).toFixed(1))
        : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  return { items, total, months, dailyAvg };
}

// ─────────────────────────────────────────────
// 周期性固定账单（Recurring Bills）
// ─────────────────────────────────────────────

const RECURRING_KEY = 'recurring_bills';
// 数据结构：[{ id, name, amount, category, type, note, dayOfMonth, isActive }]
// dayOfMonth: 1-28，每月的哪一天应该记账（0 表示不限定）

/**
 * 获取全部固定账单配置
 */
function getRecurringBills() {
  try {
    return wx.getStorageSync(RECURRING_KEY) || [];
  } catch (e) {
    return [];
  }
}

/**
 * 新增固定账单
 * @param {{ name, amount, category, type, note, dayOfMonth, isActive }} bill
 * @returns {{ success: boolean, bill: object }}
 */
function addRecurringBill(bill) {
  const bills = getRecurringBills();
  const newBill = {
    id: Date.now().toString(),
    name: bill.name || bill.category,
    amount: bill.amount,
    category: bill.category,
    type: bill.type || 'expense',
    note: bill.note || '',
    dayOfMonth: bill.dayOfMonth || 0,
    isActive: bill.isActive !== false
  };
  bills.push(newBill);
  try {
    wx.setStorageSync(RECURRING_KEY, bills);
    return { success: true, bill: newBill };
  } catch (e) {
    return { success: false, bill: null };
  }
}

/**
 * 更新固定账单（仅更新传入字段）
 */
function updateRecurringBill(id, patch) {
  const bills = getRecurringBills();
  const idx = bills.findIndex(b => String(b.id) === String(id));
  if (idx === -1) return false;
  bills[idx] = Object.assign({}, bills[idx], patch);
  try {
    wx.setStorageSync(RECURRING_KEY, bills);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 删除固定账单
 */
function deleteRecurringBill(id) {
  const bills = getRecurringBills();
  const filtered = bills.filter(b => String(b.id) !== String(id));
  try {
    wx.setStorageSync(RECURRING_KEY, filtered);
    return bills.length !== filtered.length;
  } catch (e) {
    return false;
  }
}

/**
 * 获取本月「待提醒」的固定账单列表
 * 规则：isActive=true，且本月尚未在同分类/类型/金额下记录过对应账单
 *       （以 note 中含有固定账单 id 作为已记录标记）
 *
 * @param {string} yearMonth - 'YYYY-MM'
 * @returns {Array<{ bill, daysUntil, isOverdue }>}
 *   daysUntil: 距离 dayOfMonth 的天数（负数表示已过了该日期）
 *   isOverdue: 已超过 dayOfMonth 且本月未记录
 */
function getRecurringReminders(yearMonth) {
  const bills = getRecurringBills().filter(b => b.isActive);
  if (!bills.length) return [];

  // 查本月已有记录中打了固定账单标记的
  const allRecords = getRecords();
  const monthRecords = allRecords.filter(r => r.date && r.date.startsWith(yearMonth));
  const doneIds = new Set();
  monthRecords.forEach(r => {
    if (r.note) {
      const match = r.note.match(/\[recurring:(\w+)\]/);
      if (match) doneIds.add(match[1]);
    }
  });

  const now = new Date();
  const [year, month] = yearMonth.split('-').map(Number);
  const todayDate = now.getDate();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;

  return bills
    .filter(b => !doneIds.has(String(b.id)))
    .map(b => {
      let daysUntil = null;
      let isOverdue = false;
      if (b.dayOfMonth && isCurrentMonth) {
        daysUntil = b.dayOfMonth - todayDate;
        isOverdue = daysUntil < 0;
      }
      return { bill: b, daysUntil, isOverdue };
    })
    .sort((a, b) => {
      // 已过期排前面，无日期排后面
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      if (a.daysUntil !== null && b.daysUntil !== null) return a.daysUntil - b.daysUntil;
      return 0;
    });
}

/**
 * 获取指定分类/类型的真实历史记录（不去重，按时间倒序）
 * 用于长按分类时的历史弹窗展示
 * @param {string} category - 分类名称
 * @param {string} type - 'expense' | 'income'
 * @param {number} limit - 最多返回条数，默认 5
 * @returns {Array} [{ amount, note, date, id }]
 */
function getCategoryHistory(category, type, limit) {
  const n = limit || 5;
  const records = getRecords();
  return records
    .filter(r => r.category === category && r.type === type)
    .sort((a, b) => b.id - a.id)
    .slice(0, n)
    .map(r => ({
      id: r.id,
      amount: r.amount,
      note: r.note || '',
      date: r.date || ''
    }));
}

/**
 * 消费异常智能预警
 * 分析当月各分类消费是否明显偏离历史均值，同时检测活跃分类是否长时间未记录
 * @param {string} yearMonth - 'YYYY-MM'
 * @returns {Array} alerts [{ type, category, emoji, title, desc, level, icon }]
 *   type: 'overspend'（超支预警）| 'inactive'（分类沉默）| 'newcat'（新分类突增）
 *   level: 'warning'（⚠️中等）| 'danger'（🚨严重）| 'info'（💡提示）
 */
function getSpendingAlerts(yearMonth) {
  const CATEGORY_EMOJI_MAP = {
    '餐饮': '🍜', '交通': '🚌', '购物': '🛍️', '娱乐': '🎮',
    '住房': '🏠', '医疗': '💊', '教育': '📚', '运动': '🏃',
    '旅行': '✈️', '宠物': '🐾', '日用': '🧴',
    '工资': '💼', '奖金': '🎁', '副业': '💡', '理财': '📈', '红包': '🧧',
    '其他': '📦'
  };

  const alerts = [];
  const records = getRecords();
  const now = new Date();
  const [curYear, curMonthNum] = yearMonth.split('-').map(Number);

  // 当月支出记录
  const curRecords = records.filter(r => r.type === 'expense' && r.date && r.date.startsWith(yearMonth));

  // 按分类汇总当月支出
  const curCatMap = {};
  curRecords.forEach(r => {
    curCatMap[r.category] = (curCatMap[r.category] || 0) + r.amount;
  });

  // 计算过去 3 个月（不含当月）各分类的月均支出
  const historyCatMap = {}; // { category: [month1Total, month2Total, month3Total] }
  for (let i = 1; i <= 3; i++) {
    const d = new Date(curYear, curMonthNum - 1 - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthRecords = records.filter(r => r.type === 'expense' && r.date && r.date.startsWith(ym));
    const monthCatTotals = {};
    monthRecords.forEach(r => {
      monthCatTotals[r.category] = (monthCatTotals[r.category] || 0) + r.amount;
    });
    Object.keys(monthCatTotals).forEach(cat => {
      if (!historyCatMap[cat]) historyCatMap[cat] = [];
      historyCatMap[cat].push(monthCatTotals[cat]);
    });
  }

  // 计算历史均值（补 0 到 3 个月）
  const histAvg = {};
  Object.keys(historyCatMap).forEach(cat => {
    const vals = historyCatMap[cat];
    while (vals.length < 3) vals.push(0);
    histAvg[cat] = vals.reduce((a, b) => a + b, 0) / 3;
  });

  // ── 异常1：当月分类消费超出历史均值 ≥ 80%（且超出额 ≥ 50 元）──
  Object.keys(curCatMap).forEach(cat => {
    const cur = parseFloat(curCatMap[cat].toFixed(2));
    const avg = histAvg[cat] || 0;
    if (avg > 0) {
      const ratio = (cur - avg) / avg;
      const diff = parseFloat((cur - avg).toFixed(2));
      if (ratio >= 1.5 && diff >= 50) {
        alerts.push({
          type: 'overspend',
          category: cat,
          emoji: CATEGORY_EMOJI_MAP[cat] || '📦',
          title: `${cat}消费异常偏高`,
          desc: `本月已花 ¥${cur}，比历史均值 ¥${avg.toFixed(2)} 高出 ¥${diff}（+${Math.round(ratio * 100)}%）`,
          level: 'danger',
          icon: '🚨'
        });
      } else if (ratio >= 0.8 && diff >= 50) {
        alerts.push({
          type: 'overspend',
          category: cat,
          emoji: CATEGORY_EMOJI_MAP[cat] || '📦',
          title: `${cat}消费偏高`,
          desc: `本月已花 ¥${cur}，比历史均值 ¥${avg.toFixed(2)} 高出 ¥${diff}（+${Math.round(ratio * 100)}%）`,
          level: 'warning',
          icon: '⚠️'
        });
      }
    } else if (avg === 0 && cur >= 200) {
      alerts.push({
        type: 'newcat',
        category: cat,
        emoji: CATEGORY_EMOJI_MAP[cat] || '📦',
        title: `${cat}首次出现大额消费`,
        desc: `本月在此分类消费 ¥${cur}，过去 3 个月均无记录`,
        level: 'info',
        icon: '💡'
      });
    }
  });

  // ── 异常2：过去 3 个月有活跃记录的分类，本月至今（过了 10 天后）没有任何记录 ──
  const dayOfMonth = now.getDate();
  const isSameMonth = now.getFullYear() === curYear && (now.getMonth() + 1) === curMonthNum;
  if (isSameMonth && dayOfMonth >= 10) {
    const activeCats = Object.keys(histAvg).filter(cat => histAvg[cat] >= 20);
    activeCats.forEach(cat => {
      if (!curCatMap[cat]) {
        const histMonthCount = (historyCatMap[cat] || []).filter(v => v > 0).length;
        if (histMonthCount >= 2) {
          alerts.push({
            type: 'inactive',
            category: cat,
            emoji: CATEGORY_EMOJI_MAP[cat] || '📦',
            title: `${cat}本月还没有记录`,
            desc: `过去 3 个月月均消费 ¥${histAvg[cat].toFixed(2)}，本月暂无该分类账单，可能有漏记～`,
            level: 'info',
            icon: '🔔'
          });
        }
      }
    });
  }

  // 按 level 排序：danger > warning > info
  const levelOrder = { danger: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => (levelOrder[a.level] || 2) - (levelOrder[b.level] || 2));

  return alerts;
}

/**
 * 获取本周（周一~周日）打卡状态，用于打卡连击卡片中展示每日打卡小日历。
 * @returns {Array<{ label: string, dateStr: string, done: boolean, isToday: boolean, isFuture: boolean }>}
 *   共 7 项，对应周一到周日
 */
function getWeekCheckin() {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // 找到本周一
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1=Mon ... 7=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek - 1));

  // 获取所有有记账的日期集合（去重）
  const records = getRecords();
  const datesSet = new Set();
  records.forEach(r => { if (r.date) datesSet.add(r.date); });

  const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  const result = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    result.push({
      label: DAY_LABELS[i],
      dateStr,
      done: datesSet.has(dateStr),
      isToday: dateStr === todayStr,
      isFuture: dateStr > todayStr
    });
  }
  return result;
}

/**
 * 记账成功后的分类消费小结
 * 返回本月该分类累计金额/笔数，以及与上月对比信息
 * @param {string} category - 分类名称
 * @param {string} type - 'expense' | 'income'
 * @param {string} yearMonth - 当前月份 'YYYY-MM'，默认当月
 * @returns {Object} { curTotal, curCount, prevTotal, diff, diffAbs, diffPct, isUp, isDown, isSame, hasPrev, tip, tipEmoji }
 */
function getCategorySaveSummary(category, type, yearMonth) {
  if (!yearMonth) {
    const now = new Date();
    const m = now.getMonth() + 1;
    yearMonth = `${now.getFullYear()}-${m < 10 ? '0' + m : m}`;
  }

  // 计算上月 YYYY-MM
  const [y, m] = yearMonth.split('-').map(Number);
  const prevDate = new Date(y, m - 2, 1); // m-2 因为 getMonth 是 0-indexed，m-1 是当月，m-2 是上月
  const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const allRecords = getRecords();

  // 本月该分类记录
  const curRecords = allRecords.filter(r =>
    r.date && r.date.startsWith(yearMonth) &&
    r.category === category && r.type === type
  );
  const curTotal = parseFloat(curRecords.reduce((s, r) => s + (Number(r.amount) || 0), 0).toFixed(2));
  const curCount = curRecords.length;

  // 上月该分类记录
  const prevRecords = allRecords.filter(r =>
    r.date && r.date.startsWith(prevYM) &&
    r.category === category && r.type === type
  );
  const prevTotal = parseFloat(prevRecords.reduce((s, r) => s + (Number(r.amount) || 0), 0).toFixed(2));
  const hasPrev = prevRecords.length > 0;

  // 对比计算
  const diff = parseFloat((curTotal - prevTotal).toFixed(2));
  const diffAbs = Math.abs(diff);
  const diffPct = prevTotal > 0 ? parseFloat((diffAbs / prevTotal * 100).toFixed(1)) : 0;
  const isUp = diff > 0.01;
  const isDown = diff < -0.01;
  const isSame = !isUp && !isDown;

  // 生成提示文案
  let tip = '';
  let tipEmoji = '';
  if (type === 'expense') {
    if (!hasPrev) {
      tip = `本月首次记录${category}支出`;
      tipEmoji = '✨';
    } else if (isSame) {
      tip = `与上月持平`;
      tipEmoji = '😌';
    } else if (isUp) {
      tip = `比上月多 ¥${diffAbs}（+${diffPct}%）`;
      tipEmoji = diffPct > 50 ? '😱' : diffPct > 20 ? '🤔' : '📈';
    } else {
      tip = `比上月少 ¥${diffAbs}（-${diffPct}%）`;
      tipEmoji = '🎉';
    }
  } else {
    if (!hasPrev) {
      tip = `本月首笔${category}收入`;
      tipEmoji = '💪';
    } else if (isSame) {
      tip = `与上月持平`;
      tipEmoji = '😌';
    } else if (isUp) {
      tip = `比上月多 ¥${diffAbs}（+${diffPct}%）`;
      tipEmoji = '🚀';
    } else {
      tip = `比上月少 ¥${diffAbs}（-${diffPct}%）`;
      tipEmoji = '😔';
    }
  }

  return { curTotal, curCount, prevTotal, diff, diffAbs, diffPct, isUp, isDown, isSame, hasPrev, tip, tipEmoji };
}

// ─────────────────────────────────────────────
// 备注收藏夹 (Note Favorites)
// 存储结构：[{ id, text, category, type, createdAt }]
// ─────────────────────────────────────────────
const NOTE_FAVORITES_KEY = 'note_favorites';
const NOTE_FAVORITES_MAX = 20;

/**
 * 获取所有备注收藏
 * @returns {Array<{ id: number, text: string, category: string, type: string, createdAt: number }>}
 */
function getNoteFavorites() {
  return wx.getStorageSync(NOTE_FAVORITES_KEY) || [];
}

/**
 * 添加备注收藏（相同文本+分类+类型不重复添加）
 * @param {{ text: string, category: string, type: string }} fav
 * @returns {{ success: boolean, isDuplicate: boolean, favorites: Array }}
 */
function addNoteFavorite(fav) {
  const text = (fav.text || '').trim();
  if (!text) return { success: false, isDuplicate: false, favorites: getNoteFavorites() };

  const favorites = getNoteFavorites();
  // 同文本+分类+类型视为重复
  const exists = favorites.some(f => f.text === text && f.category === fav.category && f.type === fav.type);
  if (exists) return { success: false, isDuplicate: true, favorites };

  if (favorites.length >= NOTE_FAVORITES_MAX) {
    favorites.pop(); // 移除最旧的
  }
  const newFav = {
    id: Date.now(),
    text,
    category: fav.category || '',
    type: fav.type || 'expense',
    createdAt: Date.now()
  };
  favorites.unshift(newFav);
  wx.setStorageSync(NOTE_FAVORITES_KEY, favorites);
  return { success: true, isDuplicate: false, favorites };
}

/**
 * 删除备注收藏
 * @param {number} id
 * @returns {{ success: boolean, favorites: Array }}
 */
function removeNoteFavorite(id) {
  const favorites = getNoteFavorites();
  const filtered = favorites.filter(f => f.id !== id);
  wx.setStorageSync(NOTE_FAVORITES_KEY, filtered);
  return { success: favorites.length !== filtered.length, favorites: filtered };
}

/**
 * 获取当前分类+类型的备注收藏（快速填入用）
 * @param {string} category
 * @param {string} type
 * @returns {Array<{ id: number, text: string }>}
 */
function getNoteFavoritesForCategory(category, type) {
  const all = getNoteFavorites();
  // 优先返回匹配分类的，其次返回无分类限制的（category 为空串表示通用）
  const catMatch = all.filter(f => f.category === category && f.type === type);
  const generic = all.filter(f => f.category === '' && f.type === type);
  const combined = [...catMatch, ...generic];
  // 去重 text
  const seen = new Set();
  return combined.filter(f => {
    if (seen.has(f.text)) return false;
    seen.add(f.text);
    return true;
  });
}

// ─── 分享卡片数据 ──────────────────────────────────────────────────────────────
/**
 * 生成月度账单分享卡片所需数据
 * @param {string} yearMonth - 'YYYY-MM'
 * @returns {{ monthLabel, totalExpense, totalIncome, topCategories, recordCount, tipText }}
 */
function getShareCardData(yearMonth) {
  const CARD_EMOJI = {
    '餐饮': '🍜', '交通': '🚌', '购物': '🛍️', '娱乐': '🎮',
    '住房': '🏠', '医疗': '💊', '教育': '📚', '运动': '🏃',
    '旅行': '✈️', '宠物': '🐾', '日用': '🧴',
    '工资': '💼', '奖金': '🎁', '副业': '💡', '理财': '📈', '红包': '🧧',
    '其他': '📦'
  };

  const summary = getMonthSummary(yearMonth);
  const records = summary.records || [];
  const [y, m] = yearMonth.split('-');
  const monthLabel = `${y}年${parseInt(m)}月`;

  let totalExpense = 0, totalIncome = 0;
  const catMap = {};
  records.forEach(r => {
    const amt = Number(r.amount) || 0;
    if (r.type === 'expense') {
      totalExpense += amt;
      const cat = r.category || '其他';
      catMap[cat] = (catMap[cat] || 0) + amt;
    } else {
      totalIncome += amt;
    }
  });

  const topCategories = Object.keys(catMap)
    .map(cat => ({
      name: cat,
      emoji: CARD_EMOJI[cat] || '📦',
      amount: parseFloat(catMap[cat].toFixed(2)),
      percent: totalExpense > 0 ? Math.round(catMap[cat] / totalExpense * 100) : 0
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  // 底部提示文案
  const net = totalIncome - totalExpense;
  let tipText = '';
  if (records.length === 0) {
    tipText = '还没有账单记录，快去记一笔吧 🐾';
  } else if (net > 0) {
    tipText = `本月结余 ¥${net.toFixed(2)}，继续保持 ✨`;
  } else if (net < 0) {
    tipText = `本月超支 ¥${Math.abs(net).toFixed(2)}，下月加油 💪`;
  } else {
    tipText = '收支刚好平衡，财务很稳健 🌟';
  }

  return {
    monthLabel,
    totalExpense: parseFloat(totalExpense.toFixed(2)),
    totalIncome: parseFloat(totalIncome.toFixed(2)),
    topCategories,
    recordCount: records.length,
    tipText
  };
}

/**
 * 统计指定月份（或多月）每周各天的消费分布
 * @param {string} startYM - 开始月份 'YYYY-MM'（含）
 * @param {string} endYM   - 结束月份 'YYYY-MM'（含）
 * @param {string} type    - 'expense' | 'income' | 'all'
 * @returns {{
 *   weekdays: Array<{ label, dayIndex, amount, count, avgAmount, percent, barWidth }>,
 *   totalAmount: number,
 *   totalCount: number,
 *   peakDay: string,
 *   lightDay: string,
 *   weekendRatio: number,
 *   tip: string,
 *   tipEmoji: string
 * }}
 */
function getWeekdayStats(startYM, endYM, type) {
  const LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  // JS Date.getDay()：0=周日,1=周一,...,6=周六 → 映射到 0=周一,...,6=周日
  const jsToIndex = [6, 0, 1, 2, 3, 4, 5];

  const amounts = new Array(7).fill(0);
  const counts  = new Array(7).fill(0);

  const allRecords = getRecords();
  allRecords.forEach(r => {
    if (!r.date) return;
    const ym = r.date.substring(0, 7);
    if (ym < startYM || ym > endYM) return;
    if (type !== 'all' && r.type !== type) return;

    const [y, m, d] = r.date.split('-').map(Number);
    const jsDay = new Date(y, m - 1, d).getDay();
    const idx = jsToIndex[jsDay];
    amounts[idx] += Number(r.amount) || 0;
    counts[idx]++;
  });

  const totalAmount = parseFloat(amounts.reduce((s, v) => s + v, 0).toFixed(2));
  const totalCount  = counts.reduce((s, v) => s + v, 0);
  const maxAmount   = Math.max.apply(null, amounts.concat([1]));

  const weekdays = LABELS.map((label, i) => ({
    label,
    dayIndex: i,
    amount:    parseFloat(amounts[i].toFixed(2)),
    count:     counts[i],
    avgAmount: counts[i] > 0 ? parseFloat((amounts[i] / counts[i]).toFixed(2)) : 0,
    percent:   totalAmount > 0 ? parseFloat((amounts[i] / totalAmount * 100).toFixed(1)) : 0,
    barWidth:  Math.round((amounts[i] / maxAmount) * 100)
  }));

  // 高峰日 / 最省日
  var peakIdx = 0, lightIdx = -1;
  weekdays.forEach(function(d, i) {
    if (d.amount > weekdays[peakIdx].amount) peakIdx = i;
    if (d.amount > 0) {
      if (lightIdx === -1 || d.amount < weekdays[lightIdx].amount) lightIdx = i;
    }
  });

  const peakDay  = weekdays[peakIdx].amount > 0 ? weekdays[peakIdx].label : '—';
  const lightDay = lightIdx >= 0 ? weekdays[lightIdx].label : '—';

  // 周末（周六=5，周日=6）占比
  const weekendAmt   = amounts[5] + amounts[6];
  const weekendRatio = totalAmount > 0
    ? parseFloat((weekendAmt / totalAmount * 100).toFixed(1))
    : 0;

  // 洞察文案
  var tip = '', tipEmoji = '';
  if (totalCount === 0) {
    tip = '这段时间还没有记录，快去记账吧～'; tipEmoji = '🌸';
  } else if (weekendRatio >= 50) {
    tip = '周末消费占 ' + weekendRatio + '%，是个爱享受周末的人 🎉'; tipEmoji = '🎉';
  } else if (weekendRatio <= 20 && weekendAmt > 0) {
    tip = '工作日支出远多于周末，上班开销不小哦'; tipEmoji = '💼';
  } else if (peakDay !== '—') {
    tip = peakDay + '是消费高峰，占总支出 ' + weekdays[peakIdx].percent + '%'; tipEmoji = '📊';
  } else {
    tip = '消费分布较均匀，节奏很稳定 ✨'; tipEmoji = '✨';
  }

  return { weekdays: weekdays, totalAmount: totalAmount, totalCount: totalCount, peakDay: peakDay, lightDay: lightDay, weekendRatio: weekendRatio, tip: tip, tipEmoji: tipEmoji };
}

/**
 * 消费时段分析
 * 将一天分为 6 个时段，统计各时段的消费金额/笔数
 * 时段划分：深夜(0-5) 早晨(6-8) 上午(9-11) 中午(12-13) 下午(14-17) 晚上(18-23)
 * 时间来源：record.id（Date.now() 时间戳）
 *
 * @param {string} startYM - 开始月份 'YYYY-MM'
 * @param {string} endYM   - 结束月份 'YYYY-MM'
 * @param {string} type    - 'expense' | 'income' | 'all'
 * @returns {Object}
 */
function getHourlyStats(startYM, endYM, type) {
  var SLOTS = [
    { key: 'midnight', label: '深夜', range: '0-5点',  emoji: '🌙', start: 0,  end: 5  },
    { key: 'morning',  label: '早晨', range: '6-8点',  emoji: '🌅', start: 6,  end: 8  },
    { key: 'forenoon', label: '上午', range: '9-11点', emoji: '☀️', start: 9,  end: 11 },
    { key: 'noon',     label: '中午', range: '12-13点',emoji: '🌤️', start: 12, end: 13 },
    { key: 'afternoon',label: '下午', range: '14-17点',emoji: '🌈', start: 14, end: 17 },
    { key: 'evening',  label: '晚上', range: '18-23点',emoji: '🌆', start: 18, end: 23 }
  ];

  var amounts = [0, 0, 0, 0, 0, 0];
  var counts  = [0, 0, 0, 0, 0, 0];

  var allRecords = getRecords();
  allRecords.forEach(function(r) {
    if (!r.date || !r.id) return;
    var ym = r.date.substring(0, 7);
    if (ym < startYM || ym > endYM) return;
    if (type !== 'all' && r.type !== type) return;

    // 从 id（时间戳毫秒）提取本地小时
    var hour = new Date(r.id).getHours();
    var slotIdx = -1;
    for (var i = 0; i < SLOTS.length; i++) {
      if (hour >= SLOTS[i].start && hour <= SLOTS[i].end) {
        slotIdx = i;
        break;
      }
    }
    if (slotIdx < 0) return;
    amounts[slotIdx] += Number(r.amount) || 0;
    counts[slotIdx]++;
  });

  var totalAmount = parseFloat(amounts.reduce(function(s, v) { return s + v; }, 0).toFixed(2));
  var totalCount  = counts.reduce(function(s, v) { return s + v; }, 0);
  var maxAmount   = Math.max.apply(null, amounts.concat([1]));

  var slots = SLOTS.map(function(s, i) {
    return {
      key:       s.key,
      label:     s.label,
      range:     s.range,
      emoji:     s.emoji,
      amount:    parseFloat(amounts[i].toFixed(2)),
      count:     counts[i],
      avgAmount: counts[i] > 0 ? parseFloat((amounts[i] / counts[i]).toFixed(2)) : 0,
      percent:   totalAmount > 0 ? parseFloat((amounts[i] / totalAmount * 100).toFixed(1)) : 0,
      barWidth:  Math.round((amounts[i] / maxAmount) * 100)
    };
  });

  // 高峰时段
  var peakIdx = 0;
  slots.forEach(function(s, i) {
    if (s.amount > slots[peakIdx].amount) peakIdx = i;
  });
  var peakSlot = slots[peakIdx].amount > 0 ? slots[peakIdx] : null;

  // 白天(6-17) vs 夜间(18-23 + 0-5) 占比
  var dayAmount  = amounts[1] + amounts[2] + amounts[3] + amounts[4]; // 早晨+上午+中午+下午
  var nightAmount = amounts[0] + amounts[5]; // 深夜+晚上
  var dayRatio   = totalAmount > 0 ? parseFloat((dayAmount / totalAmount * 100).toFixed(1)) : 0;
  var nightRatio = totalAmount > 0 ? parseFloat((nightAmount / totalAmount * 100).toFixed(1)) : 0;

  // 洞察文案
  var tip = '', tipEmoji = '';
  if (totalCount === 0) {
    tip = '这段时间还没有记录，快去记账吧～'; tipEmoji = '🌸';
  } else if (peakSlot && peakSlot.key === 'noon') {
    tip = '午饭时段消费最集中，占总支出 ' + peakSlot.percent + '%，午餐花销不小哦'; tipEmoji = '🍱';
  } else if (peakSlot && peakSlot.key === 'evening') {
    tip = '晚上是消费高峰，占总支出 ' + peakSlot.percent + '%，夜间消费需留意'; tipEmoji = '🌆';
  } else if (peakSlot && peakSlot.key === 'midnight') {
    tip = '深夜消费不少，占 ' + peakSlot.percent + '%，夜猫子的钱包要注意了 🦉'; tipEmoji = '🌙';
  } else if (peakSlot && peakSlot.key === 'afternoon') {
    tip = '下午消费最多，占 ' + peakSlot.percent + '%，小心下午茶和购物冲动 ☕'; tipEmoji = '🌈';
  } else if (peakSlot && peakSlot.key === 'forenoon') {
    tip = '上午消费最集中，占 ' + peakSlot.percent + '%，通勤和早间开销较大'; tipEmoji = '☀️';
  } else if (nightRatio >= 50) {
    tip = '夜间消费（含晚上+深夜）占 ' + nightRatio + '%，是个夜型消费者'; tipEmoji = '🌃';
  } else if (dayRatio >= 70) {
    tip = '白天消费规律，日间消费占 ' + dayRatio + '%，作息很健康'; tipEmoji = '🌞';
  } else if (peakSlot) {
    tip = peakSlot.label + '（' + peakSlot.range + '）是消费高峰，占总支出 ' + peakSlot.percent + '%'; tipEmoji = peakSlot.emoji;
  } else {
    tip = '消费时段分布均匀，很有节制 ✨'; tipEmoji = '✨';
  }

  return {
    slots:       slots,
    totalAmount: totalAmount,
    totalCount:  totalCount,
    peakSlot:    peakSlot,
    dayRatio:    dayRatio,
    nightRatio:  nightRatio,
    tip:         tip,
    tipEmoji:    tipEmoji
  };
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
  getTopAmounts,
  getSearchHistory,
  saveSearchHistory,
  deleteSearchHistory,
  clearSearchHistory,
  getCategoryBudget,
  getCategoryBudgets,
  setCategoryBudget,
  getFinanceHealthScore,
  generateMonthReport,
  getSavingGoal,
  setSavingGoal,
  getSavingGoalProgress,
  getNoteAutoComplete,
  getTemplates,
  saveTemplate,
  deleteTemplate,
  getCategoryRanking,
  getRecurringBills,
  addRecurringBill,
  updateRecurringBill,
  deleteRecurringBill,
  getRecurringReminders,
  getCategoryHistory,
  getSpendingAlerts,
  getWeekCheckin,
  getDailySummaryCompare,
  getCategorySaveSummary,
  getNoteFavorites,
  addNoteFavorite,
  removeNoteFavorite,
  getNoteFavoritesForCategory,
  getShareCardData,
  getWeekdayStats,
  getWeekCompare,
  getHourlyStats
};
