// pages/stats/stats.js - 统计页（饼图 + 趋势柱状图 + 年度总览 + 分类预算）
const { getCategoryStats, getMonthSummary, getCategoryBudgets, setCategoryBudget } = require('../../utils/storage');

// 饼图颜色（Cinnamoroll 蓝色系列）
const COLORS = [
  '#4FB8D4', // 主蓝
  '#7EC8E3', // 浅蓝
  '#A8D8EA', // 更浅蓝
  '#9DC3E6', // 蓝灰
  '#B8E0FF', // 天蓝
  '#C9E8F0', // 淡蓝
  '#5BA3C9', // 深蓝
  '#88C8D8'  // 中蓝
];

// 分类 emoji 映射（与 add 页保持一致，覆盖全部 18 种分类）
const CATEGORY_EMOJI = {
  '餐饮': '🍜', '交通': '🚌', '购物': '🛍️', '娱乐': '🎮',
  '住房': '🏠', '医疗': '💊', '教育': '📚', '运动': '🏃',
  '旅行': '✈️', '宠物': '🐾', '日用': '🧴',
  '工资': '💼', '奖金': '🎁', '副业': '💡', '理财': '📈', '红包': '🧧',
  '其他': '📦'
};

// 近 N 个月的 YYYY-MM 列表（包含当月）
function getRecentMonths(n) {
  const result = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    result.push(`${y}-${m < 10 ? '0' + m : m}`);
  }
  return result;
}

