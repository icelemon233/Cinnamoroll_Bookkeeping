// pages/index/index.js - 首页
const { getRecords, getMonthSummary, groupByDate, formatDate, getMonthBudget, setMonthBudget, getStreakDays, getTodaySummary, getMonthHeatmap, getRecentMonthsSummary, getWeekSummary, getFinanceHealthScore, getSavingGoal, setSavingGoal, getSavingGoalProgress, getRecurringReminders, getRecurringBills, addRecurringBill, updateRecurringBill, deleteRecurringBill, getWeekCheckin } = require('../../utils/storage');

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
    weekCheckin: [],         // 本周打卡日历 [{label,dateStr,done,isToday,isFuture}]
    // 本月消费热力日历
    heatmap: null,
    // 本周账单周报
    weekSummary: null,
    // 财务健康评分
    healthScore: null,
    // 月度储蓄目标
    savingGoalProgress: null,  // null = 未设置目标
    // 本月支出构成（Top3 分类进度条）
    monthCategoryBreakdown: [],  // [{ category, emoji, amount, percent, barWidth }]
    showCategoryBreakdown: false,
    // 周期性固定账单提醒
    recurringReminders: [],      // [{ bill, daysUntil, isOverdue }]
    showRecurringCard: false,    // 有未完成固定账单时显示
    // 新增固定账单弹窗
    showAddRecurringModal: false,
    newBillName: '',
    newBillAmount: '',
    newBillCategory: '住房',
    newBillType: 'expense',
    newBillNote: '',
    newBillDay: '1',
    // 管理固定账单弹窗
    showManageRecurringModal: false,
    allRecurringBills: []
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

    // 本周打卡日历
    const weekCheckin = getWeekCheckin();

    // 今日速览
    const { todayExpense, todayIncome, todayCount } = getTodaySummary();

    // 本月消费热力日历
    const heatmap = getMonthHeatmap(yearMonth);

    // 财务健康评分
    const healthScore = getFinanceHealthScore(yearMonth);

    // 月度储蓄目标进度
    const savingGoalProgress = getSavingGoalProgress(yearMonth);

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

    // 本月支出构成 Top3
    const categoryBreakdown = this._buildCategoryBreakdown(summary);

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
      weekCheckin,
      todayExpense,
      todayIncome,
      todayCount,
      hasTodayRecords: todayCount > 0,
      heatmap,
      trendMonths,
      trendInsight,
      trendInsightEmoji,
      weekSummary,
      healthScore,
      savingGoalProgress,
      monthCategoryBreakdown: categoryBreakdown,
      showCategoryBreakdown: categoryBreakdown.length > 0
    });

    // 周期性固定账单提醒
    this._loadRecurringReminders(yearMonth);

    // 绘制折线图（数据加载后再绘制）
    this._drawTrendLine(trendMonths);
  },

  // ─── 本月支出构成 ─────────────────────────────────────

  /**
   * 计算本月支出 Top3 分类构成，带百分比和进度条宽度
   * @param {object} summary - getMonthSummary 返回值
   * @returns {Array} [{ category, emoji, amount, percent, barWidth }]
   */
  _buildCategoryBreakdown(summary) {
    const expenseRecords = summary.records.filter(r => r.type === 'expense');
    if (expenseRecords.length === 0) return [];

    // 按分类汇总
    const catMap = {};
    expenseRecords.forEach(r => {
      const cat = r.category || '其他';
      catMap[cat] = (catMap[cat] || 0) + (Number(r.amount) || 0);
    });

    const totalExpense = summary.expense;
    if (totalExpense <= 0) return [];

    // 排序取 Top3，计算百分比
    const sorted = Object.keys(catMap)
      .map(cat => ({
        category: cat,
        emoji: CATEGORY_EMOJI[cat] || '📦',
        amount: parseFloat(catMap[cat].toFixed(2)),
        percent: parseFloat((catMap[cat] / totalExpense * 100).toFixed(1))
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    // barWidth：相对于 Top1 的进度条宽度（Top1 固定 100%，其余按比例缩放）
    const maxAmount = sorted[0].amount;
    return sorted.map(item => ({
      ...item,
      barWidth: Math.round(item.amount / maxAmount * 100)
    }));
  },

  /**
   * 点击支出构成卡片 → 跳转统计页
   */
  onCategoryBreakdownTap() {
    wx.switchTab({ url: '/pages/stats/stats' });
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

  // 设置/修改月度储蓄目标
  onSetSavingGoal() {
    const { yearMonth, currentMonth, savingGoalProgress } = this.data;
    const current = savingGoalProgress ? savingGoalProgress.goal : 0;

    wx.showModal({
      title: `设置 ${currentMonth} 储蓄目标`,
      editable: true,
      placeholderText: current > 0 ? String(current) : '输入本月期望存多少钱',
      content: '',
      confirmText: '确定',
      cancelText: current > 0 ? '清除目标' : '取消',
      success: (res) => {
        if (res.confirm) {
          const input = (res.content || '').trim();
          if (input === '') {
            wx.showToast({ title: '请输入目标金额 🐾', icon: 'none' });
            return;
          }
          const amount = parseFloat(input);
          if (isNaN(amount) || amount <= 0) {
            wx.showToast({ title: '请输入有效金额 🐾', icon: 'none' });
            return;
          }
          setSavingGoal(yearMonth, amount);
          wx.showToast({ title: '储蓄目标已设置 ✨', icon: 'success', duration: 1200 });
          this.loadData();
        } else if (res.cancel && current > 0) {
          // 清除目标
          setSavingGoal(yearMonth, 0);
          wx.showToast({ title: '目标已清除', icon: 'none' });
          this.loadData();
        }
      }
    });
  },

  goToAdd() {
    wx.switchTab({ url: '/pages/add/add' });
  },

  goToList() {
    wx.switchTab({ url: '/pages/list/list' });
  },

  // ─── 周期性固定账单 ─────────────────────────────────

  /**
   * 加载本月固定账单提醒，附加显示标签
   */
  _loadRecurringReminders(yearMonth) {
    const reminders = getRecurringReminders(yearMonth);
    const decorated = reminders.map(item => {
      let statusLabel = '';
      let statusClass = '';
      if (item.bill.dayOfMonth) {
        if (item.isOverdue) {
          statusLabel = '已过期未记录';
          statusClass = 'overdue';
        } else if (item.daysUntil === 0) {
          statusLabel = '今天到期';
          statusClass = 'today';
        } else if (item.daysUntil !== null && item.daysUntil <= 3) {
          statusLabel = `${item.daysUntil}天后到期`;
          statusClass = 'soon';
        } else if (item.daysUntil !== null) {
          statusLabel = `${item.daysUntil}天后`;
          statusClass = 'normal';
        }
      }
      return {
        ...item,
        statusLabel,
        statusClass,
        emoji: CATEGORY_EMOJI[item.bill.category] || '📦'
      };
    });
    this.setData({
      recurringReminders: decorated,
      showRecurringCard: decorated.length > 0
    });
  },

  /**
   * 点击固定账单条目 → 一键记账
   */
  onRecurringBillTap(e) {
    const { id } = e.currentTarget.dataset;
    const { recurringReminders, yearMonth } = this.data;
    const item = recurringReminders.find(r => String(r.bill.id) === String(id));
    if (!item) return;

    const { bill } = item;
    wx.showModal({
      title: `记录「${bill.name}」`,
      content: `金额：¥${bill.amount}\n分类：${bill.category}\n\n按确认将自动记账并标记为已完成`,
      confirmText: '一键记账',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          const { saveRecord } = require('../../utils/storage');
          const now = new Date();
          const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          // note 中嵌入固定账单标记
          const note = bill.note
            ? `${bill.note} [recurring:${bill.id}]`
            : `${bill.name} [recurring:${bill.id}]`;
          saveRecord({
            type: bill.type,
            category: bill.category,
            amount: bill.amount,
            note,
            date: dateStr
          });
          wx.showToast({ title: '记账成功 ✨', icon: 'success', duration: 1200 });
          // 刷新提醒列表和页面数据
          this._loadRecurringReminders(yearMonth);
          this.loadData();
        }
      }
    });
  },

  /**
   * 长按固定账单卡片 → 管理弹窗
   */
  onRecurringCardLongPress() {
    wx.vibrateShort({ type: 'medium' }).catch(() => {});
    const bills = getRecurringBills();
    const decorated = bills.map(b => ({
      ...b,
      emoji: CATEGORY_EMOJI[b.category] || '📦',
      dayLabel: b.dayOfMonth ? `每月${b.dayOfMonth}日` : '不限定'
    }));
    this.setData({ showManageRecurringModal: true, allRecurringBills: decorated });
  },

  /**
   * 关闭管理弹窗
   */
  closeManageRecurring() {
    this.setData({ showManageRecurringModal: false });
  },

  /**
   * 切换固定账单开关
   */
  onToggleRecurringActive(e) {
    const { id } = e.currentTarget.dataset;
    const bills = getRecurringBills();
    const bill = bills.find(b => String(b.id) === String(id));
    if (!bill) return;
    updateRecurringBill(id, { isActive: !bill.isActive });
    const decorated = getRecurringBills().map(b => ({
      ...b,
      emoji: CATEGORY_EMOJI[b.category] || '📦',
      dayLabel: b.dayOfMonth ? `每月${b.dayOfMonth}日` : '不限定'
    }));
    this.setData({ allRecurringBills: decorated });
    this._loadRecurringReminders(this.data.yearMonth);
  },

  /**
   * 删除固定账单
   */
  onDeleteRecurringBill(e) {
    const { id, name } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除固定账单',
      content: `确认删除「${name}」？`,
      confirmText: '删除',
      confirmColor: '#FF8BAB',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          deleteRecurringBill(id);
          const bills = getRecurringBills();
          const decorated = bills.map(b => ({
            ...b,
            emoji: CATEGORY_EMOJI[b.category] || '📦',
            dayLabel: b.dayOfMonth ? `每月${b.dayOfMonth}日` : '不限定'
          }));
          this.setData({ allRecurringBills: decorated });
          this._loadRecurringReminders(this.data.yearMonth);
          wx.showToast({ title: '已删除', icon: 'success', duration: 800 });
        }
      }
    });
  },

  /**
   * 打开新增固定账单弹窗
   */
  onAddRecurringBill() {
    this.setData({
      showAddRecurringModal: true,
      showManageRecurringModal: false,
      newBillName: '',
      newBillAmount: '',
      newBillCategory: '住房',
      newBillType: 'expense',
      newBillNote: '',
      newBillDay: '1'
    });
  },

  /**
   * 新增固定账单输入事件
   */
  onNewBillInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const patch = {};
    patch[`newBill${field}`] = value;
    this.setData(patch);
  },

  onNewBillTypeChange(e) {
    this.setData({ newBillType: e.detail.value });
  },

  /**
   * 确认新增固定账单
   */
  onConfirmAddRecurring() {
    const { newBillName, newBillAmount, newBillCategory, newBillType, newBillNote, newBillDay } = this.data;
    if (!newBillName.trim()) {
      wx.showToast({ title: '请输入账单名称', icon: 'none' }); return;
    }
    const amount = parseFloat(newBillAmount);
    if (isNaN(amount) || amount <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' }); return;
    }
    const dayOfMonth = parseInt(newBillDay) || 0;
    addRecurringBill({
      name: newBillName.trim(),
      amount,
      category: newBillCategory,
      type: newBillType,
      note: newBillNote.trim(),
      dayOfMonth: Math.min(28, Math.max(0, dayOfMonth)),
      isActive: true
    });
    wx.showToast({ title: '已添加固定账单 ✨', icon: 'success', duration: 1200 });
    this.setData({ showAddRecurringModal: false });
    this._loadRecurringReminders(this.data.yearMonth);
  },

  /**
   * 关闭新增弹窗
   */
  closeAddRecurringModal() {
    this.setData({ showAddRecurringModal: false });
  },

  /**
   * 当没有活跃固定账单时，点击提醒卡片中的「+添加」按鈕
   */
  onAddFirstRecurring() {
    this.onAddRecurringBill();
  }
});
