// pages/index/index.js - 首页
const { getRecords, getMonthSummary, groupByDate, formatDate, getMonthBudget, setMonthBudget, getStreakDays, getTodaySummary, getMonthHeatmap, getRecentMonthsSummary, getWeekSummary } = require('../../utils/storage');

// 分类 emoji 映射（与 add 页保持一致）
const CATEGORY_EMOJI = {
  '餐饮': '🍜', '交通': '🚌', '购物': '🛍️', '娱乐': '🎮',
  '住房': '🏠', '医疗': '💊', '教育': '📚', '运动': '🏃',
  '旅行': '✈️', '宠物': '🐾', '日用': '🧴',
  '工资': '💼', '奖金': '🎁', '副业': '💡', '理财': '📈', '红包': '🧧',
  '其他': '📦'
};

Page({
  data: {
    currentMonth: '',        // 当前月份显示，如 '2026年04月'
    yearMonth: '',           // 'YYYY-MM'，用于预算读写
    monthIncome: 0,
    monthExpense: 0,
    monthNet: 0,
    recentGroups: [],        // 最近账单（按日期分组，最近8条，跨月全局）
    isEmpty: false,
    // 今日速览
    todayExpense: 0,
    todayIncome: 0,
    todayCount: 0,
    hasTodayRecords: false,
    // 近6个月净储蓄折线图
    trendMonths: [],         // [{ ym, label, income, expense, net }]
    trendInsight: '',        // 趋势洞察文案
    trendInsightEmoji: '',
    // 预算相关
    budget: 0,               // 当月预算（0 = 未设置）
    budgetPercent: 0,        // 已用百分比（0-100，超出时为 100）
    budgetOver: false,       // 是否超预算
    budgetRemain: 0,         // 剩余预算
    hasBudget: false,        // 是否设置了预算
    // 打卡连击
    streak: 0,
    todayDone: false,
    longestStreak: 0,
    streakTitle: '',         // 连击称号
    // 本月消费热力日历
    heatmap: null,
    // 本周账单周报
    weekSummary: null
  },

  onLoad() {
    this.initTabBar();
  },

  onShow() {
    this.initTabBar();
    this.loadData();
  },

  initTabBar() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  loadData() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const yearMonth = `${year}-${month < 10 ? '0' + month : month}`;
    const monthLabel = `${year}年${month < 10 ? '0' + month : month}月`;

    const summary = getMonthSummary(yearMonth);

    // 最近8条账单（全局跨月），按日期分组
    const allRecentRecords = getRecords()
      .sort((a, b) => b.id - a.id)
      .slice(0, 8);

    const recentGroups = groupByDate(allRecentRecords).map(group => ({
      ...group,
      dateLabel: formatDate(group.date),
      records: group.records.map(r => ({
        ...r,
        emoji: CATEGORY_EMOJI[r.category] || '📦',
        amountDisplay: r.type === 'income' ? `+${r.amount}` : `-${r.amount}`
      }))
    }));

    // 预算计算
    const budget = getMonthBudget(yearMonth);
    const hasBudget = budget > 0;
    let budgetPercent = 0;
    let budgetOver = false;
    let budgetRemain = 0;
    if (hasBudget) {
      budgetPercent = Math.min(100, parseFloat((summary.expense / budget * 100).toFixed(1)));
      budgetOver = summary.expense > budget;
      budgetRemain = parseFloat((budget - summary.expense).toFixed(2));
    }

    // 打卡连击
    const { streak, todayDone, longestStreak } = getStreakDays();
    const streakTitle = this._getStreakTitle(streak);

    // 今日速览
    const { todayExpense, todayIncome, todayCount } = getTodaySummary();

    // 本月消费热力日历
    const heatmap = getMonthHeatmap(yearMonth);

    // 本周账单周报（加入柱状图高度百分比）
    const weekSummaryRaw = getWeekSummary();
    const maxBarAmount = weekSummaryRaw.maxAmount || 1;
    const weekSummary = {
      ...weekSummaryRaw,
      days: weekSummaryRaw.days.map(d => ({
        ...d,
        barHeight: d.isFuture ? 0 : Math.round((d.expense / maxBarAmount) * 100)
      }))
    };

    // 近6个月净储蓄折线数据
    const trendMonths = getRecentMonthsSummary(6);
    const { trendInsight, trendInsightEmoji } = this._buildTrendInsight(trendMonths);

    this.setData({
      currentMonth: monthLabel,
      yearMonth,
      monthIncome: summary.income,
      monthExpense: summary.expense,
      monthNet: summary.net,
      recentGroups,
      isEmpty: allRecentRecords.length === 0,
      budget,
      hasBudget,
      budgetPercent,
      budgetOver,
      budgetRemain,
      streak,
      todayDone,
      longestStreak,
      streakTitle,
      todayExpense,
      todayIncome,
      todayCount,
      hasTodayRecords: todayCount > 0,
      heatmap,
      trendMonths,
      trendInsight,
      trendInsightEmoji,
      weekSummary
    });

    // 绘制折线图（数据加载后再绘制）
    this._drawTrendLine(trendMonths);
  },

  // ─── 近6个月净储蓄折线图 ──────────────────────────────

  /**
   * 生成趋势洞察文案
   */
  _buildTrendInsight(trendMonths) {
    const hasData = trendMonths.some(m => m.income > 0 || m.expense > 0);
    if (!hasData) {
      return { trendInsight: '记录几个月后即可查看趋势～', trendInsightEmoji: '🌱' };
    }

    const nets = trendMonths.map(m => m.net);
    const positiveMonths = nets.filter(n => n > 0).length;
    const last = nets[nets.length - 1];
    const prev = nets[nets.length - 2];

    // 判断最近两个月是上升/下降趋势
    let trendInsight = '';
    let trendInsightEmoji = '📊';

    if (prev === 0 && last === 0) {
      return { trendInsight: '快来记录收支，解锁趋势分析～', trendInsightEmoji: '✨' };
    }

    if (last > prev) {
      trendInsightEmoji = '📈';
      trendInsight = `本月较上月结余多 ¥${Math.abs(last - prev).toFixed(2)}，走势向好！`;
    } else if (last < prev) {
      trendInsightEmoji = '📉';
      trendInsight = `本月较上月结余少 ¥${Math.abs(last - prev).toFixed(2)}，注意控制支出～`;
    } else {
      trendInsightEmoji = '📊';
      trendInsight = '本月结余与上月持平，保持稳定～';
    }

    if (positiveMonths >= 5) {
      trendInsightEmoji = '🎉';
      trendInsight = `近6个月中有 ${positiveMonths} 个月有结余，财务状况良好！`;
    }

    return { trendInsight, trendInsightEmoji };
  },

  /**
   * 用 Canvas 绘制近6个月净储蓄折线图
   */
  _drawTrendLine(trendMonths) {
    if (!trendMonths || trendMonths.length === 0) return;
    // 延迟一帧确保 canvas 已渲染
    wx.nextTick(() => {
      const query = wx.createSelectorQuery();
      query.select('#trendLineCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            this._drawTrendLineLegacy(trendMonths);
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
          this._renderTrendLine(ctx, w, h, trendMonths);
        });
    });
  },

  _drawTrendLineLegacy(trendMonths) {
    const ctx = wx.createCanvasContext('trendLineCanvasLegacy', this);
    this._renderTrendLineLegacy(ctx, 340, 120, trendMonths);
    ctx.draw();
  },

  _renderTrendLine(ctx, w, h, trendMonths) {
    ctx.clearRect(0, 0, w, h);

    const padLeft = 12;
    const padRight = 12;
    const padTop = 16;
    const padBottom = 28;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;
    const n = trendMonths.length;
    if (n < 2) return;

    const nets = trendMonths.map(m => m.net);
    const maxAbs = Math.max(...nets.map(v => Math.abs(v)), 1);
    // 以0为中线：净>0在上，净<0在下
    const zeroY = padTop + chartH / 2;
    const toY = (net) => zeroY - (net / maxAbs) * (chartH / 2) * 0.85;

    const xStep = chartW / (n - 1);
    const toX = (i) => padLeft + i * xStep;

    // 零线
    ctx.strokeStyle = '#E0EFF5';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, zeroY);
    ctx.lineTo(padLeft + chartW, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // 渐变填充区域
    const firstY = toY(nets[0]);
    const lastX = toX(n - 1);
    const grad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
    grad.addColorStop(0, 'rgba(79, 184, 212, 0.18)');
    grad.addColorStop(0.5, 'rgba(79, 184, 212, 0.06)');
    grad.addColorStop(1, 'rgba(255, 139, 171, 0.10)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(toX(0), zeroY);
    for (let i = 0; i < n; i++) {
      ctx.lineTo(toX(i), toY(nets[i]));
    }
    ctx.lineTo(lastX, zeroY);
    ctx.closePath();
    ctx.fill();

    // 折线
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // 根据最后一个月净值决定线条颜色
    ctx.strokeStyle = nets[n - 1] >= 0 ? '#4FB8D4' : '#FF8BAB';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = toX(i);
      const y = toY(nets[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 数据点
    for (let i = 0; i < n; i++) {
      const x = toX(i);
      const y = toY(nets[i]);
      const isLast = i === n - 1;
      const isPositive = nets[i] >= 0;

      // 点颜色
      ctx.fillStyle = isPositive ? '#4FB8D4' : '#FF8BAB';
      ctx.beginPath();
      ctx.arc(x, y, isLast ? 5 : 3.5, 0, 2 * Math.PI);
      ctx.fill();

      // 最后一个点加白色内圆
      if (isLast) {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // X 轴月份标签
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i < n; i++) {
      const x = toX(i);
      ctx.fillStyle = i === n - 1 ? '#4FB8D4' : '#9BAAB8';
      ctx.fillText(trendMonths[i].label, x, padTop + chartH + 6);
    }
  },

  _renderTrendLineLegacy(ctx, w, h, trendMonths) {
    const padLeft = 10;
    const padRight = 10;
    const padTop = 12;
    const padBottom = 24;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;
    const n = trendMonths.length;
    if (n < 2) return;

    const nets = trendMonths.map(m => m.net);
    const maxAbs = Math.max(...nets.map(v => Math.abs(v)), 1);
    const zeroY = padTop + chartH / 2;
    const toY = (net) => zeroY - (net / maxAbs) * (chartH / 2) * 0.82;
    const xStep = chartW / (n - 1);
    const toX = (i) => padLeft + i * xStep;

    // 零线
    ctx.setStrokeStyle('#E0EFF5');
    ctx.setLineWidth(1);
    ctx.beginPath();
    ctx.moveTo(padLeft, zeroY);
    ctx.lineTo(padLeft + chartW, zeroY);
    ctx.stroke();

    // 折线
    ctx.setStrokeStyle('#4FB8D4');
    ctx.setLineWidth(2);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = toX(i);
      const y = toY(nets[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 数据点
    for (let i = 0; i < n; i++) {
      const x = toX(i);
      const y = toY(nets[i]);
      ctx.setFillStyle(nets[i] >= 0 ? '#4FB8D4' : '#FF8BAB');
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    }

    // 月份标签
    ctx.setFontSize(9);
    ctx.setTextAlign('center');
    for (let i = 0; i < n; i++) {
      ctx.setFillStyle(i === n - 1 ? '#4FB8D4' : '#9BAAB8');
      ctx.fillText(trendMonths[i].label, toX(i), padTop + chartH + 6);
    }
  },

  // 连击称号
  _getStreakTitle(streak) {
    if (streak >= 365) return '年度账本达人 🏆';
    if (streak >= 100) return '记账百日功 💎';
    if (streak >= 30)  return '月度坚持王 🌟';
    if (streak >= 14)  return '两周小能手 🎖️';
    if (streak >= 7)   return '一周打卡达人 🎯';
    if (streak >= 3)   return '初显坚持 🌱';
    if (streak >= 1)   return '记账起步 🐾';
    return '快来记第一笔 ✨';
  },

  // 设置/修改预算
  onSetBudget() {
    const { yearMonth, budget, currentMonth } = this.data;
    wx.showModal({
      title: `设置 ${currentMonth} 预算`,
      editable: true,
      placeholderText: budget > 0 ? String(budget) : '请输入本月支出预算',
      content: '',
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) return;
        const input = res.content ? res.content.trim() : '';
        if (input === '') {
          // 清除预算
          setMonthBudget(yearMonth, 0);
          wx.showToast({ title: '预算已清除', icon: 'none' });
          this.loadData();
          return;
        }
        const amount = parseFloat(input);
        if (isNaN(amount) || amount <= 0) {
          wx.showToast({ title: '请输入有效金额 🐾', icon: 'none' });
          return;
        }
        setMonthBudget(yearMonth, amount);
        wx.showToast({ title: '预算已设置 ✨', icon: 'success', duration: 1200 });
        this.loadData();
      }
    });
  },

  goToAdd() {
    wx.switchTab({ url: '/pages/add/add' });
  },

  goToList() {
    wx.switchTab({ url: '/pages/list/list' });
  }
});
