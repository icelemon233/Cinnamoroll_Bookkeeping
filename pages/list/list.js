// pages/list/list.js - 账单列表页
const { getRecords, deleteRecord, groupByDate, formatDate } = require('../../utils/storage');

Page({
  data: {
    allGroups: [],        // 全部按日期分组
    filterType: 'all',    // 'all' | 'expense' | 'income'
    totalIncome: 0,
    totalExpense: 0,
    isEmpty: false,
    filterMonth: ''       // 'YYYY-MM'，空表示全部
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.loadData();
  },

  loadData() {
    const { filterType, filterMonth } = this.data;
    let records = getRecords();

    // 按月份筛选
    if (filterMonth) {
      records = records.filter(r => r.date && r.date.startsWith(filterMonth));
    }

    // 按类型筛选
    let filtered = records;
    if (filterType !== 'all') {
      filtered = records.filter(r => r.type === filterType);
    }

    // 计算总收入/总支出（基于月份筛选后的全量，不受 type 筛选影响）
    let totalIncome = 0;
    let totalExpense = 0;
    records.forEach(r => {
      if (r.type === 'income') totalIncome += Number(r.amount) || 0;
      else totalExpense += Number(r.amount) || 0;
    });

    // 按日期分组
    const allGroups = groupByDate(filtered).map(group => ({
      ...group,
      dateLabel: formatDate(group.date),
      // 计算每组的收支小计
      groupIncome: group.records.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0),
      groupExpense: group.records.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0),
      records: group.records.map(r => ({
        ...r,
        amountDisplay: r.type === 'income' ? `+${r.amount}` : `-${r.amount}`
      }))
    }));

    this.setData({
      allGroups,
      totalIncome: parseFloat(totalIncome.toFixed(2)),
      totalExpense: parseFloat(totalExpense.toFixed(2)),
      isEmpty: allGroups.length === 0
    });
  },

  // 切换筛选类型
  switchFilter(e) {
    const filterType = e.currentTarget.dataset.type;
    this.setData({ filterType }, () => this.loadData());
  },

  // 长按删除
  onLongPress(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '删除这条账单记录？',
      confirmText: '删除',
      confirmColor: '#FF8BAB',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          deleteRecord(id);
          wx.showToast({ title: '已删除', icon: 'success', duration: 800 });
          this.loadData();
        }
      }
    });
  },

  // 跳转记账
  goToAdd() {
    wx.switchTab({ url: '/pages/add/add' });
  }
});
