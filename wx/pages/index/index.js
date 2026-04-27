// pages/index/index.js - 首页
const { getRecords, getMonthSummary, groupByDate, formatDate, getMonthBudget, setMonthBudget, getStreakDays, getTodaySummary } = require('../../utils/storage');

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
    streakTitle: ''          // 连击称号
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
      hasTodayRecords: todayCount > 0
    });
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