Page({
  data: {
    // 当前浏览月份（YYYY-MM 格式，用于数据查询）
    yearMonth: '',
    // 展示用标签，如 "2026年04月"
    currentMonth: '',
    // 是否已到当月（不能再往后翻）
    isCurrentMonth: true,
    monthIncome: 0,
    monthExpense: 0,
    statsType: 'expense',     // 'expense' | 'income'
    categoryList: [],         // [{ category, amount, percent, color, emoji }]
    isEmpty: false,
    canvasSize: 600,          // canvas 边长（rpx 转 px 需乘 dpr）
    // 视图模式：'pie'（分类饼图）| 'trend'（趋势柱状图）| 'annual'（年度总览）| 'compare'（分类环比）
    viewMode: 'pie',
    // 趋势数据 [{ label, income, expense, net }]
    trendData: [],
    // 趋势图：当前高亮月份索引（-1 = 无）
    trendHighlight: -1,
    // 年度总览
    annualYear: 0,             // 当前查看的年份
    currentYear: 0,            // 当前真实年份（用于禁用"下一年"按钮）
    annualData: [],            // [{ label, income, expense, net }] x12
    annualSummary: null,       // { totalIncome, totalExpense, netSaving, bestExpenseMonth, bestIncomeMonth }
    // 智能分析卡片（仅饼图模式 / 支出视角）
    insightCard: null,         // { dailyAvg, predicted, vsLastMonth, vsLastMonthPct, isUp, tip, tipEmoji, showPrediction }
    // 分类环比数据
    compareData: null,         // { curExpense, prevExpense, expenseDiff, expenseDiffAbs, items, tip, tipEmoji }
    // 分类预算数据
    catBudgetItems: [],        // [{ category, emoji, spent, budget, hasBudget, percent, isOver, remain }]
    catBudgetTip: '',
    catBudgetTipEmoji: ''
  },

  onLoad() {
    this._initMonth();
    this._initAnnualYear();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    this.loadStats();
  },

  // 初始化为当前月份
  _initMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const m = now.getMonth() + 1;
    const yearMonth = `${year}-${m < 10 ? '0' + m : m}`;
    const currentMonth = `${year}年${m < 10 ? '0' + m : m}月`;
    this.setData({ yearMonth, currentMonth, isCurrentMonth: true });
  },

  // ─── 年度总览导航 ─────────────────────────────────────

  _initAnnualYear() {
    const currentYear = new Date().getFullYear();
    this.setData({ annualYear: currentYear, currentYear });
  },

  prevYear() {
    this.setData({ annualYear: this.data.annualYear - 1 }, () => this._loadAnnualData());
  },

  nextYear() {
    if (this.data.annualYear >= this.data.currentYear) return;
    this.setData({ annualYear: this.data.annualYear + 1 }, () => this._loadAnnualData());
  },

  _loadAnnualData() {
    const year = this.data.annualYear;
    const annualData = [];
    let totalIncome = 0;
    let totalExpense = 0;

    for (let m = 1; m <= 12; m++) {
      const ym = `${year}-${m < 10 ? '0' + m : m}`;
      const summary = getMonthSummary(ym);
      totalIncome += summary.income;
      totalExpense += summary.expense;
      annualData.push({
        ym,
        label: `${m}月`,
        income: summary.income,
        expense: summary.expense,
        net: summary.net
      });
    }

    totalIncome = parseFloat(totalIncome.toFixed(2));
    totalExpense = parseFloat(totalExpense.toFixed(2));
    const netSaving = parseFloat((totalIncome - totalExpense).toFixed(2));

    // 找最高消费月和最高收入月
    let bestExpenseMonth = '';
    let bestExpenseVal = 0;
    let bestIncomeMonth = '';
    let bestIncomeVal = 0;
    annualData.forEach(d => {
      if (d.expense > bestExpenseVal) { bestExpenseVal = d.expense; bestExpenseMonth = d.label; }
      if (d.income > bestIncomeVal) { bestIncomeVal = d.income; bestIncomeMonth = d.label; }
    });

    const annualSummary = {
      totalIncome,
      totalExpense,
      netSaving,
      bestExpenseMonth: bestExpenseVal > 0 ? bestExpenseMonth : '—',
      bestExpenseVal,
      bestIncomeMonth: bestIncomeVal > 0 ? bestIncomeMonth : '—',
      bestIncomeVal,
      isPositive: netSaving >= 0
    };

    this.setData({ annualData, annualSummary }, () => {
      this.drawAnnualChart(annualData);
    });
  },

  // 绘制年度柱状图（复用趋势图逻辑，12个月）
  drawAnnualChart(annualData) {
    const query = wx.createSelectorQuery();
    query.select('#annualCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          this.drawAnnualChartLegacy(annualData);
          return;
        }
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo
          ? wx.getWindowInfo().pixelRatio
          : (wx.getSystemInfoSync().pixelRatio || 2);
        const w = res[0].width;
        const h = res[0].height;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        this._renderAnnualChart(ctx, w, h, annualData);
      });
  },

  drawAnnualChartLegacy(annualData) {
    const ctx = wx.createCanvasContext('annualCanvasLegacy', this);
    this._renderAnnualChartLegacy(ctx, 340, 200, annualData);
    ctx.draw();
  },

  _renderAnnualChart(ctx, w, h, annualData) {
    ctx.clearRect(0, 0, w, h);

    const padLeft = 52;
    const padRight = 12;
    const padTop = 16;
    const padBottom = 36;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;
    const n = annualData.length; // 12

    const maxVal = annualData.reduce((max, d) => Math.max(max, d.income, d.expense), 1);
    const groupW = chartW / n;
    const barW = Math.max(Math.min(groupW * 0.32, 16), 6);
    const barGap = 2;

    // 背景网格线
    ctx.strokeStyle = '#EBF7FB';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padTop + chartH - (chartH * i / 4);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + chartW, y);
      ctx.stroke();
      const val = Math.round(maxVal * i / 4);
      ctx.fillStyle = '#B0C4D0';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val), padLeft - 5, y);
    }

    // Y 轴线
    ctx.strokeStyle = '#D8EEF5';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft, padTop + chartH);
    ctx.stroke();

    annualData.forEach((d, i) => {
      const groupX = padLeft + i * groupW + groupW / 2;

      if (d.expense > 0) {
        const expenseH = chartH * (d.expense / maxVal);
        const expenseX = groupX - barGap / 2 - barW;
        const expenseY = padTop + chartH - expenseH;
        const gradExp = ctx.createLinearGradient(0, expenseY, 0, padTop + chartH);
        gradExp.addColorStop(0, '#FF8BAB');
        gradExp.addColorStop(1, '#FFCCD8');
        ctx.fillStyle = gradExp;
        this._roundRect(ctx, expenseX, expenseY, barW, expenseH, Math.min(barW / 2, 4), true, false);
      }

      if (d.income > 0) {
        const incomeH = chartH * (d.income / maxVal);
        const incomeX = groupX + barGap / 2;
        const incomeY = padTop + chartH - incomeH;
        const gradInc = ctx.createLinearGradient(0, incomeY, 0, padTop + chartH);
        gradInc.addColorStop(0, '#4FB8D4');
        gradInc.addColorStop(1, '#A8E0EF');
        ctx.fillStyle = gradInc;
        this._roundRect(ctx, incomeX, incomeY, barW, incomeH, Math.min(barW / 2, 4), true, false);
      }

      // X 轴月份标签（每隔1个标注一次，12个月较密）
      ctx.fillStyle = '#7A9AAB';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(d.label, groupX, padTop + chartH + 6);
    });

    // 图例
    const legendY = padTop + 2;
    const legendX = padLeft + chartW - 110;
    ctx.fillStyle = '#FF8BAB';
    ctx.fillRect(legendX, legendY, 12, 8);
    ctx.fillStyle = '#7A9AAB';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('支出', legendX + 16, legendY + 4);
    ctx.fillStyle = '#4FB8D4';
    ctx.fillRect(legendX + 52, legendY, 12, 8);
    ctx.fillStyle = '#7A9AAB';
    ctx.fillText('收入', legendX + 68, legendY + 4);
  },

  _renderAnnualChartLegacy(ctx, w, h, annualData) {
    const padLeft = 48;
    const padRight = 10;
    const padTop = 12;
    const padBottom = 32;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;
    const n = annualData.length;
    const maxVal = annualData.reduce((max, d) => Math.max(max, d.income, d.expense), 1);
    const groupW = chartW / n;
    const barW = Math.max(Math.min(groupW * 0.3, 14), 5);
    const barGap = 2;

    for (let i = 0; i <= 4; i++) {
      const y = padTop + chartH - (chartH * i / 4);
      ctx.setStrokeStyle('#EBF7FB');
      ctx.setLineWidth(1);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + chartW, y);
      ctx.stroke();
      const val = Math.round(maxVal * i / 4);
      ctx.setFontSize(9);
      ctx.setFillStyle('#B0C4D0');
      ctx.setTextAlign('right');
      ctx.fillText(val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val), padLeft - 4, y + 4);
    }

    annualData.forEach((d, i) => {
      const groupX = padLeft + i * groupW + groupW / 2;
      if (d.expense > 0) {
        const expH = chartH * (d.expense / maxVal);
        ctx.setFillStyle('#FF8BAB');
        ctx.fillRect(groupX - barGap / 2 - barW, padTop + chartH - expH, barW, expH);
      }
      if (d.income > 0) {
        const incH = chartH * (d.income / maxVal);
        ctx.setFillStyle('#4FB8D4');
        ctx.fillRect(groupX + barGap / 2, padTop + chartH - incH, barW, incH);
      }
      ctx.setFontSize(9);
      ctx.setFillStyle('#7A9AAB');
      ctx.setTextAlign('center');
      ctx.fillText(d.label, groupX, padTop + chartH + 12);
    });
  },

  // 上一月
  prevMonth() {
    const [year, m] = this.data.yearMonth.split('-').map(Number);
    let newYear = year;
    let newMonth = m - 1;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    const yearMonth = `${newYear}-${newMonth < 10 ? '0' + newMonth : newMonth}`;
    const currentMonth = `${newYear}年${newMonth < 10 ? '0' + newMonth : newMonth}月`;

    // 与真实当月比较，确定是否还能往后翻
    const now = new Date();
    const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const isCurrentMonth = yearMonth === nowYM;

    this.setData({ yearMonth, currentMonth, isCurrentMonth }, () => this.loadStats());
  },

  // 下一月（不能超过当前月）
  nextMonth() {
    const now = new Date();
    const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (this.data.yearMonth >= nowYM) return; // 已是当月，不再往后翻

    const [year, m] = this.data.yearMonth.split('-').map(Number);
    let newYear = year;
    let newMonth = m + 1;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    const yearMonth = `${newYear}-${newMonth < 10 ? '0' + newMonth : newMonth}`;
    const currentMonth = `${newYear}年${newMonth < 10 ? '0' + newMonth : newMonth}月`;
    const isCurrentMonth = yearMonth === nowYM;

    this.setData({ yearMonth, currentMonth, isCurrentMonth }, () => this.loadStats());
  },

  loadStats() {
    const { yearMonth, statsType, viewMode } = this.data;

    const summary = getMonthSummary(yearMonth);

    // 获取各分类统计
    let catList = [];
    if (statsType === 'expense') {
      const expenseRecords = summary.records.filter(r => r.type === 'expense');
      catList = this._buildCatList(expenseRecords);
    } else {
      const incomeRecords = summary.records.filter(r => r.type === 'income');
      catList = this._buildCatList(incomeRecords);
    }

    const categoryList = catList.map((item, i) => ({
      ...item,
      color: COLORS[i % COLORS.length],
      emoji: CATEGORY_EMOJI[item.category] || '📦'
    }));

    // 计算智能分析卡片数据（仅支出模式）
    const insightCard = this._buildInsightCard(yearMonth, summary.expense);

    this.setData({
      monthIncome: summary.income,
      monthExpense: summary.expense,
      categoryList,
      isEmpty: categoryList.length === 0,
      insightCard
    }, () => {
      if (viewMode === 'pie' && !this.data.isEmpty) {
        this.drawPieChart(categoryList);
      } else if (viewMode === 'trend') {
        this._loadTrendData();
      } else if (viewMode === 'compare') {
        this._loadCompareData();
      } else if (viewMode === 'budget') {
        this._loadCatBudgetData();
      }
    });
  },

  // ─── 智能分析卡片 ────────────────────────────────────

  /**
   * 计算当月支出智能分析数据
   * @param {string} yearMonth - 'YYYY-MM'
   * @param {number} currentExpense - 当月已有支出
   * @returns {Object|null} insightCard 数据，或 null（无数据时）
   */
  _buildInsightCard(yearMonth, currentExpense) {
    if (!currentExpense || currentExpense <= 0) return null;

    const now = new Date();
    const [year, month] = yearMonth.split('-').map(Number);

    // 当月总天数
    const daysInMonth = new Date(year, month, 0).getDate();

    // 当月已过天数：如果是当月则用今天，否则用整月
    const isThisMonth = (year === now.getFullYear() && month === (now.getMonth() + 1));
    const daysPassed = isThisMonth ? now.getDate() : daysInMonth;

    if (daysPassed <= 0) return null;

    // 日均消费
    const dailyAvg = parseFloat((currentExpense / daysPassed).toFixed(2));

    // 月末预测（仅当月才显示预测）
    const predicted = isThisMonth
      ? parseFloat((dailyAvg * daysInMonth).toFixed(2))
      : currentExpense;
    const showPrediction = isThisMonth && daysPassed < daysInMonth;

    // 上月同期支出（同期 = 前 daysPassed 天）
    let prevMonthYM;
    if (month === 1) {
      prevMonthYM = `${year - 1}-12`;
    } else {
      prevMonthYM = `${year}-${(month - 1) < 10 ? '0' + (month - 1) : (month - 1)}`;
    }
    const prevSummary = getMonthSummary(prevMonthYM);
    const prevExpense = prevSummary.expense;

    // 上月同期（取上月前 daysPassed 天的支出，通过记录过滤计算）
    let prevSamePeriodExpense = 0;
    if (prevSummary.records && prevSummary.records.length > 0) {
      const cutoffDay = daysPassed;
      prevSummary.records.forEach(r => {
        if (r.type !== 'expense') return;
        const dayOfMonth = parseInt((r.date || '').split('-')[2] || '0');
        if (dayOfMonth > 0 && dayOfMonth <= cutoffDay) {
          prevSamePeriodExpense += Number(r.amount) || 0;
        }
      });
      prevSamePeriodExpense = parseFloat(prevSamePeriodExpense.toFixed(2));
    }

    // 与上月同期对比
    let vsLastMonthPct = null;
    let isUp = false;
    if (prevSamePeriodExpense > 0) {
      const diff = currentExpense - prevSamePeriodExpense;
      vsLastMonthPct = parseFloat(Math.abs(diff / prevSamePeriodExpense * 100).toFixed(1));
      isUp = diff > 0;
    }

    // 消费节奏提示文案
    const tip = this._getExpenseTip(dailyAvg, daysPassed, daysInMonth, isUp, vsLastMonthPct);

    return {
      dailyAvg,
      predicted,
      showPrediction,
      daysInMonth,
      daysPassed,
      vsLastMonthPct,
      isUp,
      tip: tip.text,
      tipEmoji: tip.emoji,
      prevSamePeriodExpense
    };
  },

  /**
   * 根据消费情况生成 Cinnamoroll 风格提示文案
   */
  _getExpenseTip(dailyAvg, daysPassed, daysInMonth, isUp, vsLastMonthPct) {
    // 月初（前5天）
    if (daysPassed <= 5) {
      return { emoji: '🌸', text: '月初阶段，继续保持记录习惯～' };
    }
    // 与上月相比大幅增加
    if (vsLastMonthPct !== null && isUp && vsLastMonthPct >= 30) {
      return { emoji: '⚠️', text: `比上月同期多了 ${vsLastMonthPct}%，要注意咯～` };
    }
    // 与上月相比大幅减少
    if (vsLastMonthPct !== null && !isUp && vsLastMonthPct >= 20) {
      return { emoji: '🎉', text: `比上月同期少了 ${vsLastMonthPct}%，省钱达人！` };
    }
    // 月末预测相关
    if (daysPassed >= daysInMonth * 0.6) {
      if (isUp) {
        return { emoji: '🐾', text: '月中已过，消费偏多，后半程注意收支～' };
      } else {
        return { emoji: '✨', text: '节奏不错，继续保持！' };
      }
    }
    // 无上月数据的默认提示
    return { emoji: '📊', text: `今日日均 ¥${dailyAvg}，记得按需消费哦～` };
  },

  _buildCatList(records) {
    const map = {};
    let total = 0;
    records.forEach(r => {
      const cat = r.category || '其他';
      map[cat] = (map[cat] || 0) + (Number(r.amount) || 0);
      total += Number(r.amount) || 0;
    });
    if (total === 0) return [];
    return Object.keys(map)
      .map(category => ({
        category,
        amount: parseFloat(map[category].toFixed(2)),
        percent: parseFloat((map[category] / total * 100).toFixed(1))
      }))
      .sort((a, b) => b.amount - a.amount);
  },

  // 切换支出/收入
  switchStatsType(e) {
    const statsType = e.currentTarget.dataset.type;
    this.setData({ statsType }, () => this.loadStats());
  },

  // ─── 分类跳转 ─────────────────────────────────────────

  /**
   * 点击饼图分类列表项 → 跳转账单列表页并自动筛选该分类
   * @param {object} e - 事件对象，dataset.category 为分类名称
   */
  onCategoryTap(e) {
    const { category } = e.currentTarget.dataset;
    if (!category) return;
    const { statsType } = this.data;
    // 通过 globalData 传递筛选参数（tabBar 页面切换不支持 URL 参数）
    const app = getApp();
    app.globalData.listFilter = { category, type: statsType };
    wx.vibrateShort({ type: 'light' }).catch(() => {});
    wx.switchTab({ url: '/pages/list/list' });
  },

  /**
   * 点击环比分类行 → 跳转账单列表页并自动筛选该分类（支出视角）
   * @param {object} e - 事件对象，dataset.category 为分类名称
   */
  onCompareCategoryTap(e) {
    const { category } = e.currentTarget.dataset;
    if (!category) return;
    const app = getApp();
    app.globalData.listFilter = { category, type: 'expense' };
    wx.vibrateShort({ type: 'light' }).catch(() => {});
    wx.switchTab({ url: '/pages/list/list' });
  },

  // ─── 视图模式切换 ─────────────────────────────────────

  switchViewMode(e) {
    const viewMode = e.currentTarget.dataset.mode;
    if (viewMode === this.data.viewMode) return;
    this.setData({ viewMode }, () => {
      if (viewMode === 'trend') {
        this._loadTrendData();
      } else if (viewMode === 'annual') {
        this._loadAnnualData();
      } else if (viewMode === 'compare') {
        this._loadCompareData();
      } else if (viewMode === 'budget') {
        this._loadCatBudgetData();
      } else {
        // 切回饼图，重新绘制
        if (!this.data.isEmpty) {
          this.drawPieChart(this.data.categoryList);
        }
      }
    });
  },

  // ─── 分类环比数据加载 ──────────────────────────────────

  /**
   * 加载当月 vs 上月的分类支出对比数据
   */
  _loadCompareData() {
    const { yearMonth } = this.data;
    const [year, month] = yearMonth.split('-').map(Number);

    // 上月 YYYY-MM
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth < 1) { prevMonth = 12; prevYear -= 1; }
    const prevYM = `${prevYear}-${prevMonth < 10 ? '0' + prevMonth : prevMonth}`;

    const curSummary = getMonthSummary(yearMonth);
    const prevSummary = getMonthSummary(prevYM);

    const curExpense = parseFloat(curSummary.expense.toFixed(2));
    const prevExpense = parseFloat(prevSummary.expense.toFixed(2));

    // 按分类汇总本月和上月支出
    const buildCatMap = (records) => {
      const map = {};
      records.filter(r => r.type === 'expense').forEach(r => {
        const cat = r.category || '其他';
        map[cat] = (map[cat] || 0) + (Number(r.amount) || 0);
      });
      return map;
    };

    const curMap = buildCatMap(curSummary.records);
    const prevMap = buildCatMap(prevSummary.records);

    // 合并所有出现过的分类（两个月的并集）
    const allCats = Array.from(new Set([...Object.keys(curMap), ...Object.keys(prevMap)]));

    // 计算双月最大值（用于 bar 宽度归一）
    const maxVal = allCats.reduce((m, cat) => Math.max(m, curMap[cat] || 0, prevMap[cat] || 0), 1);

    const items = allCats
      .map(cat => {
        const curAmount = parseFloat((curMap[cat] || 0).toFixed(2));
        const prevAmount = parseFloat((prevMap[cat] || 0).toFixed(2));
        const diff = parseFloat((curAmount - prevAmount).toFixed(2));
        let diffPct = 0;
        if (prevAmount > 0) {
          diffPct = parseFloat(Math.abs(diff / prevAmount * 100).toFixed(0));
        }
        return {
          category: cat,
          emoji: CATEGORY_EMOJI[cat] || '📦',
          curAmount,
          prevAmount,
          diff,
          diffPct,
          // bar 宽度百分比（相对于双月最大值，0-100）
          curPct: Math.round(curAmount / maxVal * 100),
          prevPct: Math.round(prevAmount / maxVal * 100)
        };
      })
      // 按本月金额降序排列，本月无支出的放后面
      .sort((a, b) => b.curAmount - a.curAmount || b.prevAmount - a.prevAmount);

    // 生成对比洞察文案
    const expenseDiff = parseFloat((curExpense - prevExpense).toFixed(2));
    const expenseDiffAbs = Math.abs(expenseDiff);
    const { tip, tipEmoji } = this._buildCompareTip(curExpense, prevExpense, items);

    const compareData = {
      curExpense,
      prevExpense,
      expenseDiff,
      expenseDiffAbs: parseFloat(expenseDiffAbs.toFixed(2)),
      items,
      tip,
      tipEmoji
    };

    this.setData({ compareData });
  },

  /**
   * 生成环比对比洞察文案（Cinnamoroll 风格）
   */
  _buildCompareTip(curExpense, prevExpense, items) {
    if (curExpense === 0 && prevExpense === 0) {
      return { tipEmoji: '🌱', tip: '两个月都没有支出记录，快来记账吧～' };
    }
    if (prevExpense === 0) {
      return { tipEmoji: '✨', tip: '上月没有记录，本月已开始记账，继续保持！' };
    }

    const diff = curExpense - prevExpense;
    const pct = parseFloat(Math.abs(diff / prevExpense * 100).toFixed(1));

    // 找出增幅最大的分类
    const risingCats = items
      .filter(i => i.diff > 0 && i.prevAmount > 0)
      .sort((a, b) => b.diff - a.diff);

    if (diff > 0 && pct >= 20) {
      const topRise = risingCats[0];
      if (topRise) {
        return { tipEmoji: '⚠️', tip: `支出较上月多 ${pct}%，「${topRise.category}」增幅最大，注意控制哦～` };
      }
      return { tipEmoji: '⚠️', tip: `支出较上月多了 ${pct}%，注意控制支出～` };
    }
    if (diff < 0 && pct >= 20) {
      return { tipEmoji: '🎉', tip: `支出较上月少了 ${pct}%，省钱好棒！继续保持 🐾` };
    }
    if (Math.abs(diff) < 1) {
      return { tipEmoji: '📊', tip: '本月支出与上月基本持平，消费节奏稳定～' };
    }
    if (diff > 0) {
      return { tipEmoji: '🐾', tip: `支出较上月增加 ¥${Math.abs(diff).toFixed(2)}，幅度在可控范围内～` };
    }
    return { tipEmoji: '✨', tip: `支出较上月减少 ¥${Math.abs(diff).toFixed(2)}，节约进行中！` };
  },

  // ─── 分类预算 ──────────────────────────────────────────

  /**
   * 加载当月各分类支出与预算对比数据
   */
  _loadCatBudgetData() {
    const { yearMonth } = this.data;
    const summary = getMonthSummary(yearMonth);
    const budgets = getCategoryBudgets(yearMonth);

    // 统计当月支出各分类金额
    const spentMap = {};
    summary.records.filter(r => r.type === 'expense').forEach(r => {
      const cat = r.category || '其他';
      spentMap[cat] = (spentMap[cat] || 0) + (Number(r.amount) || 0);
    });

    // 合并有支出记录 + 有预算设置的分类
    const allCats = Array.from(new Set([
      ...Object.keys(spentMap),
      ...Object.keys(budgets)
    ]));

    const items = allCats.map(cat => {
      const spent = parseFloat((spentMap[cat] || 0).toFixed(2));
      const budget = Number(budgets[cat]) || 0;
      const hasBudget = budget > 0;
      const percent = hasBudget ? Math.min(100, parseFloat((spent / budget * 100).toFixed(1))) : 0;
      const isOver = hasBudget && spent > budget;
      const remain = hasBudget ? parseFloat((budget - spent).toFixed(2)) : 0;
      return {
        category: cat,
        emoji: CATEGORY_EMOJI[cat] || '📦',
        spent,
        budget,
        hasBudget,
        percent,
        isOver,
        remain: Math.abs(remain)
      };
    }).sort((a, b) => {
      // 排序：超预算 > 已设预算 > 无预算；同组内按支出降序
      if (a.isOver !== b.isOver) return a.isOver ? -1 : 1;
      if (a.hasBudget !== b.hasBudget) return a.hasBudget ? -1 : 1;
      return b.spent - a.spent;
    });

    // 生成提示文案
    const overCount = items.filter(i => i.isOver).length;
    const hasBudgetCount = items.filter(i => i.hasBudget).length;
    let catBudgetTip = '';
    let catBudgetTipEmoji = '';
    if (items.length === 0) {
      catBudgetTip = '本月还没有支出记录，快去记账吧～';
      catBudgetTipEmoji = '🌸';
    } else if (hasBudgetCount === 0) {
      catBudgetTip = '点击分类右侧「设预算」为每个分类设置月度限额';
      catBudgetTipEmoji = '🎯';
    } else if (overCount > 0) {
      catBudgetTip = `有 ${overCount} 个分类超预算，注意控制支出哦～`;
      catBudgetTipEmoji = '⚠️';
    } else {
      catBudgetTip = '所有分类都在预算内，消费很自律！';
      catBudgetTipEmoji = '🎉';
    }

    this.setData({ catBudgetItems: items, catBudgetTip, catBudgetTipEmoji });
  },

  /**
   * 点击设置/修改某分类预算
   */
  onSetCatBudget(e) {
    const { category } = e.currentTarget.dataset;
    if (!category) return;
    const { yearMonth } = this.data;
    const budgets = getCategoryBudgets(yearMonth);
    const current = budgets[category] || 0;

    wx.showModal({
      title: `设置「${category}」预算`,
      placeholderText: current > 0 ? `当前: ¥${current}` : '输入月度限额（元）',
      editable: true,
      content: current > 0 ? String(current) : '',
      confirmText: '确定',
      cancelText: current > 0 ? '清除预算' : '取消',
      success: (res) => {
        if (res.confirm) {
          const val = parseFloat(res.content);
          if (isNaN(val) || val < 0) {
            wx.showToast({ title: '请输入有效金额', icon: 'none' });
            return;
          }
          setCategoryBudget(yearMonth, category, val);
          wx.vibrateShort({ type: 'light' }).catch(() => {});
          this._loadCatBudgetData();
        } else if (res.cancel && current > 0) {
          // 清除预算
          setCategoryBudget(yearMonth, category, 0);
          wx.vibrateShort({ type: 'light' }).catch(() => {});
          this._loadCatBudgetData();
        }
      }
    });
  },

  // ─── 趋势数据加载 ─────────────────────────────────────

  _loadTrendData() {
    const months = getRecentMonths(6);
    const trendData = months.map(ym => {
      const summary = getMonthSummary(ym);
      const parts = ym.split('-');
      return {
        ym,
        label: `${parseInt(parts[1])}月`,
        income: summary.income,
        expense: summary.expense,
        net: summary.net
      };
    });

    this.setData({ trendData }, () => {
      this.drawTrendChart(trendData);
    });
  },

  // ─── 趋势柱状图 ───────────────────────────────────────

  drawTrendChart(trendData) {
    const query = wx.createSelectorQuery();
    query.select('#trendCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          this.drawTrendChartLegacy(trendData);
          return;
        }
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo
          ? wx.getWindowInfo().pixelRatio
          : (wx.getSystemInfoSync().pixelRatio || 2);
        const w = res[0].width;
        const h = res[0].height;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        this._renderTrend(ctx, w, h, trendData);
      });
  },

  drawTrendChartLegacy(trendData) {
    const ctx = wx.createCanvasContext('trendCanvasLegacy', this);
    this._renderTrendLegacy(ctx, 340, 220, trendData);
    ctx.draw();
  },

  _renderTrend(ctx, w, h, trendData) {
    ctx.clearRect(0, 0, w, h);

    const padLeft = 52;
    const padRight = 16;
    const padTop = 20;
    const padBottom = 40;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    const n = trendData.length;
    if (n === 0) return;

    // 计算最大值（收入/支出/净值绝对值三者取大）
    const maxBarVal = trendData.reduce((max, d) => Math.max(max, d.income, d.expense), 1);
    const maxNetAbs = trendData.reduce((max, d) => Math.max(max, Math.abs(d.net)), 0);
    const maxVal = Math.max(maxBarVal, maxNetAbs, 1);

    // 净值折线的零基准线 Y 坐标（底部）
    const baseY = padTop + chartH;

    // 每组宽度
    const groupW = chartW / n;
    const barW = Math.min(groupW * 0.28, 22);
    const barGap = Math.min(groupW * 0.06, 6);

    // 背景网格线
    ctx.strokeStyle = '#EBF7FB';
    ctx.lineWidth = 1;
    const gridCount = 4;
    for (let i = 0; i <= gridCount; i++) {
      const y = padTop + chartH - (chartH * i / gridCount);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + chartW, y);
      ctx.stroke();

      // Y 轴标签
      const val = Math.round(maxVal * i / gridCount);
      ctx.fillStyle = '#B0C4D0';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val), padLeft - 6, y);
    }

    // Y 轴线
    ctx.strokeStyle = '#D8EEF5';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft, padTop + chartH);
    ctx.stroke();

    // ── 收集净值折线各点坐标 ──
    const netPoints = trendData.map((d, i) => {
      const groupX = padLeft + i * groupW + groupW / 2;
      const netY = baseY - chartH * (d.net / maxVal);
      return { x: groupX, y: netY, net: d.net, hasData: d.income > 0 || d.expense > 0 };
    });

    // ── 绘制柱子 ──
    trendData.forEach((d, i) => {
      const groupX = padLeft + i * groupW + groupW / 2;

      // 支出柱（左）
      const expenseH = chartH * (d.expense / maxVal);
      const expenseX = groupX - barGap / 2 - barW;
      const expenseY = padTop + chartH - expenseH;

      // 收入柱（右）
      const incomeH = chartH * (d.income / maxVal);
      const incomeX = groupX + barGap / 2;
      const incomeY = padTop + chartH - incomeH;

      // 绘制支出柱（粉色渐变）
      if (d.expense > 0) {
        const gradExp = ctx.createLinearGradient(0, expenseY, 0, padTop + chartH);
        gradExp.addColorStop(0, '#FF8BAB');
        gradExp.addColorStop(1, '#FFCCD8');
        ctx.fillStyle = gradExp;
        this._roundRect(ctx, expenseX, expenseY, barW, expenseH, Math.min(barW / 2, 5), true, false);
      }

      // 绘制收入柱（蓝色渐变）
      if (d.income > 0) {
        const gradInc = ctx.createLinearGradient(0, incomeY, 0, padTop + chartH);
        gradInc.addColorStop(0, '#4FB8D4');
        gradInc.addColorStop(1, '#A8E0EF');
        ctx.fillStyle = gradInc;
        this._roundRect(ctx, incomeX, incomeY, barW, incomeH, Math.min(barW / 2, 5), true, false);
      }

      // X 轴月份标签
      ctx.fillStyle = '#7A9AAB';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(d.label, groupX, padTop + chartH + 8);
    });

    // ── 绘制净值折线（叠加在柱子上层）──
    const validPoints = netPoints.filter(p => p.hasData);
    if (validPoints.length >= 2) {
      // 折线路径（虚线风格）
      ctx.save();
      ctx.setLineDash([5, 3]);
      ctx.strokeStyle = 'rgba(130, 90, 200, 0.65)';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let started = false;
      netPoints.forEach(p => {
        if (!p.hasData) { started = false; return; }
        const clampedY = Math.max(padTop + 4, Math.min(baseY, p.y));
        if (!started) { ctx.moveTo(p.x, clampedY); started = true; }
        else ctx.lineTo(p.x, clampedY);
      });
      ctx.stroke();
      ctx.restore();

      // 折线数据点（实心圆）
      netPoints.forEach(p => {
        if (!p.hasData) return;
        const clampedY = Math.max(padTop + 4, Math.min(baseY, p.y));
        const dotColor = p.net >= 0 ? '#7EC879' : '#FF8BAB';
        ctx.beginPath();
        ctx.arc(p.x, clampedY, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = dotColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // ── 图例（支出 / 收入 / 净结余）──
    const legendY = padTop + 2;
    const legendX = padLeft + chartW - 170;
    // 支出图例
    ctx.fillStyle = '#FF8BAB';
    ctx.fillRect(legendX, legendY, 14, 10);
    ctx.fillStyle = '#7A9AAB';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('支出', legendX + 18, legendY + 5);
    // 收入图例
    ctx.fillStyle = '#4FB8D4';
    ctx.fillRect(legendX + 52, legendY, 14, 10);
    ctx.fillStyle = '#7A9AAB';
    ctx.fillText('收入', legendX + 70, legendY + 5);
    // 净结余图例（虚线 + 圆点）
    ctx.save();
    ctx.setLineDash([4, 2]);
    ctx.strokeStyle = 'rgba(130, 90, 200, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(legendX + 104, legendY + 5);
    ctx.lineTo(legendX + 118, legendY + 5);
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(legendX + 111, legendY + 5, 3, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#7EC879';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#7A9AAB';
    ctx.fillText('结余', legendX + 122, legendY + 5);
  },

  // 绘制顶部圆角矩形
  _roundRect(ctx, x, y, w, h, r, fill) {
    if (h <= 0) return;
    if (h < r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
  },

  _renderTrendLegacy(ctx, w, h, trendData) {
    // 旧版 canvas API 降级实现（简化版，无渐变）
    const padLeft = 48;
    const padRight = 12;
    const padTop = 16;
    const padBottom = 36;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;
    const n = trendData.length;
    if (n === 0) return;

    const maxBarVal = trendData.reduce((max, d) => Math.max(max, d.income, d.expense), 1);
    const maxNetAbs = trendData.reduce((max, d) => Math.max(max, Math.abs(d.net)), 0);
    const maxVal = Math.max(maxBarVal, maxNetAbs, 1);
    const baseY = padTop + chartH;

    const groupW = chartW / n;
    const barW = Math.min(groupW * 0.28, 18);
    const barGap = 4;

    // 网格线
    for (let i = 0; i <= 4; i++) {
      const y = padTop + chartH - (chartH * i / 4);
      ctx.setStrokeStyle('#EBF7FB');
      ctx.setLineWidth(1);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + chartW, y);
      ctx.stroke();
      const val = Math.round(maxVal * i / 4);
      ctx.setFontSize(10);
      ctx.setFillStyle('#B0C4D0');
      ctx.setTextAlign('right');
      ctx.fillText(val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val), padLeft - 4, y + 4);
    }

    // 收集净值折线坐标
    const netPoints = trendData.map((d, i) => {
      const groupX = padLeft + i * groupW + groupW / 2;
      const netY = baseY - chartH * (d.net / maxVal);
      return { x: groupX, y: Math.max(padTop + 4, Math.min(baseY, netY)), hasData: d.income > 0 || d.expense > 0 };
    });

    // 绘制柱子
    trendData.forEach((d, i) => {
      const groupX = padLeft + i * groupW + groupW / 2;

      if (d.expense > 0) {
        const expH = chartH * (d.expense / maxVal);
        ctx.setFillStyle('#FF8BAB');
        ctx.fillRect(groupX - barGap / 2 - barW, padTop + chartH - expH, barW, expH);
      }

      if (d.income > 0) {
        const incH = chartH * (d.income / maxVal);
        ctx.setFillStyle('#4FB8D4');
        ctx.fillRect(groupX + barGap / 2, padTop + chartH - incH, barW, incH);
      }

      ctx.setFontSize(11);
      ctx.setFillStyle('#7A9AAB');
      ctx.setTextAlign('center');
      ctx.fillText(d.label, groupX, padTop + chartH + 14);
    });

    // 绘制净值折线（旧版 API，无虚线支持，用细实线代替）
    const validPoints = netPoints.filter(p => p.hasData);
    if (validPoints.length >= 2) {
      ctx.setStrokeStyle('rgba(130,90,200,0.7)');
      ctx.setLineWidth(2);
      ctx.beginPath();
      let started = false;
      netPoints.forEach(p => {
        if (!p.hasData) { started = false; return; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      // 数据点圆圈
      netPoints.forEach((p, i) => {
        if (!p.hasData) return;
        const net = trendData[i].net;
        ctx.setFillStyle(net >= 0 ? '#7EC879' : '#FF8BAB');
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
  },

  // ─── 饼图相关 ─────────────────────────────────────────

  // 绘制 Canvas 饼图
  drawPieChart(categoryList) {
    const query = wx.createSelectorQuery();
    query.select('#pieCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          // 降级使用旧 canvas API
          this.drawPieChartLegacy(categoryList);
          return;
        }
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : (wx.getSystemInfoSync().pixelRatio || 2);
        const w = res[0].width;
        const h = res[0].height;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
        this._renderPie(ctx, w, h, categoryList);
      });
  },

  drawPieChartLegacy(categoryList) {
    const ctx = wx.createCanvasContext('pieCanvasLegacy', this);
    const size = 300; // 逻辑像素
    this._renderPieLegacy(ctx, size, size, categoryList);
    ctx.draw();
  },

  _renderPie(ctx, w, h, categoryList) {
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) / 2 - 20;

    ctx.clearRect(0, 0, w, h);

    let startAngle = -Math.PI / 2;
    const total = categoryList.reduce((s, i) => s + i.amount, 0);

    categoryList.forEach((item, i) => {
      const sweep = (item.amount / total) * 2 * Math.PI;
      const endAngle = startAngle + sweep;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();

      // 扇区之间绘制白色分隔线
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.stroke();

      startAngle = endAngle;
    });

    // 中间挖空（甜甜圈效果）
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.48, 0, 2 * Math.PI);
    ctx.fillStyle = '#F0F8FF';
    ctx.fill();

    // 中心文字
    ctx.fillStyle = '#3D5A6E';
    ctx.font = `bold ${Math.floor(radius * 0.22)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐾', cx, cy - radius * 0.08);
    ctx.font = `${Math.floor(radius * 0.14)}px sans-serif`;
    ctx.fillStyle = '#9BAAB8';
    ctx.fillText(`${categoryList.length} 分类`, cx, cy + radius * 0.15);
  },

  _renderPieLegacy(ctx, w, h, categoryList) {
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) / 2 - 12;
    let startAngle = -Math.PI / 2;
    const total = categoryList.reduce((s, i) => s + i.amount, 0);

    categoryList.forEach((item, i) => {
      const sweep = (item.amount / total) * 2 * Math.PI;
      const endAngle = startAngle + sweep;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.setFillStyle(COLORS[i % COLORS.length]);
      ctx.fill();
      ctx.setStrokeStyle('#FFFFFF');
      ctx.setLineWidth(2);
      ctx.stroke();
      startAngle = endAngle;
    });

    // 中心圆（挖空）
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.45, 0, 2 * Math.PI);
    ctx.setFillStyle('#F0F8FF');
    ctx.fill();

    ctx.setFontSize(24);
    ctx.setFillStyle('#9BAAB8');
    ctx.setTextAlign('center');
    ctx.fillText('🐾', cx, cy + 8);
  }
});
