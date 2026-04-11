// pages/index/index.js - 首页
const { getMonthSummary, groupByDate, formatDate } = require('../../utils/storage');

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
    monthIncome: 0,
    monthExpense: 0,
    monthNet: 0,
    recentGroups: [],        // 最近账单（按日期分组，最多5条）
    isEmpty: false
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

    // 最近5条账单，按日期分组
    const allRecentRecords = summary.records
      .sort((a, b) => b.id - a.id)
      .slice(0, 5);

    const recentGroups = groupByDate(allRecentRecords).map(group => ({
      ...group,
      dateLabel: formatDate(group.date),
      records: group.records.map(r => ({
        ...r,
        emoji: CATEGORY_EMOJI[r.category] || '📦',
        amountDisplay: r.type === 'income' ? `+${r.amount}` : `-${r.amount}`
      }))
    }));

    this.setData({
      currentMonth: monthLabel,
      monthIncome: summary.income,
      monthExpense: summary.expense,
      monthNet: summary.net,
      recentGroups,
      isEmpty: summary.records.length === 0
    });
  },

  goToAdd() {
    wx.switchTab({ url: '/pages/add/add' });
  },

  goToList() {
    wx.switchTab({ url: '/pages/list/list' });
  }
});
